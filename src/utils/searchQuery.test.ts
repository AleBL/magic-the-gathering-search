import { describe, expect, it } from 'vitest';
import { buildComparison, buildFilterTerms, hasActiveFilters } from './searchQuery';
import { EMPTY_SEARCH_FILTERS } from '../constants';
import { SearchFilters } from '../types';
import { KEYWORD_OPTIONS, ORACLE_TAG_OPTIONS } from '../constants/searchOptions';

const withFilters = (overrides: Partial<SearchFilters>): SearchFilters => ({
  ...EMPTY_SEARCH_FILTERS,
  ...overrides
});

describe('buildFilterTerms', () => {
  it('is empty when nothing is filtered', () => {
    expect(buildFilterTerms(EMPTY_SEARCH_FILTERS)).toEqual([]);
  });

  // An unquoted space is a second search term to Scryfall, so this would silently search
  // for cards containing "draw" AND "a" AND "card" as separate terms.
  it('quotes a phrase but leaves a single word alone', () => {
    expect(buildFilterTerms(withFilters({ text: 'draw a card' }))).toEqual(['(o:"draw a card" or fo:"draw a card")']);
    expect(buildFilterTerms(withFilters({ text: 'flying' }))).toEqual(['(o:flying or fo:flying)']);
  });

  it('strips quotes the user typed, rather than nesting them', () => {
    expect(buildFilterTerms(withFilters({ text: '"draw a card"' }))).toEqual(['(o:"draw a card" or fo:"draw a card")']);
  });

  it('negates excluded text', () => {
    expect(buildFilterTerms(withFilters({ excludeText: 'flying' }))).toEqual(['-(o:flying or fo:flying)']);
  });

  // Neither operator alone is enough: `fo:` reaches the reminder text but only in English,
  // `o:` reaches translated text but skips reminder text. The union covers both.
  it('searches oracle and full text together, so reminder text and translations both match', () => {
    const terms = buildFilterTerms(withFilters({ text: 'flying', excludeText: 'trample' }));
    expect(terms).toEqual(['(o:flying or fo:flying)', '-(o:trample or fo:trample)']);
  });

  it('builds keyword and oracle tag terms', () => {
    expect(buildFilterTerms(withFilters({ keyword: 'first strike' }))).toEqual(['kw:"first strike"']);
    expect(buildFilterTerms(withFilters({ oracleTag: 'removal' }))).toEqual(['otag:removal']);
  });

  it('ignores fields holding only whitespace', () => {
    expect(buildFilterTerms(withFilters({ text: '   ', excludeText: '\t' }))).toEqual([]);
  });

  it('combines every filter into one term list', () => {
    const terms = buildFilterTerms(
      withFilters({ colors: ['R'], types: ['creature'], rarity: 'rare', cmc: '3', text: 'haste', power: '>=4' })
    );
    expect(terms).toEqual(['c:R', 't:creature', 'r:rare', 'cmc=3', '(o:haste or fo:haste)', 'pow>=4']);
  });
});

describe('buildComparison', () => {
  it.each([
    ['4', 'pow=4'],
    ['>=4', 'pow>=4'],
    ['<=2', 'pow<=2'],
    ['>0', 'pow>0'],
    ['=7', 'pow=7'],
    ['  >= 4 ', 'pow>=4'],
    // `*` power is a real value, e.g. Tarmogoyf.
    ['*', 'pow=*']
  ])('turns %s into %s', (input, expected) => {
    expect(buildComparison('pow', input)).toBe(expected);
  });

  it.each([[''], ['   '], ['four'], ['>=']])('refuses %s rather than emitting a broken term', (input) => {
    expect(buildComparison('pow', input)).toBeNull();
  });
});

describe('hasActiveFilters', () => {
  // The trap this replaces: two hand-maintained lists decided whether filters were active.
  // A field missing from either was a control that silently did nothing.
  it.each([
    ['text', { text: 'draw' }],
    ['excluded text', { excludeText: 'draw' }],
    ['keyword', { keyword: 'flying' }],
    ['oracle tag', { oracleTag: 'ramp' }],
    ['power', { power: '4' }],
    ['toughness', { toughness: '<=2' }],
    ['colors', { colors: ['R'] }],
    ['rarity', { rarity: 'rare' }]
  ])('counts %s as an active filter', (_label, overrides) => {
    expect(hasActiveFilters(withFilters(overrides as Partial<SearchFilters>))).toBe(true);
  });

  it('is false for untouched filters', () => {
    expect(hasActiveFilters(EMPTY_SEARCH_FILTERS)).toBe(false);
  });
});

describe('the closed option lists', () => {
  it('offers only lowercase slugs, which is what Scryfall matches', () => {
    for (const tag of ORACLE_TAG_OPTIONS) expect(tag).toBe(tag.toLowerCase());
    for (const keyword of KEYWORD_OPTIONS) expect(keyword).toBe(keyword.toLowerCase());
  });

  it('has no duplicates', () => {
    expect(new Set(ORACLE_TAG_OPTIONS).size).toBe(ORACLE_TAG_OPTIONS.length);
    expect(new Set(KEYWORD_OPTIONS).size).toBe(KEYWORD_OPTIONS.length);
  });
});
