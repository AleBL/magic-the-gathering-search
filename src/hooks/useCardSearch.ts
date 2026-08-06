import { logger } from '../utils/logger';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Scry from 'scryfall-sdk';
import MagicEmitter from 'scryfall-sdk/out/util/MagicEmitter';
import { Card } from '../types/Card';
import { SearchFilters } from '../types';
import { EMPTY_SEARCH_FILTERS } from '../constants';
import { useTranslation } from 'react-i18next';

const DEFAULT_QUERY = 'c>=1';
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 500;

const deduplicateCards = (combined: Card[], targetLang: string): Card[] => {
  const uniqueMap = new Map<string, Card>();
  const cleanLang = (targetLang || 'en').split('-')[0].toLowerCase();

  combined.forEach((card) => {
    const existing = uniqueMap.get(card.oracle_id);
    if (!existing) {
      uniqueMap.set(card.oracle_id, card);
    } else {
      // Prefer preferred language over English, but keep English if preferred doesn't exist
      const existingIsEnglish = existing.lang === 'en' || !existing.lang;
      const newIsPreferred = card.lang === cleanLang;
      if (existingIsEnglish && newIsPreferred) {
        uniqueMap.set(card.oracle_id, card);
      }
    }
  });

  return Array.from(uniqueMap.values());
};

export function useCardSearch(language: string) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeQuery, setActiveQuery] = useState('');

  const isLoadingMoreRef = useRef(false);
  const isInitialMount = useRef(true);
  const activeEmittersRef = useRef<MagicEmitter<Scry.Card>[]>([]);
  const latestSearchIdRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedQueryRef = useRef(searchQuery);
  const lastSearchedFiltersRef = useRef(filters);

  const buildQuery = useCallback(
    (raw: string) => {
      const hasFilters = filters.colors.length > 0 || filters.types.length > 0 || filters.rarity || filters.cmc;
      const trimmed = raw.trim();
      let query = '';

      if (trimmed) {
        query = trimmed;
      } else if (!hasFilters) {
        query = DEFAULT_QUERY;
      }

      if (filters.colors.length > 0) {
        // 'C' (colorless) is Scryfall's dedicated colorless keyword, not a
        // color letter to combine with WUBRG — useSearchFilters keeps the two
        // mutually exclusive, so seeing 'C' here means it's the only entry.
        const colorQuery = filters.colors.includes('C') ? 'c:c' : `c:${filters.colors.join('')}`;
        query += `${query ? ' ' : ''}${colorQuery}`;
      }
      if (filters.types.length > 0) {
        query += `${query ? ' ' : ''}t:${filters.types.join(' ')}`;
      }
      if (filters.rarity) {
        query += `${query ? ' ' : ''}r:${filters.rarity}`;
      }
      if (filters.cmc) {
        query += `${query ? ' ' : ''}cmc=${filters.cmc}`;
      }

      return query;
    },
    [filters]
  );

  const searchCards = useCallback(
    async (baseQuery: string, page: number, searchLanguage: string): Promise<{ cards: Card[]; hasMore: boolean }> => {
      const results: Card[] = [];
      const query = `${baseQuery} lang:${searchLanguage}`;

      const searchPromise = new Promise<{ cards: Card[]; hasMore: boolean }>((resolve, reject) => {
        const emitter = Scry.Cards.search(query, { page });
        activeEmittersRef.current.push(emitter);

        const cleanup = () => {
          activeEmittersRef.current = activeEmittersRef.current.filter((emitterItem) => emitterItem !== emitter);
        };

        emitter.cancelAfterPage();

        emitter.on('data', (card: Scry.Card) => {
          const multiverseId = card.multiverse_ids?.[0];
          const gathererUrl = multiverseId
            ? `https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=${multiverseId}&type=card`
            : '';

          results.push({
            ...(card as unknown as Card),
            image_uris: card.image_uris
              ? {
                  ...card.image_uris,
                  gatherer: gathererUrl
                }
              : undefined
          });
        });

        emitter.on('done', () => {
          cleanup();
          resolve({ cards: results, hasMore: emitter.cancelled });
        });

        emitter.on('cancel', () => {
          cleanup();
          resolve({ cards: results, hasMore: true });
        });

        emitter.on('not_found', () => {
          cleanup();
          resolve({ cards: [], hasMore: false });
        });

        emitter.on('error', (err: Error & { status?: number }) => {
          cleanup();
          if (err?.status === 404 || err?.message?.includes('404')) {
            resolve({ cards: [], hasMore: false });
          } else {
            reject(err);
          }
        });
      });

      const timeoutPromise = new Promise<{ cards: Card[]; hasMore: boolean }>((_, reject) => {
        setTimeout(() => reject(new Error('Search request timed out')), 6000);
      });

      return Promise.race([searchPromise, timeoutPromise]);
    },
    []
  );

  const fetchPage = useCallback(
    async (query: string, page: number): Promise<{ cards: Card[]; hasMore: boolean }> => {
      const preferredLang = language || 'en';

      const [preferredResult, englishResult] = await Promise.all([
        searchCards(query, page, preferredLang),
        preferredLang !== 'en' ? searchCards(query, page, 'en') : Promise.resolve({ cards: [], hasMore: false })
      ]);

      const seen = new Set(preferredResult.cards.map((card) => card.oracle_id));
      const merged = [...preferredResult.cards, ...englishResult.cards.filter((card) => !seen.has(card.oracle_id))];
      const hasMoreResults = preferredResult.hasMore || englishResult.hasMore;

      return { cards: merged, hasMore: hasMoreResults };
    },
    [language, searchCards]
  );

  const loadFirstPage = useCallback(
    async (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      lastSearchedQueryRef.current = searchQuery;
      lastSearchedFiltersRef.current = filters;

      latestSearchIdRef.current += 1;
      const searchId = latestSearchIdRef.current;

      activeEmittersRef.current.forEach((emitter) => {
        if (emitter) {
          emitter.cancel();
        }
      });
      activeEmittersRef.current = [];

      setIsLoadingInitial(true);
      setError(null);
      setCards([]);
      setCurrentPage(1);
      setHasMore(true);
      setActiveQuery(query);

      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);

      try {
        const { cards: results, hasMore: more } = await fetchPage(query, 1);
        if (searchId !== latestSearchIdRef.current) return;

        setCards(deduplicateCards(results, language));
        setHasMore(more);
        setCurrentPage(2);
      } catch (err: unknown) {
        if (searchId !== latestSearchIdRef.current) return;
        logger.error('Failed to load first page of search results:', err);
        const scryfallError = err as Partial<Error & { status: number }>;
        const errMsg = scryfallError?.message || '';
        const status = scryfallError?.status || 0;
        if (status === 429 || errMsg.includes('429')) {
          setError(t('search.rateLimited'));
        } else if (
          status === 503 ||
          status === 504 ||
          errMsg.includes('503') ||
          errMsg.includes('504') ||
          errMsg.toLowerCase().includes('offline') ||
          errMsg.toLowerCase().includes('maintenance') ||
          errMsg.toLowerCase().includes('timed out')
        ) {
          setError(t('search.scryfallOffline'));
        } else {
          setError(t('search.error') || 'Error');
        }
      } finally {
        if (searchId === latestSearchIdRef.current) {
          setIsLoadingInitial(false);
        }
      }
    },
    [fetchPage, searchQuery, filters, language, t]
  );

  const loadNextPage = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore || !activeQuery) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const searchId = latestSearchIdRef.current;
    try {
      const { cards: results, hasMore: more } = await fetchPage(activeQuery, currentPage);
      if (searchId !== latestSearchIdRef.current) return;

      if (results.length === 0) {
        setHasMore(false);
      } else {
        setCards((prev) => deduplicateCards([...prev, ...results], language));
        setHasMore(more);
        setCurrentPage((prevPage) => prevPage + 1);
      }
    } catch (err: unknown) {
      if (searchId !== latestSearchIdRef.current) return;
      logger.error('Failed to load next page of search results:', err);
      const scryfallError = err as Partial<Error & { status: number }>;
      const errMsg = scryfallError?.message || '';
      const status = scryfallError?.status || 0;
      if (status === 429 || errMsg.includes('429')) {
        setError(t('search.rateLimited'));
      } else if (
        status === 503 ||
        status === 504 ||
        errMsg.includes('503') ||
        errMsg.includes('504') ||
        errMsg.toLowerCase().includes('offline') ||
        errMsg.toLowerCase().includes('maintenance') ||
        errMsg.toLowerCase().includes('timed out')
      ) {
        setError(t('search.scryfallOffline'));
      }
      setHasMore(false);
    } finally {
      if (searchId === latestSearchIdRef.current) {
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [activeQuery, currentPage, fetchPage, hasMore, language, t]);

  // Initial search on mount
  useEffect(() => {
    loadFirstPage(buildQuery(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search on query/filters change
  useEffect(() => {
    const raw = searchQuery.trim();
    const queryChanged = searchQuery !== lastSearchedQueryRef.current;
    const filtersChanged = JSON.stringify(filters) !== JSON.stringify(lastSearchedFiltersRef.current);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return undefined;
    }

    if (!queryChanged && !filtersChanged) {
      return undefined;
    }

    if (raw.length > 0 && raw.length < MIN_QUERY_LENGTH) return undefined;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      loadFirstPage(buildQuery(searchQuery));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, filters, loadFirstPage, buildQuery]);

  // Cleanup active emitters on unmount
  useEffect(() => {
    return () => {
      activeEmittersRef.current.forEach((emitter) => {
        if (emitter) {
          emitter.cancel();
        }
      });
    };
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    cards,
    isLoadingInitial,
    isLoadingMore,
    error,
    filters,
    setFilters,
    hasMore,
    loadFirstPage,
    loadNextPage,
    buildQuery
  };
}
