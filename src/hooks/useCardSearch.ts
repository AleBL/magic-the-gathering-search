import { useState, useEffect, useRef, useCallback } from 'react';
import { buildFilterTerms } from '../utils/searchQuery';
import { SearchFilters } from '../types';
import { EMPTY_SEARCH_FILTERS } from '../constants';
import { useCardSearchPaging } from './search/useCardSearchPaging';

const DEFAULT_QUERY = 'c>=1';
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 500;

export function useCardSearch(language: string) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const { cards, isLoadingInitial, isLoadingMore, error, hasMore, loadFirstPage, loadNextPage, cancelActiveSearches } =
    useCardSearchPaging(language);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);
  const lastSearchedQueryRef = useRef(searchQuery);
  const lastSearchedFiltersRef = useRef(filters);

  const buildQuery = useCallback(
    (raw: string) => {
      const terms = buildFilterTerms(filters);
      const trimmed = raw.trim();

      // An empty box with no filters would search for nothing at all; with filters, the
      // filters *are* the search.
      const head = trimmed || (terms.length > 0 ? '' : DEFAULT_QUERY);

      return [head, ...terms].filter(Boolean).join(' ');
    },
    [filters]
  );

  /** Searches now, and records what was searched so the debounce below does not repeat it. */
  const startSearch = useCallback(
    async (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      lastSearchedQueryRef.current = searchQuery;
      lastSearchedFiltersRef.current = filters;

      await loadFirstPage(query);
    },
    [loadFirstPage, searchQuery, filters]
  );

  useEffect(() => {
    startSearch(buildQuery(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // A single letter matches most of Scryfall; waiting for the second keeps the first
    // keystroke of every search from costing a full result page.
    if (raw.length > 0 && raw.length < MIN_QUERY_LENGTH) return undefined;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      startSearch(buildQuery(searchQuery));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, filters, startSearch, buildQuery]);

  useEffect(() => cancelActiveSearches, [cancelActiveSearches]);

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
    loadFirstPage: startSearch,
    loadNextPage,
    buildQuery
  };
}
