import { logger } from '../utils/logger';
import { Card } from '../types/Card';
import { Deck, DeckFormat } from '../types/Deck';
import { DeckFormatType, DeckZone } from '../types/enums';
import { ParseResult } from './deckImportService';

/**
 * Compact, backend-free deck sharing. A deck is reduced to the minimum needed to
 * rebuild it (name, format and a list of name + quantity + printing + zone +
 * commander flag), serialized to JSON with short keys, then base64url-encoded so
 * it survives inside a URL query param or a `.deck` file. Importing resolves the
 * card names back through Scryfall (see fetchCardsFromParsedList), so only the
 * lightweight identity of each card travels in the link — never the full objects.
 */

/** Query-string parameter that carries an encoded deck on a shareable link. */
export const SHARE_PARAM = 'deck';

/** Bumped only if the serialized shape changes in a backward-incompatible way. */
const SHARE_VERSION = 1;

/** One deck entry as it travels in a share payload (short keys keep links small). */
interface ShareEntry {
  /** quantity */
  q: number;
  /** card name */
  n: string;
  /** set code (optional — pins an exact printing) */
  s?: string;
  /** collector number (optional — pins an exact printing) */
  cn?: string;
  /** zone (omitted when the default `main`) */
  z?: DeckZone;
  /** commander flag (omitted when false) */
  c?: 1;
}

interface SharePayload {
  v: number;
  n: string;
  f: DeckFormat;
  c: ShareEntry[];
}

/** Decoded, validated deck ready to be resolved into real cards. */
export interface DecodedShareDeck {
  name: string;
  format: DeckFormat;
  entries: ParseResult[];
}

/** Encodes raw bytes as an URL-safe base64 string (no padding). */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Reverses {@link toBase64Url}. Throws if the input is not valid base64url. */
function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Collapses a deck's individual card copies into share entries, grouping by the
 * combination of name, printing, zone and commander status. Order of first
 * appearance is preserved so re-imports read predictably.
 */
export function deckToShareEntries(cards: Card[]): ShareEntry[] {
  const groups = new Map<string, ShareEntry>();

  for (const card of cards) {
    const zone = card.zone && card.zone !== DeckZone.MAIN ? card.zone : undefined;
    const isCommander = card.isCommander ? 1 : undefined;
    const key = [card.name, card.set ?? '', card.collector_number ?? '', zone ?? '', isCommander ?? ''].join('|');

    const existing = groups.get(key);
    if (existing) {
      existing.q += 1;
      continue;
    }

    const entry: ShareEntry = { q: 1, n: card.name };
    if (card.set) entry.s = card.set;
    if (card.collector_number) entry.cn = card.collector_number;
    if (zone) entry.z = zone;
    if (isCommander) entry.c = 1;
    groups.set(key, entry);
  }

  return Array.from(groups.values());
}

/** Converts share entries back into the parse results the importer resolves. */
export function shareEntriesToParseResults(entries: ShareEntry[]): ParseResult[] {
  return entries.map((entry) => ({
    name: entry.n,
    quantity: entry.q,
    set: entry.s,
    collector_number: entry.cn,
    zone: entry.z,
    isCommander: entry.c === 1
  }));
}

/** Serializes a deck into a compact, URL-safe share string. */
export function encodeDeckToShareString(deck: Deck): string {
  const payload: SharePayload = {
    v: SHARE_VERSION,
    n: deck.name,
    f: deck.format || DeckFormatType.FREEFORM,
    c: deckToShareEntries(deck.cards)
  };
  return toBase64Url(JSON.stringify(payload));
}

/** Type guard: does this look like a share payload we can safely read? */
function isSharePayload(value: unknown): value is SharePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<SharePayload>;
  return typeof payload.n === 'string' && Array.isArray(payload.c);
}

/**
 * Parses a share string back into a deck description. Returns null when the
 * input is missing, malformed or of an unsupported version rather than throwing,
 * so callers can show a friendly "invalid link" message.
 */
export function decodeShareString(encoded: string): DecodedShareDeck | null {
  if (!encoded) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    if (!isSharePayload(parsed)) return null;
    if (typeof parsed.v === 'number' && parsed.v > SHARE_VERSION) return null;

    const entries = parsed.c
      .filter((entry): entry is ShareEntry => !!entry && typeof entry.n === 'string')
      .map((entry) => ({ ...entry, q: Math.max(1, Math.floor(Number(entry.q) || 1)) }));

    return {
      name: parsed.n || '',
      format: parsed.f || DeckFormatType.FREEFORM,
      entries: shareEntriesToParseResults(entries)
    };
  } catch (error) {
    logger.error('Failed to decode deck share string:', error);
    return null;
  }
}

/** Builds a full shareable URL for a deck, based on the current location. */
export function buildShareUrl(deck: Deck, origin?: string): string {
  const encoded = encodeDeckToShareString(deck);
  const base = origin ?? (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${SHARE_PARAM}=${encoded}`;
}

/**
 * Extracts an encoded deck from a URL's query string (or a raw `?...`/`#...`
 * fragment). Returns the encoded string, or null when no share param is present.
 */
export function extractShareParam(search: string): string | null {
  if (!search) return null;
  const query = search.startsWith('#') ? search.slice(search.indexOf('?') + 1) : search;
  try {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    return params.get(SHARE_PARAM);
  } catch {
    return null;
  }
}

/** Wraps an encoded deck as the textual body of a `.deck` file. */
export function buildDeckFileContent(deck: Deck): string {
  return `# DeckForge shareable deck — import this file or open the link below\n# ${deck.name}\n${buildShareUrl(deck)}\n${encodeDeckToShareString(deck)}\n`;
}

/**
 * Reads a `.deck` file body, tolerating comment lines and a leading share URL:
 * the encoded payload is the last non-comment token, whether bare or embedded in
 * a `?deck=` link.
 */
export function parseDeckFileContent(content: string): DecodedShareDeck | null {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const candidate = line.includes(`${SHARE_PARAM}=`) ? extractShareParam(line.slice(line.indexOf('?'))) : line;
    const decoded = candidate ? decodeShareString(candidate) : null;
    if (decoded) return decoded;
  }
  return null;
}
