import { describe, it, expect } from 'vitest';
import { deckColorIdentity, buildSuggestionQuery, dominantCreatureType } from '../deckSuggestions';
import { Card } from '../../types/Card';

const card = (color_identity: string[]): Card => ({ color_identity }) as Card;
const creature = (type_line: string, color_identity: string[] = ['G']): Card => ({ type_line, color_identity }) as Card;

describe('deckColorIdentity', () => {
  it('unions color identities in WUBRG order', () => {
    expect(deckColorIdentity([card(['G']), card(['W']), card(['G', 'U'])])).toEqual(['W', 'U', 'G']);
  });

  it('returns empty for a colorless deck', () => {
    expect(deckColorIdentity([card([]), card([])])).toEqual([]);
  });
});

describe('buildSuggestionQuery', () => {
  it('builds a color-identity query excluding basics', () => {
    expect(buildSuggestionQuery([card(['U']), card(['W'])])).toBe('id<=wu -t:basic');
  });

  it('uses colorless identity when the deck has no colors', () => {
    expect(buildSuggestionQuery([card([])])).toBe('id:c -t:basic');
  });

  it('adds a format legality filter when given', () => {
    expect(buildSuggestionQuery([card(['R'])], 'Modern')).toBe('id<=r legal:modern -t:basic');
  });

  it('biases toward a dominant tribal theme', () => {
    const deck = [
      creature('Creature — Elf Warrior'),
      creature('Creature — Elf Druid'),
      creature('Creature — Elf Shaman')
    ];
    expect(buildSuggestionQuery(deck)).toBe('id<=g (t:elf or o:"elf") -t:basic');
  });
});

describe('dominantCreatureType', () => {
  it('returns the most common subtype above the threshold', () => {
    const deck = [
      creature('Creature — Goblin'),
      creature('Creature — Goblin Warrior'),
      creature('Creature — Goblin Rogue'),
      creature('Creature — Elf')
    ];
    expect(dominantCreatureType(deck)).toBe('Goblin');
  });

  it('returns null when there is no clear theme', () => {
    const deck = [creature('Creature — Elf'), creature('Creature — Goblin'), creature('Creature — Human')];
    expect(dominantCreatureType(deck)).toBeNull();
  });

  it('returns null with too few creatures', () => {
    expect(dominantCreatureType([creature('Creature — Elf'), creature('Creature — Elf')])).toBeNull();
  });
});
