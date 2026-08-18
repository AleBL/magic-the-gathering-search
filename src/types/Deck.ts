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
  /** Non-indexed on purpose: Dexie persists unlisted fields as-is, so this needs no schema
   *  bump. Unset falls back to the commander or the best available art. */
  coverCardId?: string;
}

export interface DeckVersion {
  id: string;
  deckId: string;
  name: string;
  format: DeckFormat;
  cards: Card[];
  relatedTokens?: DeckRelatedToken[];
  createdAt: string;
}
