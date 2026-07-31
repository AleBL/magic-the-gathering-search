import { describe, it, expect } from 'vitest';
import { parseDeckText } from './deckImportService';

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
