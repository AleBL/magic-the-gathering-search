import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SearchFilters } from '../types';

/**
 * `useCardSearch` searches Scryfall on mount, so the SDK is stubbed: these tests are
 * about how filter state turns into a Scryfall query string, not about the network.
 * The emitter only needs the surface the hook actually drives.
 */
vi.mock('scryfall-sdk', () => {
  const emitter = {
    cancelAfterPage: () => emitter,
    cancel: () => emitter,
    on(event: string, callback: (...args: unknown[]) => void) {
      // Resolve immediately with no cards so the hook settles instead of hanging.
      if (event === 'done') queueMicrotask(() => callback());
      return emitter;
    }
  };
  return { Cards: { search: () => emitter } };
});

import { EMPTY_SEARCH_FILTERS } from '../constants';

const { useCardSearch } = await import('./useCardSearch');

const withFilters = async (overrides: Partial<SearchFilters>) => {
  const { result } = renderHook(() => useCardSearch('en'));
  await act(async () => {
    result.current.setFilters({ ...EMPTY_SEARCH_FILTERS, ...overrides });
  });
  return result;
};

describe('useCardSearch.buildQuery', () => {
  beforeEach(() => vi.clearAllMocks());

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
