import { logger } from '../utils/logger';
import { db } from '../db/database';
import { Card } from '../types/Card';
import { CollectionEntry } from '../types/Collection';

/** Builds a fresh entry snapshot for a card, defaulting to not-owned / not-wishlisted. */
const buildEntry = (card: Card, overrides: Partial<CollectionEntry> = {}): CollectionEntry => ({
  id: card.id,
  oracleId: card.oracle_id,
  name: card.name,
  set: card.set,
  rarity: card.rarity,
  quantity: 0,
  wishlist: false,
  card,
  updatedAt: new Date().toISOString(),
  ...overrides
});

/** Deletes rows that carry no information (no copies and not wishlisted). */
const persist = async (entry: CollectionEntry): Promise<void> => {
  if (entry.quantity <= 0 && !entry.wishlist) {
    await db.collection.delete(entry.id);
    return;
  }
  await db.collection.put({ ...entry, updatedAt: new Date().toISOString() });
};

/** Does this snapshot need to borrow prices from its English counterpart? */
const needsPriceFallback = (card: Card): boolean =>
  !card.prices?.usd && !card.prices?.eur && !!card.set && !!card.collector_number && (card.lang ?? 'en') !== 'en';

/**
 * Non-English printings usually have no Scryfall prices. Fetch the same
 * set/collector-number printing in English once and store its prices on the
 * entry as a ballpark estimate. Fire-and-forget: failures leave the entry
 * untouched (`fallbackPrices` stays undefined and may be retried later).
 */
const enrichPriceFallback = async (cardId: string): Promise<void> => {
  try {
    const entry = await db.collection.get(cardId);
    if (!entry || entry.fallbackPrices !== undefined || !needsPriceFallback(entry.card)) return;

    const response = await fetch(`https://api.scryfall.com/cards/${entry.card.set}/${entry.card.collector_number}/en`);
    const prices = response.ok ? (((await response.json()) as Card).prices ?? null) : null;

    const fresh = await db.collection.get(cardId);
    if (!fresh) return;
    await db.collection.put({
      ...fresh,
      fallbackPrices: prices ? { usd: prices.usd ?? null, eur: prices.eur ?? null } : null
    });
  } catch (error) {
    logger.error('Failed to fetch English price fallback:', error);
  }
};

/** Sets the owned quantity for a printing, keeping any existing wishlist flag. */
export const setOwnedQuantity = async (card: Card, quantity: number): Promise<void> => {
  const existing = await db.collection.get(card.id);
  const base = existing ?? buildEntry(card);
  await persist({ ...base, card, name: card.name, quantity: Math.max(0, Math.floor(quantity)) });
  void enrichPriceFallback(card.id);
};

export const incrementOwned = async (card: Card, delta = 1): Promise<void> => {
  const existing = await db.collection.get(card.id);
  const current = existing?.quantity ?? 0;
  await setOwnedQuantity(card, current + delta);
};

export const decrementOwned = async (card: Card): Promise<void> => {
  const existing = await db.collection.get(card.id);
  await setOwnedQuantity(card, (existing?.quantity ?? 0) - 1);
};

/** Flips the wishlist flag for a printing, creating a wishlist-only entry when new. */
export const toggleWishlist = async (card: Card): Promise<void> => {
  const existing = await db.collection.get(card.id);
  const base = existing ?? buildEntry(card);
  await persist({ ...base, card, name: card.name, wishlist: !base.wishlist });
  void enrichPriceFallback(card.id);
};

/**
 * Merges imported entries into the collection: owned quantities are summed and
 * wishlist flags OR-ed, so re-importing never silently discards local copies.
 */
export const mergeEntries = async (entries: CollectionEntry[]): Promise<void> => {
  await db.transaction('rw', db.collection, async () => {
    for (const incoming of entries) {
      const existing = await db.collection.get(incoming.id);
      if (existing) {
        await persist({
          ...existing,
          card: incoming.card,
          name: incoming.card.name,
          quantity: existing.quantity + incoming.quantity,
          wishlist: existing.wishlist || incoming.wishlist
        });
      } else {
        await persist(incoming);
      }
    }
  });
};

export const clearCollection = async (): Promise<void> => {
  await db.collection.clear();
};
