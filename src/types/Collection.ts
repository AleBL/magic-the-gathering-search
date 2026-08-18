import { Card } from './Card';

export type Currency = 'usd' | 'eur';

// One row per printing, so two editions of the same card are two entries. The whole
// {@link Card} is stored, not a reference: the collection has to render offline, and a card
// that later leaves Scryfall search must not take its own row's data with it.
export interface CollectionEntry {
  /** Scryfall print id (`card.id`), and the Dexie primary key. */
  id: string;
  /** `card.oracle_id`, which groups every printing of the same card. */
  oracleId: string;
  name: string;
  set?: string;
  rarity: string;
  quantity: number;
  wishlist: boolean;
  card: Card;
  /**
   * Prices borrowed from the printing's English version when the stored one has none.
   * `undefined` means not looked up yet, `null` means looked up and nothing found.
   */
  fallbackPrices?: { usd: string | null; eur: string | null } | null;
  updatedAt: string;
}
