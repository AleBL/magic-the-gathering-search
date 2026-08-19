import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import i18n from '../../plugins/i18n';
import { SearchFilters } from '../../types';

/** Payload the stubbed emitter hands to the hook; empty means "no results". */
const { emitted } = vi.hoisted(() => ({ emitted: [] as unknown[] }));

/**
 * `useCardSearch` searches Scryfall on mount, so the SDK is stubbed: these tests are
 * about how filter state turns into a Scryfall query string and what the hook accepts
 * back, not about the network. The emitter only needs the surface the hook drives.
 */
vi.mock('scryfall-sdk', () => {
  const emitter = {
    // The real emitter marks itself cancelled at the page boundary, which is what the hook
    // reads as "there is a next page"; without it `loadNextPage` never runs.
    cancelled: true,
    cancelAfterPage: () => emitter,
    cancel: () => emitter,
    on(event: string, callback: (...args: unknown[]) => void) {
      // 'data' is registered before 'done', so its microtask drains first and every
      // emitted card reaches the hook before the search resolves.
      if (event === 'data') queueMicrotask(() => emitted.forEach((card) => callback(card)));
      if (event === 'done') queueMicrotask(() => callback());
      return emitter;
    }
  };
  return { Cards: { search: () => emitter } };
});

import { EMPTY_SEARCH_FILTERS } from '../../constants';

const { useCardSearch } = await import('../useCardSearch');

const withFilters = async (overrides: Partial<SearchFilters>) => {
  const { result } = renderHook(() => useCardSearch('en'));
  await act(async () => {
    result.current.setFilters({ ...EMPTY_SEARCH_FILTERS, ...overrides });
  });
  return result;
};

/** Renders the hook and waits for the search it fires on mount to settle. */
const withResults = async (payload: unknown[]) => {
  emitted.push(...payload);
  const { result } = renderHook(() => useCardSearch('en'));
  await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));
  return result;
};

describe('useCardSearch results', () => {
  beforeEach(() => {
    emitted.length = 0;
    vi.clearAllMocks();
  });

  // Scryfall's payload is unvalidated at this point: an entry with no id cannot be added
  // to a deck or looked up again, so it must be dropped rather than rendered blank.
  it('drops results that are not usable cards', async () => {
    const result = await withResults([
      { id: 'a', name: 'Lightning Bolt', oracle_id: 'o1' },
      null,
      { name: 'No id' },
      'nope',
      { id: 'b', name: 'Shock', oracle_id: 'o2' }
    ]);

    expect(result.current.cards.map((card) => card.name)).toEqual(['Lightning Bolt', 'Shock']);
  });

  // Deduplication keys on oracle_id; without a fallback, two printings that carry none
  // both key on `undefined` and collapse into a single result.
  it('keeps distinct printings that carry no oracle_id', async () => {
    const result = await withResults([
      { id: 'a', name: 'Lightning Bolt' },
      { id: 'b', name: 'Shock' }
    ]);

    expect(result.current.cards.map((card) => card.name)).toEqual(['Lightning Bolt', 'Shock']);
  });

  // With no connection the emitter completes empty instead of erroring, which is the exact
  // shape of a query nothing matches: the grid said "No cards found" and offered to adjust
  // filters that were never the problem.
  it('calls an empty result offline what it is, rather than no matches', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    try {
      const result = await withResults([]);
      expect(result.current.cards).toEqual([]);
      expect(result.current.error).toBe(i18n.t('search.scryfallOffline'));
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
  });

  it('leaves an empty result unexplained when the connection is fine', async () => {
    const result = await withResults([]);
    expect(result.current.error).toBeNull();
  });

  // Losing the connection mid-scroll used to just stop the list growing, silently.
  it('reports the dropped connection when the next page comes back empty', async () => {
    const result = await withResults([{ id: 'a', name: 'Lightning Bolt', oracle_id: 'o1' }]);
    emitted.length = 0;

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    try {
      await act(async () => {
        await result.current.loadNextPage();
      });
      expect(result.current.error).toBe(i18n.t('search.scryfallOffline'));
      expect(result.current.hasMore).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
  });
});

describe('useCardSearch.buildQuery', () => {
  beforeEach(() => {
    emitted.length = 0;
    vi.clearAllMocks();
  });

  it('falls back to the default query when there is no text and no filter', async () => {
    const result = await withFilters({});
    expect(result.current.buildQuery('')).toBe('c>=1');
  });

  it('uses the typed text as-is, trimmed', async () => {
    const result = await withFilters({});
    expect(result.current.buildQuery('  lightning bolt  ')).toBe('lightning bolt');
  });

  // The default query exists only to give an empty search *something* to show. Once a
  // filter is set it would fight the filter, so it must drop out.
  it('drops the default query once a filter is active', async () => {
    const result = await withFilters({ rarity: 'rare' });
    expect(result.current.buildQuery('')).toBe('r:rare');
  });

  it('joins colours into a single Scryfall colour term', async () => {
    const result = await withFilters({ colors: ['W', 'U'] });
    expect(result.current.buildQuery('')).toBe('c:WU');
  });

  // 'C' is Scryfall's colourless keyword, not a sixth colour letter — emitting `c:C`
  // would search for cards that are white-blue-black-red-green *and* colourless.
  it('translates the colourless filter to the dedicated keyword', async () => {
    const result = await withFilters({ colors: ['C'] });
    expect(result.current.buildQuery('')).toBe('c:c');
  });

  it('space-separates multiple types under one term', async () => {
    const result = await withFilters({ types: ['creature', 'instant'] });
    expect(result.current.buildQuery('')).toBe('t:creature instant');
  });

  it('emits cmc as an equality term', async () => {
    const result = await withFilters({ cmc: '3' });
    expect(result.current.buildQuery('')).toBe('cmc=3');
  });

  it('combines typed text with every filter, single-spaced', async () => {
    const result = await withFilters({ colors: ['R'], types: ['instant'], rarity: 'common', cmc: '1' });
    expect(result.current.buildQuery('bolt')).toBe('bolt c:R t:instant r:common cmc=1');
  });

  it('does not leave a leading space when only filters are set', async () => {
    const result = await withFilters({ colors: ['G'] });
    expect(result.current.buildQuery('')).not.toMatch(/^\s/);
  });
});
