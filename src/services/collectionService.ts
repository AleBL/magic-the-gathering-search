import { logger } from '../utils/logger';
import { db } from '../db/database';
import { Card } from '../types/Card';
import { CollectionEntry } from '../types/Collection';
import { scryfallPrintingUrl } from '../constants/urls';

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

/** A row with no copies and no wishlist flag is deleted rather than stored as zeroes. */
const persist = async (entry: CollectionEntry): Promise<void> => {
  if (entry.quantity <= 0 && !entry.wishlist) {
    await db.collection.delete(entry.id);
    return;
  }
  await db.collection.put({ ...entry, updatedAt: new Date().toISOString() });
};

const needsPriceFallback = (card: Card): boolean =>
  !card.prices?.usd && !card.prices?.eur && !!card.set && !!card.collector_number && (card.lang ?? 'en') !== 'en';

// Non-English printings usually carry no Scryfall price, so the English printing of the same
// set and collector number is fetched once as an estimate. Fire-and-forget on purpose: a
// failure leaves `fallbackPrices` undefined, which is what allows a later retry.
const enrichPriceFallback = async (cardId: string): Promise<void> => {
  try {
    const entry = await db.collection.get(cardId);
    if (!entry || entry.fallbackPrices !== undefined || !needsPriceFallback(entry.card)) return;

    // Both parts address the printing, so without either one there is nothing to ask for:
    // the URL would carry the literal string "undefined" and come back 404.
    const { set, collector_number: collectorNumber } = entry.card;
    if (!set || !collectorNumber) return;

    const response = await fetch(scryfallPrintingUrl(set, collectorNumber));
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

export const toggleWishlist = async (card: Card): Promise<void> => {
  const existing = await db.collection.get(card.id);
  const base = existing ?? buildEntry(card);
  await persist({ ...base, card, name: card.name, wishlist: !base.wishlist });
  void enrichPriceFallback(card.id);
};

// Quantities are summed and wishlist flags OR-ed, so an import can never silently discard
// copies the collection already had.
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
