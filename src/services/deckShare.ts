import { logger } from '../utils/logger';
import { Card } from '../types/Card';
import { Deck, DeckFormat } from '../types/Deck';
import { DeckFormatType, DeckZone } from '../types/enums';
import { ParseResult } from './deckImportService';

// Sharing without a backend: only each card's identity travels, base64url-encoded so it
// survives a URL query param or a `.deck` file, and the importer resolves the names back
// through Scryfall (see fetchCardsFromParsedList) instead of carrying whole card objects.

export const SHARE_PARAM = 'deck';

/** Bumped only if the serialized shape changes in a backward-incompatible way. */
const SHARE_VERSION = 1;

// The keys are one or two letters because every one of them is repeated per card inside a
// URL. These payloads are already out in shared links, so a key can never be renamed.
interface ShareEntry {
  q: number; // quantity
  n: string; // card name
  s?: string; // set code, pins an exact printing
  cn?: string; // collector number, pins an exact printing
  z?: DeckZone; // zone, omitted when `main`
  c?: 1; // commander flag, omitted when false
}

interface SharePayload {
  v: number; // share version
  n: string; // deck name
  f: DeckFormat; // format
  c: ShareEntry[]; // cards
}

export interface DecodedShareDeck {
  name: string;
  format: DeckFormat;
  entries: ParseResult[];
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Throws when the input is not valid base64url. */
function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Groups by name, printing, zone and commander status, in order of first appearance. */
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

export function encodeDeckToShareString(deck: Deck): string {
  const payload: SharePayload = {
    v: SHARE_VERSION,
    n: deck.name,
    f: deck.format || DeckFormatType.FREEFORM,
    c: deckToShareEntries(deck.cards)
  };
  return toBase64Url(JSON.stringify(payload));
}

function isSharePayload(value: unknown): value is SharePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<SharePayload>;
  return typeof payload.n === 'string' && Array.isArray(payload.c);
}

/** Null instead of a throw on anything malformed, so a bad link is a message and not a crash. */
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

export function buildShareUrl(deck: Deck, origin?: string): string {
  const encoded = encodeDeckToShareString(deck);
  const base = origin ?? `${window.location.origin}${window.location.pathname}`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${SHARE_PARAM}=${encoded}`;
}

/** Accepts a full query string or a bare `?...` / `#...` fragment, since routing uses both. */
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

export function buildDeckFileContent(deck: Deck): string {
  return `# DeckForge shareable deck — import this file or open the link below\n# ${deck.name}\n${buildShareUrl(deck)}\n${encodeDeckToShareString(deck)}\n`;
}

// The payload is the last non-comment token of the file, bare or inside a `?deck=` link, so a
// hand-edited file with extra header lines still imports.
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
