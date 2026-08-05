import { Card } from '../types/Card';
import { CollectionEntry, Currency } from '../types/Collection';

/** Parses the Scryfall price string for the given currency into a number, or null when unpriced. */
export function getCardPrice(card: Card, currency: Currency): number | null {
  const raw = currency === 'eur' ? card.prices?.eur : card.prices?.usd;
  if (raw == null) return null;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Price for a collection entry: the printing's own price when available,
 * otherwise the stored English-printing fallback (marked as an estimate).
 */
export function getEntryPrice(
  entry: CollectionEntry,
  currency: Currency
): { price: number; isFallback: boolean } | null {
  const own = getCardPrice(entry.card, currency);
  if (own !== null) return { price: own, isFallback: false };

  const raw = currency === 'eur' ? entry.fallbackPrices?.eur : entry.fallbackPrices?.usd;
  if (raw == null) return null;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? { price: value, isFallback: true } : null;
}

/** Formats a numeric value with the currency's symbol and two decimals. */
export function formatCurrency(value: number, currency: Currency): string {
  const symbol = currency === 'eur' ? '€' : '$';
  return `${symbol}${value.toFixed(2)}`;
}

/** Basic lands are free to obtain, so they never count toward "cards to buy". */
export function isBasicLand(card: Card): boolean {
  return /\bbasic land\b/i.test(card.type_line || '');
}

const normalizeName = (name: string): string => name.trim().toLowerCase();

export interface CollectionSummary {
  /** Total owned copies across every printing (sum of quantities). */
  totalCopies: number;
  /** Distinct printings with at least one owned copy. */
  uniquePrintings: number;
  /** Entries flagged for the wishlist. */
  wishlistCount: number;
  /**
   * Estimated value of owned copies: unit price × quantity, so ten copies of a card
   * count ten times.
   */
  totalValue: number;
  /**
   * Estimated value of the wishlist: one unit price per wishlisted printing. A wishlist
   * entry records *that* you want a card, not how many, so multiplying by quantity would
   * be meaningless — a wishlisted card you already own three of is still one wish.
   */
  wishlistValue: number;
  /** Owned entries whose value came from the English-printing fallback price. */
  fallbackPricedCount: number;
  currency: Currency;
}

export function computeCollectionSummary(entries: CollectionEntry[], currency: Currency): CollectionSummary {
  let totalCopies = 0;
  let uniquePrintings = 0;
  let wishlistCount = 0;
  let totalValue = 0;
  let wishlistValue = 0;
  let fallbackPricedCount = 0;

  for (const entry of entries) {
    if (entry.wishlist) {
      wishlistCount += 1;
      const wanted = getEntryPrice(entry, currency);
      if (wanted !== null) wishlistValue += wanted.price;
    }
    if (entry.quantity > 0) {
      totalCopies += entry.quantity;
      uniquePrintings += 1;
      const priced = getEntryPrice(entry, currency);
      if (priced !== null) {
        totalValue += priced.price * entry.quantity;
        if (priced.isFallback) fallbackPricedCount += 1;
      }
    }
  }

  return { totalCopies, uniquePrintings, wishlistCount, totalValue, wishlistValue, fallbackPricedCount, currency };
}

export interface DeckGapCardRow {
  name: string;
  /** Copies the deck requires. */
  needed: number;
  /** Owned copies applicable to this card (across all printings). */
  owned: number;
  /** Copies still to acquire (`max(0, needed - owned)`). */
  missing: number;
  /** Representative unit price used to estimate the missing spend. */
  unitPrice: number | null;
  /** `missing * unitPrice` (0 when the card has no price). */
  missingValue: number;
}

export interface DeckCollectionGap {
  /** Non-basic copies the deck requires. */
  totalNeeded: number;
  /** Owned copies that count toward the deck (capped at `needed` per card). */
  totalOwned: number;
  missingCopies: number;
  /** Distinct cards with at least one missing copy. */
  missingUnique: number;
  missingValue: number;
  /** One row per distinct non-basic card in the deck, sorted by missing spend. */
  rows: DeckGapCardRow[];
  currency: Currency;
}

/**
 * Compares a deck against the owned collection to report what still needs
 * buying and its estimated cost. Cards are matched by name (case-insensitive)
 * so any owned printing satisfies the requirement; basic lands are ignored.
 */
export function computeDeckCollectionGap(
  deckCards: Card[],
  entries: CollectionEntry[],
  currency: Currency
): DeckCollectionGap {
  // Owned copies summed per card name across every printing.
  const ownedByName = new Map<string, number>();
  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    const key = normalizeName(entry.name);
    ownedByName.set(key, (ownedByName.get(key) ?? 0) + entry.quantity);
  }

  // Aggregate the deck: needed count and a representative price per card name.
  const needed = new Map<string, { name: string; count: number; unitPrice: number | null }>();
  for (const card of deckCards) {
    if (isBasicLand(card)) continue;
    const key = normalizeName(card.name);
    const existing = needed.get(key);
    const price = getCardPrice(card, currency);
    if (existing) {
      existing.count += 1;
      if (existing.unitPrice === null && price !== null) existing.unitPrice = price;
    } else {
      needed.set(key, { name: card.name, count: 1, unitPrice: price });
    }
  }

  const rows: DeckGapCardRow[] = [];
  let totalNeeded = 0;
  let totalOwned = 0;
  let missingCopies = 0;
  let missingValue = 0;

  for (const [key, { name, count, unitPrice }] of needed) {
    const owned = ownedByName.get(key) ?? 0;
    const appliedOwned = Math.min(owned, count);
    const missing = Math.max(0, count - owned);
    const rowMissingValue = unitPrice !== null ? missing * unitPrice : 0;

    totalNeeded += count;
    totalOwned += appliedOwned;
    missingCopies += missing;
    missingValue += rowMissingValue;

    rows.push({ name, needed: count, owned, missing, unitPrice, missingValue: rowMissingValue });
  }

  rows.sort((a, b) => b.missingValue - a.missingValue || b.missing - a.missing || a.name.localeCompare(b.name));

  return {
    totalNeeded,
    totalOwned,
    missingCopies,
    missingUnique: rows.filter((row) => row.missing > 0).length,
    missingValue,
    rows,
    currency
  };
}
