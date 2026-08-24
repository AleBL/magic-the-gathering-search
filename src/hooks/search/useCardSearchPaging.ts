import { logger } from '../../utils/logger';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../types/Card';
import {
  deduplicateCards,
  isBrowserOffline,
  mergeLanguageResults,
  scryfallSearchErrorKey
} from '../../utils/scryfallSearch';
import { SearchPage, useScryfallEmitters } from './useScryfallEmitters';

/**
 * Owns the result list and its paging. Every request carries the id of the search that asked
 * for it, so a slow answer to an abandoned query cannot overwrite the results on screen.
 */
export function useCardSearchPaging(language: string) {
  const { t } = useTranslation();
  const { searchPage, cancelActiveSearches } = useScryfallEmitters();

  const [cards, setCards] = useState<Card[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeQuery, setActiveQuery] = useState('');

  const isLoadingMoreRef = useRef(false);
  const latestSearchIdRef = useRef<number>(0);

  const fetchPage = useCallback(
    async (query: string, page: number): Promise<SearchPage> => {
      const preferredLang = language || 'en';
      const [preferred, english] = await Promise.all([
        searchPage(query, page, preferredLang),
        preferredLang !== 'en' ? searchPage(query, page, 'en') : Promise.resolve({ cards: [], hasMore: false })
      ]);

      return {
        cards: mergeLanguageResults(preferred.cards, english.cards),
        hasMore: preferred.hasMore || english.hasMore
      };
    },
    [language, searchPage]
  );

  const loadFirstPage = useCallback(
    async (query: string) => {
      latestSearchIdRef.current += 1;
      const searchId = latestSearchIdRef.current;
      cancelActiveSearches();

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

        // With no connection the SDK's emitter ends as `done` with zero results instead of
        // erroring, which is indistinguishable from a query nothing matches: the grid said
        // "No cards found" and offered to adjust filters that were never the problem.
        if (results.length === 0 && isBrowserOffline()) {
          setError(t('search.scryfallOffline'));
        }

        setCards(deduplicateCards(results, language));
        setHasMore(more);
        setCurrentPage(2);
      } catch (error_: unknown) {
        if (searchId !== latestSearchIdRef.current) return;
        logger.error('Failed to load first page of search results:', error_);
        const errorKey = scryfallSearchErrorKey(error_);
        setError(errorKey ? t(errorKey) : t('search.error') || 'Error');
      } finally {
        if (searchId === latestSearchIdRef.current) {
          setIsLoadingInitial(false);
        }
      }
    },
    [fetchPage, cancelActiveSearches, language, t]
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
        // Same silent ending as the first page: with no connection the emitter completes
        // empty, and the list simply stopped growing with nothing said about why.
        if (isBrowserOffline()) {
          setError(t('search.scryfallOffline'));
        }
        setHasMore(false);
        return;
      }

      setCards((previousCards) => deduplicateCards([...previousCards, ...results], language));
      setHasMore(more);
      setCurrentPage((previousPage) => previousPage + 1);
    } catch (error_: unknown) {
      if (searchId !== latestSearchIdRef.current) return;
      logger.error('Failed to load next page of search results:', error_);
      const errorKey = scryfallSearchErrorKey(error_);
      if (errorKey) setError(t(errorKey));
      setHasMore(false);
    } finally {
      if (searchId === latestSearchIdRef.current) {
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [activeQuery, currentPage, fetchPage, hasMore, language, t]);

  return { cards, isLoadingInitial, isLoadingMore, error, hasMore, loadFirstPage, loadNextPage, cancelActiveSearches };
}
