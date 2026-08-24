import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { CollectionEntry } from '../../types/Collection';
import { makeCard } from '../../test/factories';

/**
 * The badge counts a printing while the search filter matches a card, so a result could
 * read "0 owned" on a card the filter had just kept as owned. `totalOwned` is what
 * reconciles them, and it must come from the same query — a second lookup per card would
 * double the reads the collection grid makes for a number already in hand.
 */

const rows = vi.hoisted(() => [] as CollectionEntry[]);

/** Minimal stand-in: resolves the query once, like a live query with no later writes. */
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (query: () => Promise<unknown>) => {
    const [value, setValue] = useState<unknown>(undefined);
    useEffect(() => {
      let alive = true;
      void Promise.resolve(query()).then((result) => {
        if (alive) setValue(result);
      });
      return () => {
        alive = false;
      };
    }, [query]);
    return value;
  }
}));

vi.mock('../../db/database', () => ({
  db: {
    collection: {
      get: async (id: string) => rows.find((row) => row.id === id),
      where: () => ({
        equals: (oracleId: string) => ({ toArray: async () => rows.filter((row) => row.oracleId === oracleId) })
      })
    }
  }
}));
vi.mock('../../utils/toastHelper', () => ({ dispatchToast: vi.fn() }));

const { useCardCollection } = await import('../useCardCollection');

const anEntry = (id: string, oracleId: string, quantity: number): CollectionEntry => ({
  id,
  oracleId,
  name: 'Lightning Bolt',
  set: id,
  rarity: 'common',
  quantity,
  wishlist: false,
  card: makeCard({ id }),
  updatedAt: '2026-01-01T00:00:00.000Z'
});

describe('useCardCollection', () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it('counts this printing and every printing of the card', async () => {
    rows.push(anEntry('bolt-m10', 'oracle-bolt', 3), anEntry('bolt-lea', 'oracle-bolt', 1));

    const { result } = renderHook(() => useCardCollection(makeCard({ id: 'bolt-m10', oracle_id: 'oracle-bolt' })));

    await waitFor(() => expect(result.current.totalOwned).toBe(4));
    expect(result.current.quantity).toBe(3);
  });

  // The reported contradiction: this printing is not owned, but the card is.
  it('reports the total for a printing the user does not have', async () => {
    rows.push(anEntry('bolt-m10', 'oracle-bolt', 3));

    const { result } = renderHook(() => useCardCollection(makeCard({ id: 'bolt-lea', oracle_id: 'oracle-bolt' })));

    await waitFor(() => expect(result.current.totalOwned).toBe(3));
    expect(result.current.quantity).toBe(0);
  });

  it('ignores wishlist-only rows, which are wanted rather than owned', async () => {
    rows.push({ ...anEntry('bolt-lea', 'oracle-bolt', 0), wishlist: true });

    const { result } = renderHook(() => useCardCollection(makeCard({ id: 'bolt-m10', oracle_id: 'oracle-bolt' })));

    await waitFor(() => expect(result.current.totalOwned).toBe(0));
  });

  it('falls back to the printing alone when the card has no oracle id', async () => {
    rows.push(anEntry('token-1', '', 2));

    const { result } = renderHook(() => useCardCollection(makeCard({ id: 'token-1', oracle_id: '' })));

    await waitFor(() => expect(result.current.quantity).toBe(2));
    expect(result.current.totalOwned).toBe(2);
  });
});
