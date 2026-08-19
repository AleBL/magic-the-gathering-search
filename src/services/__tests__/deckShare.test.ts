import { describe, it, expect } from 'vitest';
import { Card } from '../../types/Card';
import { Deck } from '../../types/Deck';
import { DeckFormatType, DeckZone } from '../../types/enums';
import {
  SHARE_PARAM,
  buildDeckFileContent,
  buildShareUrl,
  decodeShareString,
  deckToShareEntries,
  encodeDeckToShareString,
  extractShareParam,
  parseDeckFileContent,
  shareEntriesToParseResults
} from '../deckShare';

/** Minimal card factory — only the fields the share path reads. */
function makeCard(overrides: Partial<Card>): Card {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Card',
    ...overrides
  } as Card;
}

function makeDeck(cards: Card[], overrides: Partial<Deck> = {}): Deck {
  return {
    id: '1',
    name: 'My Deck',
    format: DeckFormatType.COMMANDER,
    cards,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

describe('deckShare serialization', () => {
  it('groups duplicate copies into quantities', () => {
    const cards = [
      makeCard({ name: 'Lightning Bolt' }),
      makeCard({ name: 'Lightning Bolt' }),
      makeCard({ name: 'Island' })
    ];
    const entries = deckToShareEntries(cards);
    expect(entries).toEqual([
      { q: 2, n: 'Lightning Bolt' },
      { q: 1, n: 'Island' }
    ]);
  });

  it('keeps distinct printings, zones and commander status separate', () => {
    const cards = [
      makeCard({ name: 'Sol Ring', set: 'c21', collector_number: '263', isCommander: true }),
      makeCard({ name: 'Sol Ring', set: 'ltc', collector_number: '297' }),
      makeCard({ name: 'Counterspell', zone: DeckZone.SIDEBOARD })
    ];
    const entries = deckToShareEntries(cards);
    expect(entries).toEqual([
      { q: 1, n: 'Sol Ring', s: 'c21', cn: '263', c: 1 },
      { q: 1, n: 'Sol Ring', s: 'ltc', cn: '297' },
      { q: 1, n: 'Counterspell', z: DeckZone.SIDEBOARD }
    ]);
  });

  it('round-trips a deck through encode → decode identically', () => {
    const cards = [
      makeCard({ name: 'Atraxa, Praetors’ Voice', set: 'cmr', collector_number: '28', isCommander: true }),
      makeCard({ name: 'Forest' }),
      makeCard({ name: 'Forest' }),
      makeCard({ name: 'Forest' }),
      makeCard({ name: 'Swords to Plowshares', zone: DeckZone.MAYBEBOARD }),
      makeCard({ name: 'Rampant Growth', zone: DeckZone.SIDEBOARD })
    ];
    const deck = makeDeck(cards, { name: 'Superfriends 你好 🎴', format: DeckFormatType.COMMANDER });

    const decoded = decodeShareString(encodeDeckToShareString(deck));
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Superfriends 你好 🎴');
    expect(decoded!.format).toBe(DeckFormatType.COMMANDER);

    // The parse results must reconstruct the exact aggregated deck: quantities,
    // printings, zones and the commander flag all survive the round trip.
    expect(decoded!.entries).toEqual([
      {
        name: 'Atraxa, Praetors’ Voice',
        quantity: 1,
        set: 'cmr',
        collector_number: '28',
        zone: undefined,
        isCommander: true
      },
      { name: 'Forest', quantity: 3, set: undefined, collector_number: undefined, zone: undefined, isCommander: false },
      {
        name: 'Swords to Plowshares',
        quantity: 1,
        set: undefined,
        collector_number: undefined,
        zone: DeckZone.MAYBEBOARD,
        isCommander: false
      },
      {
        name: 'Rampant Growth',
        quantity: 1,
        set: undefined,
        collector_number: undefined,
        zone: DeckZone.SIDEBOARD,
        isCommander: false
      }
    ]);
  });

  it('produces URL-safe strings (no +, /, = or spaces)', () => {
    const deck = makeDeck([makeCard({ name: 'Emrakol, the Aeons Torn ✦' })]);
    const encoded = encodeDeckToShareString(deck);
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('entries → parse results preserves the shape the importer expects', () => {
    const parseResults = shareEntriesToParseResults([
      { q: 4, n: 'Brainstorm', s: 'ice', cn: '61' },
      { q: 1, n: 'Jace', z: DeckZone.SIDEBOARD, c: 1 }
    ]);
    expect(parseResults).toEqual([
      { name: 'Brainstorm', quantity: 4, set: 'ice', collector_number: '61', zone: undefined, isCommander: false },
      {
        name: 'Jace',
        quantity: 1,
        set: undefined,
        collector_number: undefined,
        zone: DeckZone.SIDEBOARD,
        isCommander: true
      }
    ]);
  });

  it('returns null for malformed or empty input', () => {
    expect(decodeShareString('')).toBeNull();
    expect(decodeShareString('!!!not base64!!!')).toBeNull();
    expect(decodeShareString(btoa('{"totally":"unrelated"}'))).toBeNull();
  });

  it('rejects payloads from a newer, unsupported version', () => {
    const future = btoa(JSON.stringify({ v: 999, n: 'X', c: [] }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeShareString(future)).toBeNull();
  });
});

describe('deckShare URL helpers', () => {
  it('builds a URL carrying the encoded deck and reads it back', () => {
    const deck = makeDeck([makeCard({ name: 'Ponder' })]);
    const url = buildShareUrl(deck, 'https://deckforge.app/');
    expect(url.startsWith(`https://deckforge.app/?${SHARE_PARAM}=`)).toBe(true);

    const param = extractShareParam(new URL(url).search);
    expect(param).not.toBeNull();
    expect(decodeShareString(param!)!.entries[0].name).toBe('Ponder');
  });

  it('appends with & when the base URL already has a query', () => {
    const deck = makeDeck([makeCard({ name: 'Ponder' })]);
    const url = buildShareUrl(deck, 'https://deckforge.app/?tab=deck');
    expect(url).toContain(`&${SHARE_PARAM}=`);
  });

  it('extractShareParam handles hash-style fragments and missing params', () => {
    expect(extractShareParam('#/deck?deck=abc')).toBe('abc');
    expect(extractShareParam('?other=1')).toBeNull();
    expect(extractShareParam('')).toBeNull();
  });
});

describe('deckShare .deck file', () => {
  it('round-trips through a .deck file body', () => {
    const deck = makeDeck([
      makeCard({ name: 'Llanowar Elves' }),
      makeCard({ name: 'Llanowar Elves' }),
      makeCard({ name: 'Giant Growth', zone: DeckZone.SIDEBOARD })
    ]);
    const decoded = parseDeckFileContent(buildDeckFileContent(deck));
    expect(decoded).not.toBeNull();
    expect(decoded!.entries).toEqual([
      {
        name: 'Llanowar Elves',
        quantity: 2,
        set: undefined,
        collector_number: undefined,
        zone: undefined,
        isCommander: false
      },
      {
        name: 'Giant Growth',
        quantity: 1,
        set: undefined,
        collector_number: undefined,
        zone: DeckZone.SIDEBOARD,
        isCommander: false
      }
    ]);
  });

  it('returns null when the file has no decodable payload', () => {
    expect(parseDeckFileContent('# just a comment\n\n')).toBeNull();
  });
});
