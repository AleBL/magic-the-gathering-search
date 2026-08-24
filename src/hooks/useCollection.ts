import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Card } from '../types/Card';
import { CollectionEntry } from '../types/Collection';
import { SearchFilters } from '../types';
import { computeCollectionSummary } from '../utils/collectionMath';
import { useCollectionSettings } from '../store/useCollectionSettings';

export type CollectionView = 'owned' | 'wishlist';

/** Stable fallback while useLiveQuery resolves; a fresh `[]` would invalidate both memos. */
const NO_ENTRIES: CollectionEntry[] = [];

/** True when the card passes the active client-side filter bar selection. */
const matchesFilters = (card: Card, filters: SearchFilters): boolean => {
  if (filters.colors.length > 0) {
    const colors = card.colors ?? [];
    if (filters.colors.includes('C')) {
      if (colors.length > 0) return false;
    } else if (!filters.colors.some((color) => colors.includes(color))) {
      return false;
    }
  }

  if (filters.types.length > 0) {
    const typeLine = (card.type_line || '').toLowerCase();
    if (!filters.types.some((type) => typeLine.includes(type.toLowerCase()))) return false;
  }

  if (filters.rarity && card.rarity !== filters.rarity) return false;

  if (filters.cmc.trim() !== '') {
    const cmc = Number(filters.cmc);
    if (Number.isFinite(cmc) && card.cmc !== cmc) return false;
  }

  return true;
};

/** `filters` reuses the search bar's {@link SearchFilters} shape so CardFilterBar drops in. */
export function useCollection(view: CollectionView, filters: SearchFilters) {
  // `useLiveQuery` answers undefined until IndexedDB replies. Collapsing that to an empty
  // array made "loading" indistinguishable from "you own nothing", and a full collection
  // greeted its owner with the empty state on every visit, so report the difference.
  const liveEntries = useLiveQuery(() => db.collection.orderBy('name').toArray(), []);
  const entries = liveEntries ?? NO_ENTRIES;
  const isLoading = liveEntries === undefined;
  const currency = useCollectionSettings((state) => state.currency);

  const summary = useMemo(() => computeCollectionSummary(entries, currency), [entries, currency]);

  const visibleEntries = useMemo<CollectionEntry[]>(() => {
    const byView = entries.filter((entry) => (view === 'wishlist' ? entry.wishlist : entry.quantity > 0));
    return byView.filter((entry) => matchesFilters(entry.card, filters));
  }, [entries, view, filters]);

  return { entries, visibleEntries, summary, currency, isLoading };
}
