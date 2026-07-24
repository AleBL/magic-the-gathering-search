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
});
