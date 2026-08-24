import { describe, it, expect } from 'vitest';
import { Card } from '../../types/Card';
import { Deck } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';
import { deckExportFileName, deckToArenaText, deckToDecText } from '../deckText';

function card(overrides: Partial<Card>): Card {
  return { id: Math.random().toString(36).slice(2), name: 'Card', ...overrides } as Card;
}

describe('deckToArenaText', () => {
  it('aggregates copies and formats set + collector number', () => {
    const text = deckToArenaText([
      card({ name: 'Lightning Bolt', set: 'lea', collector_number: '161' }),
      card({ name: 'Lightning Bolt', set: 'lea', collector_number: '161' }),
      card({ name: 'Island' })
    ]);
    expect(text).toBe('2 Lightning Bolt (LEA) 161\n1 Island');
  });

  it('omits collector number when there is no set', () => {
    expect(deckToArenaText([card({ name: 'Forest' })])).toBe('1 Forest');
  });

  it('keeps different printings on separate lines', () => {
    const text = deckToArenaText([
      card({ name: 'Sol Ring', set: 'c21', collector_number: '263' }),
      card({ name: 'Sol Ring', set: 'ltc', collector_number: '297' })
    ]);
    expect(text).toBe('1 Sol Ring (C21) 263\n1 Sol Ring (LTC) 297');
  });
});

describe('deckToDecText', () => {
  const deckOf = (cards: Card[]): Deck => ({
    id: 'deck-1',
    name: 'Burn',
    format: DeckFormatType.MODERN,
    cards,
    createdAt: '2026-08-17T00:00:00.000Z'
  });

  it('writes the name and format header above the card list', () => {
    const text = deckToDecText(
      deckOf([
        card({ name: 'Lightning Bolt', set: 'lea', collector_number: '161' }),
        card({ name: 'Lightning Bolt', set: 'lea', collector_number: '161' })
      ])
    );
    expect(text).toBe('// Burn\n// Format: modern\n\n2 Lightning Bolt (LEA) 161\n');
  });

  it('drops the set when the printing has no collector number, unlike the Arena text', () => {
    const cards = [card({ name: 'Forest', set: 'lea' })];
    expect(deckToDecText(deckOf(cards))).toContain('1 Forest\n');
    expect(deckToArenaText(cards)).toBe('1 Forest (LEA)');
  });

  it('keeps different printings of the same card on separate lines', () => {
    const text = deckToDecText(
      deckOf([
        card({ name: 'Sol Ring', set: 'c21', collector_number: '263' }),
        card({ name: 'Sol Ring', set: 'ltc', collector_number: '297' })
      ])
    );
    expect(text).toContain('1 Sol Ring (C21) 263\n1 Sol Ring (LTC) 297\n');
  });
});

describe('deckExportFileName', () => {
  const named = (name: string): Deck => ({
    id: 'deck-1',
    name,
    format: DeckFormatType.MODERN,
    cards: [],
    createdAt: '2026-08-17T00:00:00.000Z'
  });

  it('replaces every run of whitespace with a single underscore', () => {
    expect(deckExportFileName(named('Mono Red  Burn'), 'dec')).toBe('Mono_Red_Burn.dec');
  });

  it('leaves a name with no whitespace alone', () => {
    expect(deckExportFileName(named('Burn'), 'json')).toBe('Burn.json');
  });
});
