import { Card } from './Card';
import { DeckFormatType } from './enums';

export type DeckFormat = DeckFormatType;

export interface DeckRelatedToken {
  tokenCard: Card;
  generatorCardName: string;
  isActive?: boolean;
}

export interface Deck {
  id: string;
  name: string;
  cards: Card[];
  format: DeckFormat;
  notes?: string;
  createdAt: string;
  relatedTokens?: DeckRelatedToken[];
  /** Card whose art represents the deck on its "deck box"; falls back to the
   *  commander or best available art when unset. Non-indexed, so it needs no
   *  Dexie schema bump — Dexie persists unlisted fields as-is. */
  coverCardId?: string;
}

/** Point-in-time snapshot of a deck, kept for the version history feature. */
export interface DeckVersion {
  id: string;
  deckId: string;
  name: string;
  format: DeckFormat;
  cards: Card[];
  relatedTokens?: DeckRelatedToken[];
  createdAt: string;
}
