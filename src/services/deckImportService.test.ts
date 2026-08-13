import { describe, it, expect } from 'vitest';
import { parseDeckJson, parseDeckText } from './deckImportService';
import { DeckFormatType } from '../types/enums';
import { makeCard } from '../test/factories';

describe('parseDeckJson', () => {
  const aDeck = (name: string) => ({
    id: 'original',
    name,
    format: DeckFormatType.COMMANDER,
    cards: [makeCard()],
    createdAt: '2026-01-01T00:00:00.000Z'
  });

  it('reads a single exported deck', () => {
    const decks = parseDeckJson(JSON.stringify(aDeck('Atraxa')));
    expect(decks).toHaveLength(1);
    expect(decks?.[0]).toMatchObject({ name: 'Atraxa', format: DeckFormatType.COMMANDER });
  });

  // The regression: "export all decks" writes an array, and importing it used to fail
  // as an invalid file, so the backup could be written but never read back.
  it('reads the array written by "export all decks"', () => {
    const decks = parseDeckJson(JSON.stringify([aDeck('Atraxa'), aDeck('Krenko'), aDeck('Yuriko')]));
    expect(decks?.map((deck) => deck.name)).toEqual(['Atraxa', 'Krenko', 'Yuriko']);
  });

  // Shared ids would collapse the import to a single deck on `put`.
  it('gives every deck in an array a distinct id', () => {
    const decks = parseDeckJson(JSON.stringify([aDeck('One'), aDeck('Two'), aDeck('Three')]))!;
    expect(new Set(decks.map((deck) => deck.id)).size).toBe(3);
  });

  it('reissues ids so an import cannot overwrite a deck already saved', () => {
    const decks = parseDeckJson(JSON.stringify(aDeck('Atraxa')));
    expect(decks?.[0].id).not.toBe('original');
  });

  it('defaults a deck with no format to freeform', () => {
    const formatless = { ...aDeck('Atraxa'), format: undefined };
    expect(parseDeckJson(JSON.stringify(formatless))?.[0].format).toBe(DeckFormatType.FREEFORM);
  });

  it('rejects the whole file when one deck in the array is malformed', () => {
    expect(parseDeckJson(JSON.stringify([aDeck('Atraxa'), { name: 'No cards' }]))).toBeNull();
  });

  it.each([
    ['not json', 'not json at all'],
    ['an empty array', '[]'],
    ['a deck with no name', JSON.stringify({ cards: [] })],
    ['a deck whose cards are not a list', JSON.stringify({ name: 'Broken', cards: 'four' })],
    ['null', 'null']
  ])('refuses %s', (_label, content) => {
    expect(parseDeckJson(content)).toBeNull();
  });
});

describe('parseDeckText', () => {
  it('ignores Arena section headers instead of treating them as cards', () => {
    const text = ['Comandante', '1 Codie, Códice Vocífero (STX) 253', '', 'Deck', '1 Remorso Agonizante (STA) 24'].join(
      '\n'
    );

    expect(parseDeckText(text).map((c) => c.name)).toEqual(['Codie, Códice Vocífero', 'Remorso Agonizante']);
  });

  it('parses quantity, set and collector number', () => {
    const [card] = parseDeckText('1 Trioma de Savai (IKO) 253');
    expect(card).toMatchObject({
      name: 'Trioma de Savai',
      quantity: 1,
      set: 'iko',
      collector_number: '253'
    });
  });

  it('matches section headers regardless of case, accents or trailing colon', () => {
    const text = ['COMANDANTE', 'Sideboard:', 'Compañero', 'Reserva', '4 Lightning Bolt'].join('\n');
    expect(parseDeckText(text).map((c) => c.name)).toEqual(['Lightning Bolt']);
  });

  it('still accepts plain name lists with no quantity', () => {
    expect(parseDeckText('Lightning Bolt\nCounterspell').map((c) => ({ n: c.name, q: c.quantity }))).toEqual([
      { n: 'Lightning Bolt', q: 1 },
      { n: 'Counterspell', q: 1 }
    ]);
  });

  it('skips blank lines and // comments', () => {
    expect(parseDeckText('// my deck\n\n2 Island')).toEqual([
      { name: 'Island', quantity: 2, set: undefined, collector_number: undefined }
    ]);
  });

  describe('quantity notations', () => {
    it.each([
      ['4 Lightning Bolt', 4],
      ['4x Lightning Bolt', 4],
      ['4X Lightning Bolt', 4],
      ['x4 Lightning Bolt', 4],
      ['X4 Lightning Bolt', 4]
    ])('reads %s as %i copies', (line, quantity) => {
      expect(parseDeckText(line)).toEqual([
        { name: 'Lightning Bolt', quantity, set: undefined, collector_number: undefined }
      ]);
    });
  });

  describe('set and collector number notations', () => {
    it('reads the bracket form', () => {
      expect(parseDeckText('1 Lightning Bolt [M10] 146')).toMatchObject([
        { name: 'Lightning Bolt', set: 'm10', collector_number: '146' }
      ]);
    });

    it('keeps hyphenated collector numbers intact', () => {
      // The List reprints carry numbers like WOC-166; splitting on the hyphen
      // would resolve the wrong printing.
      expect(parseDeckText('1 Lightning Bolt (PLST) WOC-166')).toMatchObject([
        { name: 'Lightning Bolt', set: 'plst', collector_number: 'WOC-166' }
      ]);
    });

    it('reads the unbracketed "NAME SET NUMBER" form', () => {
      expect(parseDeckText('1 Lightning Bolt LEA 161')).toMatchObject([
        { name: 'Lightning Bolt', set: 'lea', collector_number: '161' }
      ]);
    });

    it('keeps the letter suffix on variant collector numbers', () => {
      expect(parseDeckText('1 Lightning Bolt LEA 161a')).toMatchObject([
        { name: 'Lightning Bolt', set: 'lea', collector_number: '161a' }
      ]);
    });

    it('leaves a set-less line alone', () => {
      expect(parseDeckText('1 Lightning Bolt')).toEqual([
        { name: 'Lightning Bolt', quantity: 1, set: undefined, collector_number: undefined }
      ]);
    });
  });

  it('strips the foil/variant tags .dec exports append', () => {
    expect(parseDeckText('1 Lightning Bolt *F*').map((card) => card.name)).toEqual(['Lightning Bolt']);
  });

  // "Deck" is a section label, but "1 Deck" is a card called Deck: the quantity is
  // what distinguishes structure from content, so the header list must not win here.
  it('treats a section word with a quantity as a card, not a header', () => {
    expect(parseDeckText('1 Deck').map((card) => card.name)).toEqual(['Deck']);
  });
});
