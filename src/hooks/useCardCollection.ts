import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { Card } from '../types/Card';
import { decrementOwned, incrementOwned, setOwnedQuantity, toggleWishlist } from '../services/collectionService';
import { dispatchToast } from '../utils/toastHelper';

/**
 * Scoped collection state for a single card/printing. Uses a targeted live
 * query so each card only re-renders when its own entry changes, not on every
 * collection mutation. Every mutation confirms itself with a toast so the
 * (small, overlay-style) controls always give visible feedback.
 */
export function useCardCollection(card: Card) {
  const { t } = useTranslation();

  // One query, both answers. Keyed on the indexed `oracleId` so the siblings come back with
  // the entry itself: a second lookup per card would double the reads the collection grid
  // already makes, for a number derived from rows this query has in hand.
  const siblings = useLiveQuery(async () => {
    if (!card.oracle_id) {
      const own = await db.collection.get(card.id);
      return own ? [own] : [];
    }
    return db.collection.where('oracleId').equals(card.oracle_id).toArray();
  }, [card.id, card.oracle_id]);

  const entry = siblings?.find((row) => row.id === card.id);
  /** Copies of this card across every edition — what the search filter means by "owned". */
  const totalOwned = (siblings ?? []).reduce((sum, row) => sum + Math.max(0, row.quantity), 0);

  const quantity = entry?.quantity ?? 0;
  const wishlist = entry?.wishlist ?? false;
  const displayName = card.printed_name || card.name;

  const increment = useCallback(async () => {
    await incrementOwned(card);
    if (quantity === 0) {
      dispatchToast(t('collection.addedToCollection', { name: displayName }));
    } else {
      dispatchToast(t('collection.copiesUpdated', { name: displayName, count: quantity + 1 }), 'info');
    }
  }, [card, quantity, displayName, t]);

  const decrement = useCallback(async () => {
    if (quantity === 0) return;
    await decrementOwned(card);
    if (quantity === 1) {
      dispatchToast(t('collection.removedFromCollection', { name: displayName }), 'info');
    } else {
      dispatchToast(t('collection.copiesUpdated', { name: displayName, count: quantity - 1 }), 'info');
    }
  }, [card, quantity, displayName, t]);

  const setQuantity = useCallback((next: number) => setOwnedQuantity(card, next), [card]);

  const toggleWish = useCallback(async () => {
    await toggleWishlist(card);
    dispatchToast(
      wishlist
        ? t('collection.removedFromWishlist', { name: displayName })
        : t('collection.addedToWishlist', { name: displayName }),
      wishlist ? 'info' : 'success'
    );
  }, [card, wishlist, displayName, t]);

  return { quantity, totalOwned, wishlist, increment, decrement, setQuantity, toggleWishlist: toggleWish };
}
