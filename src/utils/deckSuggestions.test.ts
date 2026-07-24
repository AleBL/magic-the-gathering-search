import { describe, it, expect } from 'vitest';
import { deckColorIdentity, buildSuggestionQuery } from './deckSuggestions';
import { Card } from '../types/Card';

const card = (color_identity: string[]): Card => ({ color_identity }) as Card;

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
});
