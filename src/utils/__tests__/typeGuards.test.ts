import { describe, expect, it } from 'vitest';
import {
  isCardLike,
  isRecord,
  readField,
  readRequestError,
  toCardList,
  toImportedDeck,
  toNotFoundIdentifiers,
  toPartRefs
} from '../typeGuards';
import { DeckFormatType } from '../../types/enums';
import { makeCard } from '../../test/factories';

/**
 * These guards stand between the app and everything it does not control: Scryfall's
 * responses and the `.json` files a user picks. What matters is what they refuse, so the
 * cases below are mostly malformed input.
 */

describe('isRecord', () => {
  it.each([
    ['an object', {}, true],
    ['null', null, false],
    ['an array', [], false],
    ['a string', 'card', false],
    ['undefined', undefined, false]
  ])('reads %s as %s', (_label, value, expected) => {
    expect(isRecord(value)).toBe(expected);
  });
});

describe('readField', () => {
  it('reads a field off a record', () => {
    expect(readField({ data: [1] }, 'data')).toEqual([1]);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['an array', [1, 2]]
  ])('returns undefined for %s', (_label, value) => {
    expect(readField(value, 'data')).toBeUndefined();
  });
});

describe('isCardLike', () => {
  it('accepts a printing that only carries id and name', () => {
    // English printings have no printed_name and tokens have no set: demanding the full
    // Card shape here would reject cards Scryfall really does return.
    expect(isCardLike({ id: 'abc', name: 'Lightning Bolt' })).toBe(true);
  });

  it.each([
    ['no id', { name: 'Lightning Bolt' }],
    ['an empty id', { id: '', name: 'Lightning Bolt' }],
    ['no name', { id: 'abc' }],
    ['an empty name', { id: 'abc', name: '' }],
    ['a numeric id', { id: 7, name: 'Lightning Bolt' }],
    ['null', null],
    ['a string', 'Lightning Bolt']
  ])('rejects %s', (_label, value) => {
    expect(isCardLike(value)).toBe(false);
  });
});

describe('toCardList', () => {
  it('keeps the usable cards and drops the rest', () => {
    const list = toCardList([{ id: 'a', name: 'Bolt' }, null, { name: 'No id' }, 'nope', { id: 'b', name: 'Shock' }]);
    expect(list.map((card) => card.name)).toEqual(['Bolt', 'Shock']);
  });

  it.each([
    ['a missing field', undefined],
    ['an object', { data: [] }],
    ['a string', 'data']
  ])('returns an empty list for %s', (_label, value) => {
    expect(toCardList(value)).toEqual([]);
  });
});

describe('toPartRefs', () => {
  it('keeps only the parts that can be fetched by id', () => {
    const parts = toPartRefs([
      { id: 't1', name: 'Treasure', component: 'token' },
      { name: 'No id' },
      { id: 't2', name: 'Clue' }
    ]);
    expect(parts.map((part) => part.id)).toEqual(['t1', 't2']);
  });

  it('returns an empty list when all_parts is absent', () => {
    expect(toPartRefs(undefined)).toEqual([]);
  });
});

describe('toNotFoundIdentifiers', () => {
  it('keeps the string fields worth retrying', () => {
    expect(toNotFoundIdentifiers([{ set: 'zzz', collector_number: '1', name: 'Bolt', id: 'x' }])).toEqual([
      { id: 'x', name: 'Bolt', set: 'zzz', collector_number: '1' }
    ]);
  });

  it('drops non-string fields instead of carrying them into the retry', () => {
    expect(toNotFoundIdentifiers([{ set: 42, name: 'Bolt' }])).toEqual([{ name: 'Bolt' }]);
  });

  it('skips entries that are not objects', () => {
    expect(toNotFoundIdentifiers([null, 'zzz', { name: 'Bolt' }])).toEqual([{ name: 'Bolt' }]);
  });

  it('returns an empty list when not_found is missing', () => {
    expect(toNotFoundIdentifiers(undefined)).toEqual([]);
  });
});

describe('readRequestError', () => {
  it('reads status and message off a thrown Scryfall error', () => {
    expect(readRequestError(Object.assign(new Error('429 Too Many Requests'), { status: 429 }))).toEqual({
      status: 429,
      message: '429 Too Many Requests'
    });
  });

  // The handler runs `.includes()` on the message: a non-string there used to throw a
  // second error inside the catch block.
  it.each([
    ['a message that is not a string', { status: 503, message: { text: 'down' } }, { status: 503, message: '' }],
    ['a status that is not a number', { status: '429', message: 'nope' }, { status: 0, message: 'nope' }],
    ['a string throw', 'boom', { status: 0, message: '' }],
    ['undefined', undefined, { status: 0, message: '' }]
  ])('falls back on %s', (_label, error, expected) => {
    expect(readRequestError(error)).toEqual(expected);
  });
});

describe('toImportedDeck', () => {
  const aDeck = (overrides: Record<string, unknown> = {}) => ({
    id: 'original',
    name: 'Atraxa',
    format: DeckFormatType.COMMANDER,
    cards: [makeCard()],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  });

  it('keeps a well-formed deck intact', () => {
    expect(toImportedDeck(aDeck())).toMatchObject({
      name: 'Atraxa',
      format: DeckFormatType.COMMANDER,
      createdAt: '2026-01-01T00:00:00.000Z'
    });
  });

  // The caller issues a fresh id so an import cannot overwrite a deck already saved.
  it('does not carry the id from the file', () => {
    expect(toImportedDeck(aDeck())).not.toHaveProperty('id');
  });

  it.each([
    ['a value that is not an object', 'a deck'],
    ['null', null],
    ['a deck with no name', aDeck({ name: undefined })],
    ['a deck whose name is not a string', aDeck({ name: 42 })],
    ['a deck whose cards are not a list', aDeck({ cards: 'four' })],
    ['a deck holding a card with no id', aDeck({ cards: [makeCard(), { name: 'Nameless' }] })],
    ['a deck holding a null card', aDeck({ cards: [null] })]
  ])('refuses %s', (_label, value) => {
    expect(toImportedDeck(value)).toBeNull();
  });

  // A format the app does not know would fail every legality check downstream, and it is
  // recoverable — freeform imposes no restrictions.
  it.each([['pioneer'], [''], [null], [7]])('falls back to freeform for the format %s', (format) => {
    expect(toImportedDeck(aDeck({ format }))?.format).toBe(DeckFormatType.FREEFORM);
  });

  it('stamps a createdAt when the file carries none', () => {
    expect(toImportedDeck(aDeck({ createdAt: undefined }))?.createdAt).toEqual(expect.any(String));
  });

  it('drops fields that are not part of a deck', () => {
    const deck = toImportedDeck(aDeck({ __proto__: undefined, injected: 'payload' }));
    expect(deck).not.toHaveProperty('injected');
  });

  it('keeps the optional deck fields when they are well-formed', () => {
    const tokenCard = makeCard({ name: 'Treasure' });
    const deck = toImportedDeck(
      aDeck({
        notes: 'ramp heavy',
        coverCardId: 'cover-1',
        relatedTokens: [{ tokenCard, generatorCardName: 'Dockside', isActive: true }]
      })
    );

    expect(deck).toMatchObject({ notes: 'ramp heavy', coverCardId: 'cover-1' });
    expect(deck?.relatedTokens).toEqual([{ tokenCard, generatorCardName: 'Dockside', isActive: true }]);
  });

  it('drops malformed related tokens without refusing the deck', () => {
    const deck = toImportedDeck(aDeck({ relatedTokens: [{ generatorCardName: 'Dockside' }, null, 'token'] }));
    expect(deck).not.toBeNull();
    expect(deck?.relatedTokens).toBeUndefined();
  });
});
