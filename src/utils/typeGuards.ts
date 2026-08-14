import { Card } from '../types/Card';
import { Deck, DeckRelatedToken } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { ScryfallCardPart, ScryfallNotFoundIdentifier } from '../types/Scryfall';

/**
 * Boundary validation for everything that enters the app as an unknown value: Scryfall
 * responses, the Scryfall SDK's own loosely-typed cards, and `.json` deck files picked by
 * the user. Each helper either narrows or drops — nothing here asserts a shape it did not
 * check.
 */

/** Narrows an arbitrary JSON value to something whose keys can be read. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Reads one field off an unvalidated value without asserting anything about it. */
export const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

/**
 * `id` and `name` are the only two fields the app can never work without: they key every
 * lookup map, every deck entry and every rendered label. The rest of {@link Card} is
 * already read defensively (`printed_name || name`, `rarity || ''`), and requiring more
 * here would reject genuine Scryfall printings — English cards carry no `printed_name`,
 * tokens carry no `set`.
 */
export const isCardLike = (value: unknown): value is Card =>
  isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name);

/** Keeps the usable cards out of an unknown list and drops the rest. */
export const toCardList = (value: unknown): Card[] => (Array.isArray(value) ? value.filter(isCardLike) : []);

/** The part of a Scryfall `all_parts` entry the token lookups actually need. */
export type ScryfallPartRef = Pick<ScryfallCardPart, 'id' | 'name'>;

const isPartRef = (value: unknown): value is ScryfallPartRef =>
  isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name);

/** Keeps the `all_parts` entries that can actually be fetched by id. */
export const toPartRefs = (value: unknown): ScryfallPartRef[] => (Array.isArray(value) ? value.filter(isPartRef) : []);

/**
 * `/cards/collection` echoes back the identifiers it could not resolve. Every field is
 * optional there, so an entry only has to be an object to be worth retrying.
 */
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

/**
 * Rejected promises are `unknown`, and the Scryfall SDK throws plain objects as often as
 * `Error`s. Reading `.message` off one of those with a non-string message used to throw a
 * second time inside the handler, which is how a rate limit surfaced as a generic failure.
 */
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

/**
 * Validates one deck out of an imported `.json` file. Returns null for anything the app
 * could not render — a half-imported deck is worse than a refused file. Fields that have
 * a safe default (format, createdAt) fall back instead of rejecting, and fields outside
 * {@link Deck} are dropped rather than persisted unchecked.
 *
 * The `id` is left to the caller: an import always issues a fresh one so it cannot
 * overwrite a deck already in the profile.
 */
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
