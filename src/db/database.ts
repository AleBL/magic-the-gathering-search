import Dexie, { type Table } from 'dexie';
import { Deck, DeckVersion } from '../types/Deck';
import { CollectionEntry } from '../types/Collection';

class MagicDatabase extends Dexie {
  decks!: Table<Deck, string>;
  collection!: Table<CollectionEntry, string>;
  deckVersions!: Table<DeckVersion, string>;

  constructor() {
    super('MagicDecksDB');
    this.version(1).stores({
      decks: 'id, name, format, createdAt'
    });
    // v2 introduces the personal collection. Existing decks carry over
    // untouched — Dexie keeps unlisted stores intact across upgrades.
    this.version(2).stores({
      decks: 'id, name, format, createdAt',
      collection: 'id, oracleId, name, set, rarity, updatedAt'
    });
    // v3 adds per-deck version snapshots (deck history).
    this.version(3).stores({
      decks: 'id, name, format, createdAt',
      collection: 'id, oracleId, name, set, rarity, updatedAt',
      deckVersions: 'id, deckId, createdAt'
    });
  }
}

export const db = new MagicDatabase();
