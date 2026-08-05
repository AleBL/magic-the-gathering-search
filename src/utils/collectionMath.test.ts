import { describe, expect, it } from 'vitest';
import { makeCard } from '../test/factories';
import { CollectionEntry } from '../types/Collection';
import { Card } from '../types/Card';
import {
  computeCollectionSummary,
  computeDeckCollectionGap,
  formatCurrency,
  getCardPrice,
  getEntryPrice,
  isBasicLand
} from './collectionMath';

const entry = (card: Card, overrides: Partial<CollectionEntry> = {}): CollectionEntry => ({
  id: card.id,
  oracleId: card.oracle_id,
  name: card.name,
  set: card.set,
  rarity: card.rarity,
  quantity: 1,
  wishlist: false,
  card,
  updatedAt: '2026-07-20T00:00:00.000Z',
  ...overrides
});

describe('getCardPrice', () => {
  it('parses the usd price by default', () => {
    const card = makeCard({ prices: { usd: '2.50', eur: '1.90' } });
    expect(getCardPrice(card, 'usd')).toBe(2.5);
  });

  it('parses the eur price when requested', () => {
    const card = makeCard({ prices: { usd: '2.50', eur: '1.90' } });
    expect(getCardPrice(card, 'eur')).toBe(1.9);
  });

  it('returns null when the price is missing or null', () => {
    expect(getCardPrice(makeCard({ prices: { usd: null } }), 'usd')).toBeNull();
    expect(getCardPrice(makeCard({ prices: undefined }), 'usd')).toBeNull();
    expect(getCardPrice(makeCard({ prices: { usd: 'nan' } }), 'usd')).toBeNull();
  });
});

describe('getEntryPrice', () => {
  it("prefers the printing's own price", () => {
    const e = entry(makeCard({ prices: { usd: '3.00' } }), { fallbackPrices: { usd: '9.99', eur: null } });
    expect(getEntryPrice(e, 'usd')).toEqual({ price: 3, isFallback: false });
  });

  it('falls back to the stored English-printing price and flags it', () => {
    const e = entry(makeCard({ prices: { usd: null, eur: null } }), { fallbackPrices: { usd: '9.99', eur: null } });
    expect(getEntryPrice(e, 'usd')).toEqual({ price: 9.99, isFallback: true });
    expect(getEntryPrice(e, 'eur')).toBeNull();
  });

  it('returns null when neither price exists', () => {
    expect(getEntryPrice(entry(makeCard({ prices: undefined })), 'usd')).toBeNull();
  });

  it('feeds fallback values (and their count) into the summary', () => {
    const summary = computeCollectionSummary(
      [
        entry(makeCard({ id: 'a', prices: { usd: '2.00' } }), { quantity: 2 }),
        entry(makeCard({ id: 'b', prices: { usd: null } }), { quantity: 1, fallbackPrices: { usd: '5.00', eur: null } })
      ],
      'usd'
    );
    expect(summary.totalValue).toBe(9);
    expect(summary.fallbackPricedCount).toBe(1);
  });
});

describe('formatCurrency', () => {
  it('uses the right symbol and two decimals', () => {
    expect(formatCurrency(12.5, 'usd')).toBe('$12.50');
    expect(formatCurrency(12.5, 'eur')).toBe('€12.50');
    expect(formatCurrency(0, 'usd')).toBe('$0.00');
  });
});

describe('isBasicLand', () => {
  it('detects basic lands from the type line', () => {
    expect(isBasicLand(makeCard({ type_line: 'Basic Land — Forest' }))).toBe(true);
    expect(isBasicLand(makeCard({ type_line: 'Land — Forest' }))).toBe(false);
    expect(isBasicLand(makeCard({ type_line: 'Creature — Elf' }))).toBe(false);
  });
});

describe('computeCollectionSummary', () => {
  it('sums owned copies and value, ignoring quantity-0 rows for owned stats', () => {
    const entries = [
      entry(makeCard({ prices: { usd: '3.00' } }), { quantity: 2 }),
      entry(makeCard({ prices: { usd: '5.00' } }), { quantity: 1 }),
      entry(makeCard({ prices: { usd: '9.99' } }), { quantity: 0, wishlist: true })
    ];
    const summary = computeCollectionSummary(entries, 'usd');
    expect(summary.totalCopies).toBe(3);
    expect(summary.uniquePrintings).toBe(2);
    expect(summary.wishlistCount).toBe(1);
    expect(summary.totalValue).toBeCloseTo(11); // 2*3 + 1*5
  });

  // The two tabs used to print the same number, which read as a bug because it was one:
  // the bar always showed the owned value whichever tab was open.
  describe('wishlistValue', () => {
    it('counts each wanted printing once, however many copies are owned', () => {
      const entries = [
        entry(makeCard({ prices: { usd: '4.00' } }), { quantity: 3, wishlist: true }),
        entry(makeCard({ prices: { usd: '6.00' } }), { quantity: 0, wishlist: true })
      ];
      const summary = computeCollectionSummary(entries, 'usd');

      // Owned multiplies by quantity; the wishlist does not.
      expect(summary.totalValue).toBeCloseTo(12); // 3 × 4
      expect(summary.wishlistValue).toBeCloseTo(10); // 4 + 6
    });

    it('is zero when nothing is wishlisted, even with a valuable collection', () => {
      const entries = [entry(makeCard({ prices: { usd: '50.00' } }), { quantity: 2 })];
      const summary = computeCollectionSummary(entries, 'usd');

      expect(summary.totalValue).toBeCloseTo(100);
      expect(summary.wishlistValue).toBe(0);
    });

    it('ignores unpriced wishlist rows rather than counting them as free', () => {
      const entries = [
        entry(makeCard({ prices: { usd: null } }), { quantity: 0, wishlist: true }),
        entry(makeCard({ prices: { usd: '7.50' } }), { quantity: 0, wishlist: true })
      ];
      expect(computeCollectionSummary(entries, 'usd').wishlistValue).toBeCloseTo(7.5);
    });

    it('follows the selected currency', () => {
      const entries = [entry(makeCard({ prices: { usd: '10.00', eur: '9.00' } }), { quantity: 0, wishlist: true })];

      expect(computeCollectionSummary(entries, 'usd').wishlistValue).toBeCloseTo(10);
      expect(computeCollectionSummary(entries, 'eur').wishlistValue).toBeCloseTo(9);
    });
  });

  it('skips unpriced cards in the value total but still counts the copies', () => {
    const entries = [
      entry(makeCard({ prices: { usd: null } }), { quantity: 4 }),
      entry(makeCard({ prices: { usd: '2.00' } }), { quantity: 1 })
    ];
    const summary = computeCollectionSummary(entries, 'usd');
    expect(summary.totalCopies).toBe(5);
    expect(summary.totalValue).toBeCloseTo(2);
  });
});

describe('computeDeckCollectionGap', () => {
  it('reports missing copies and estimated spend for cards not fully owned', () => {
    const bolt = makeCard({ name: 'Lightning Bolt', prices: { usd: '1.00' } });
    const goyf = makeCard({ name: 'Tarmogoyf', prices: { usd: '10.00' } });
    // Deck needs 3 Bolt + 2 Goyf.
    const deck: Card[] = [bolt, bolt, bolt, goyf, goyf];

    // Own 1 Bolt (different printing) and 0 Goyf.
    const entries = [entry(makeCard({ name: 'Lightning Bolt', prices: { usd: '1.00' } }), { quantity: 1 })];

    const gap = computeDeckCollectionGap(deck, entries, 'usd');
    expect(gap.totalNeeded).toBe(5);
    expect(gap.totalOwned).toBe(1);
    expect(gap.missingCopies).toBe(4); // 2 Bolt + 2 Goyf
    expect(gap.missingUnique).toBe(2);
    expect(gap.missingValue).toBeCloseTo(2 * 1 + 2 * 10); // 22
    // Highest missing spend first.
    expect(gap.rows[0].name).toBe('Tarmogoyf');
  });

  it('excludes basic lands from the gap', () => {
    const forest = makeCard({ name: 'Forest', type_line: 'Basic Land — Forest', prices: { usd: '0.10' } });
    const deck: Card[] = [forest, forest, forest];
    const gap = computeDeckCollectionGap(deck, [], 'usd');
    expect(gap.totalNeeded).toBe(0);
    expect(gap.missingCopies).toBe(0);
    expect(gap.rows).toHaveLength(0);
  });

  it('caps owned contribution per card and never goes negative', () => {
    const bolt = makeCard({ name: 'Lightning Bolt', prices: { usd: '1.00' } });
    const deck: Card[] = [bolt]; // needs 1
    const entries = [entry(makeCard({ name: 'Lightning Bolt' }), { quantity: 5 })]; // own 5
    const gap = computeDeckCollectionGap(deck, entries, 'usd');
    expect(gap.totalOwned).toBe(1);
    expect(gap.missingCopies).toBe(0);
    expect(gap.rows[0].owned).toBe(5);
    expect(gap.rows[0].missing).toBe(0);
  });

  it('treats unpriced missing cards as zero estimated spend', () => {
    const card = makeCard({ name: 'Mystery Card', prices: { usd: null } });
    const gap = computeDeckCollectionGap([card, card], [], 'usd');
    expect(gap.missingCopies).toBe(2);
    expect(gap.missingValue).toBe(0);
    expect(gap.rows[0].unitPrice).toBeNull();
  });

  it('matches owned copies across differing name casing', () => {
    const deck: Card[] = [makeCard({ name: 'Sol Ring' })];
    const entries = [entry(makeCard({ name: 'sol ring' }), { quantity: 1 })];
    const gap = computeDeckCollectionGap(deck, entries, 'usd');
    expect(gap.missingCopies).toBe(0);
  });
});
