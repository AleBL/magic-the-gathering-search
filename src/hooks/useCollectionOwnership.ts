import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Card } from '../types/Card';
import { CollectionEntry } from '../types/Collection';

/** Stable empty fallback: a fresh [] here would invalidate the memos below every render. */
const NO_ENTRIES: CollectionEntry[] = [];

export type OwnershipFilter = 'all' | 'owned' | 'missing';

export interface CollectionOwnership {
  /** True once the collection has been read, so callers can tell "none" from "not yet". */
  isLoaded: boolean;
  owns: (card: Card) => boolean;
  /** Filters a list of search results by ownership. `all` returns the list untouched. */
  apply: (cards: Card[], filter: OwnershipFilter) => Card[];
}

/**
 * Answers "do I already have this card?" for arbitrary search results.
 *
 * Matching is by `oracle_id`, not print id: the collection stores one row per printing,
 * but a player who owns the M10 Lightning Bolt owns Lightning Bolt. Falling back to the
 * name covers cards whose oracle id is missing from a stored snapshot.
 */
export function useCollectionOwnership(): CollectionOwnership {
  const stored = useLiveQuery(() => db.collection.toArray(), []);
  const entries = stored ?? NO_ENTRIES;
  const isLoaded = stored !== undefined;

  const { oracleIds, names } = useMemo(() => {
    const ownedOracleIds = new Set<string>();
    const ownedNames = new Set<string>();
    for (const entry of entries) {
      if (entry.quantity <= 0) continue; // wishlisted but not owned
      if (entry.oracleId) ownedOracleIds.add(entry.oracleId);
      if (entry.name) ownedNames.add(entry.name.toLowerCase());
    }
    return { oracleIds: ownedOracleIds, names: ownedNames };
  }, [entries]);

  return useMemo(() => {
    const owns = (card: Card) =>
      (!!card.oracle_id && oracleIds.has(card.oracle_id)) || names.has((card.name ?? '').toLowerCase());

    return {
      isLoaded,
      owns,
      apply: (cards: Card[], filter: OwnershipFilter) => {
        if (filter === 'all') return cards;
        return cards.filter((card) => (filter === 'owned' ? owns(card) : !owns(card)));
      }
    };
  }, [oracleIds, names, isLoaded]);
}
