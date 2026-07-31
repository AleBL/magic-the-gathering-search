import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EMPTY_SEARCH_FILTERS } from '../constants';
import { CollectionEntry } from '../types/Collection';
import { makeCard } from '../test/factories';

// Dexie's live query is the thing under test here — specifically the difference between
// "IndexedDB has not answered yet" (undefined) and "answered, nothing there" ([]).
const liveResult = vi.hoisted(() => ({ current: undefined as CollectionEntry[] | undefined }));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => liveResult.current }));
vi.mock('../db/database', () => ({ db: { collection: { orderBy: () => ({ toArray: () => [] }) } } }));

const { useCollection } = await import('./useCollection');

const entry = (name: string, quantity = 1, wishlist = false): CollectionEntry =>
  ({ id: name, name, quantity, wishlist, card: makeCard({ name }) }) as unknown as CollectionEntry;

const render = () => renderHook(() => useCollection('owned', EMPTY_SEARCH_FILTERS));

describe('useCollection', () => {
  beforeEach(() => {
    liveResult.current = undefined;
  });

  // The regression this pins: `?? []` collapsed the two states into one, so a full
  // collection rendered the "you own nothing, go add some" empty state on every visit
  // until IndexedDB answered.
  it('reports loading while the live query has not resolved', () => {
    liveResult.current = undefined;
    const { result } = render();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.entries).toEqual([]);
  });

  it('stops reporting loading once the query resolves, even with no rows', () => {
    liveResult.current = [];
    const { result } = render();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.entries).toEqual([]);
  });

  it('stops reporting loading once rows arrive', () => {
    liveResult.current = [entry('Lightning Bolt', 2)];
    const { result } = render();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.visibleEntries).toHaveLength(1);
  });

  // The empty fallback must keep a stable identity, or the memos downstream invalidate
  // on every render — the defect this hook was already fixed for once.
  it('returns the same empty array reference across renders while loading', () => {
    const { result, rerender } = render();
    const first = result.current.entries;
    rerender();

    expect(result.current.entries).toBe(first);
  });

  it('excludes wishlist-only rows from the owned view', () => {
    liveResult.current = [entry('Owned', 1), entry('Wanted', 0, true)];
    const { result } = render();

    expect(result.current.visibleEntries.map((e) => e.name)).toEqual(['Owned']);
  });
});
