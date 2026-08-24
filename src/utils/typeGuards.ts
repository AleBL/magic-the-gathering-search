import { Card } from '../types/Card';
import { Deck, DeckRelatedToken } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { ScryfallCardPart, ScryfallNotFoundIdentifier } from '../types/Scryfall';

// Boundary validation for values that enter the app unknown: Scryfall responses, the SDK's own
// loosely-typed cards, and `.json` deck files. Every helper narrows or drops, never asserts.

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

/** Requires only `id` and `name`: more rejects real printings (English cards lack `printed_name`, tokens lack `set`). */
export const isCardLike = (value: unknown): value is Card =>
  isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name);

export const toCardList = (value: unknown): Card[] => (Array.isArray(value) ? value.filter(isCardLike) : []);

export type ScryfallPartRef = Pick<ScryfallCardPart, 'id' | 'name'>;

const isPartRef = (value: unknown): value is ScryfallPartRef =>
  isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name);

export const toPartRefs = (value: unknown): ScryfallPartRef[] => (Array.isArray(value) ? value.filter(isPartRef) : []);

/** `/cards/collection` echoes back unresolved identifiers with every field optional, so any object is worth keeping. */
export const toNotFoundIdentifiers = (value: unknown): ScryfallNotFoundIdentifier[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<ScryfallNotFoundIdentifier[]>((identifiers, entry) => {
    if (!isRecord(entry)) return identifiers;

    const identifier: ScryfallNotFoundIdentifier = {};
    if (isNonEmptyString(entry.id)) identifier.id = entry.id;
    if (isNonEmptyString(entry.name)) identifier.name = entry.name;
    if (isNonEmptyString(entry.set)) identifier.set = entry.set;
    if (isNonEmptyString(entry.collector_number)) identifier.collector_number = entry.collector_number;

    identifiers.push(identifier);
    return identifiers;
  }, []);
};

export interface RequestErrorInfo {
  status: number;
  message: string;
}

// SDK rejections are plain objects as often as `Error`s, and reading a non-string `.message` off one
// threw a second time inside the handler, which is how a rate limit surfaced as a generic failure.
export const readRequestError = (error: unknown): RequestErrorInfo => {
  const status = readField(error, 'status');
  const message = readField(error, 'message');

  return {
    status: typeof status === 'number' ? status : 0,
    message: typeof message === 'string' ? message : ''
  };
};

const isDeckFormat = (value: unknown): value is DeckFormatType =>
  typeof value === 'string' && (Object.values(DeckFormatType) as string[]).includes(value);

const toDeckRelatedTokens = (value: unknown): DeckRelatedToken[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<DeckRelatedToken[]>((tokens, entry) => {
    const tokenCard = readField(entry, 'tokenCard');
    const generatorCardName = readField(entry, 'generatorCardName');
    if (!isCardLike(tokenCard) || typeof generatorCardName !== 'string') return tokens;

    const token: DeckRelatedToken = { tokenCard, generatorCardName };
    const isActive = readField(entry, 'isActive');
    if (typeof isActive === 'boolean') token.isActive = isActive;

    tokens.push(token);
    return tokens;
  }, []);
};

// Returns null instead of a partial deck: a half-imported deck is worse than a refused file.
// The caller issues the `id`, so an import can never overwrite a deck already in the profile.
export const toImportedDeck = (value: unknown): Omit<Deck, 'id'> | null => {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.name) || !Array.isArray(value.cards)) return null;

  const cards = toCardList(value.cards);
  if (cards.length !== value.cards.length) return null;

  const deck: Omit<Deck, 'id'> = {
    name: value.name,
    cards,
    format: isDeckFormat(value.format) ? value.format : DeckFormatType.FREEFORM,
    createdAt: isNonEmptyString(value.createdAt) ? value.createdAt : new Date().toISOString()
  };

  if (isNonEmptyString(value.notes)) deck.notes = value.notes;
  if (isNonEmptyString(value.coverCardId)) deck.coverCardId = value.coverCardId;

  const relatedTokens = toDeckRelatedTokens(value.relatedTokens);
  if (relatedTokens.length > 0) deck.relatedTokens = relatedTokens;

  return deck;
};
