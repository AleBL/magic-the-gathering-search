import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { CollectionEntry } from '../types/Collection';
import { makeCard } from '../test/factories';

const stored = vi.hoisted(() => ({ current: undefined as CollectionEntry[] | undefined }));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => stored.current }));
vi.mock('../db/database', () => ({ db: { collection: { toArray: async () => [] } } }));

const { useCollectionOwnership } = await import('./useCollectionOwnership');

const entry = (over: Partial<CollectionEntry>): CollectionEntry =>
  ({ id: 'p1', oracleId: 'o1', name: 'Lightning Bolt', quantity: 1, wishlist: false, ...over }) as CollectionEntry;

const render = () => renderHook(() => useCollectionOwnership()).result;

describe('useCollectionOwnership', () => {
  beforeEach(() => {
    stored.current = [];
  });

  it('reports not-loaded until the collection has been read', () => {
    stored.current = undefined;
    expect(render().current.isLoaded).toBe(false);
  });

  // The collection stores one row per printing. Owning any printing means owning the
  // card, so matching on print id would wrongly call a different edition "missing".
  it('counts a card as owned when a different printing of it is owned', () => {
    stored.current = [entry({ id: 'm10-print', oracleId: 'bolt-oracle' })];
    const owned = render().current.owns(makeCard({ id: 'lea-print', oracle_id: 'bolt-oracle' }));

    expect(owned).toBe(true);
  });

  it('falls back to the name when a stored row has no oracle id', () => {
    stored.current = [entry({ oracleId: '', name: 'Lightning Bolt' })];
    const owned = render().current.owns(makeCard({ oracle_id: 'unknown', name: 'lightning bolt' }));

    expect(owned).toBe(true);
  });

  // Wishlisted cards are explicitly the ones you do *not* have.
  it('does not count a wishlist-only row as owned', () => {
    stored.current = [entry({ oracleId: 'bolt-oracle', quantity: 0, wishlist: true })];
    const owned = render().current.owns(makeCard({ oracle_id: 'bolt-oracle' }));

    expect(owned).toBe(false);
  });

  describe('apply', () => {
    const bolt = makeCard({ name: 'Lightning Bolt', oracle_id: 'bolt-oracle' });
    const counterspell = makeCard({ name: 'Counterspell', oracle_id: 'counter-oracle' });

    beforeEach(() => {
      stored.current = [entry({ oracleId: 'bolt-oracle' })];
    });

    it('returns the list untouched for "all"', () => {
      const cards = [bolt, counterspell];
      expect(render().current.apply(cards, 'all')).toBe(cards);
    });

    it('keeps only owned cards for "owned"', () => {
      expect(
        render()
          .current.apply([bolt, counterspell], 'owned')
          .map((c) => c.name)
      ).toEqual(['Lightning Bolt']);
    });

    it('keeps only cards not owned for "missing"', () => {
      expect(
        render()
          .current.apply([bolt, counterspell], 'missing')
          .map((c) => c.name)
      ).toEqual(['Counterspell']);
    });

    it('treats everything as missing while the collection is still empty', () => {
      stored.current = [];
      expect(render().current.apply([bolt, counterspell], 'missing')).toHaveLength(2);
    });
  });
});
