import { describe, expect, it } from 'vitest';
import { matchesFilters, parseComparison } from './collectionFilter';
import { EMPTY_SEARCH_FILTERS } from '../constants';
import { SearchFilters } from '../types';
import { Card } from '../types/Card';
import { makeCard } from '../test/factories';

const withFilters = (overrides: Partial<SearchFilters>): SearchFilters => ({
  ...EMPTY_SEARCH_FILTERS,
  ...overrides
});

const bolt = (overrides: Partial<Card> = {}) =>
  makeCard({
    name: 'Lightning Bolt',
    type_line: 'Instant',
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'common',
    cmc: 1,
    ...overrides
  });

describe('parseComparison', () => {
  it('reads a bare number as equality', () => {
    expect(parseComparison('4')).toEqual({ op: '=', value: 4 });
  });

  it('reads each comparator', () => {
    expect(parseComparison('>=4')).toEqual({ op: '>=', value: 4 });
    expect(parseComparison('<2')).toEqual({ op: '<', value: 2 });
    expect(parseComparison(' > 3 ')).toEqual({ op: '>', value: 3 });
  });

  it('rejects anything that is not a comparison', () => {
    expect(parseComparison('')).toBeNull();
    expect(parseComparison('abc')).toBeNull();
    expect(parseComparison('*')).toBeNull();
  });
});

describe('matchesFilters', () => {
  it('keeps everything when no filter is set', () => {
    expect(matchesFilters(bolt(), EMPTY_SEARCH_FILTERS)).toBe(true);
  });

  it('filters by rarity', () => {
    expect(matchesFilters(bolt(), withFilters({ rarity: 'common' }))).toBe(true);
    expect(matchesFilters(bolt(), withFilters({ rarity: 'mythic' }))).toBe(false);
  });

  it('matches any of the selected colors', () => {
    expect(matchesFilters(bolt(), withFilters({ colors: ['R', 'U'] }))).toBe(true);
    expect(matchesFilters(bolt(), withFilters({ colors: ['U'] }))).toBe(false);
  });

  // Colorless means "no coloured mana at all", not "one more colour to match".
  it('treats colorless as the absence of colour', () => {
    const artifact = bolt({ colors: [], color_identity: [], type_line: 'Artifact' });

    expect(matchesFilters(artifact, withFilters({ colors: ['C'] }))).toBe(true);
    expect(matchesFilters(bolt(), withFilters({ colors: ['C'] }))).toBe(false);
  });

  it('filters by type, case-insensitively', () => {
    expect(matchesFilters(bolt(), withFilters({ types: ['Instant'] }))).toBe(true);
    expect(matchesFilters(bolt(), withFilters({ types: ['Creature'] }))).toBe(false);
  });

  it('filters by mana value, with comparators', () => {
    expect(matchesFilters(bolt(), withFilters({ cmc: '1' }))).toBe(true);
    expect(matchesFilters(bolt(), withFilters({ cmc: '>=2' }))).toBe(false);
    expect(matchesFilters(bolt(), withFilters({ cmc: '<3' }))).toBe(true);
  });

  it('matches and excludes rules text', () => {
    expect(matchesFilters(bolt(), withFilters({ text: 'deals 3 damage' }))).toBe(true);
    expect(matchesFilters(bolt(), withFilters({ text: 'draw a card' }))).toBe(false);
    expect(matchesFilters(bolt(), withFilters({ excludeText: 'damage' }))).toBe(false);
    expect(matchesFilters(bolt(), withFilters({ excludeText: 'flying' }))).toBe(true);
  });

  it('matches a keyword through the rules text', () => {
    const flyer = bolt({ oracle_text: 'Flying, vigilance', type_line: 'Creature — Bird' });

    expect(matchesFilters(flyer, withFilters({ keyword: 'flying' }))).toBe(true);
    expect(matchesFilters(bolt(), withFilters({ keyword: 'flying' }))).toBe(false);
  });

  it('reads text from both faces of a double-faced card', () => {
    const dfc = makeCard({
      oracle_text: undefined,
      card_faces: [
        { name: 'Front', type_line: 'Creature — Human', oracle_text: 'Vanilla.' },
        { name: 'Back', type_line: 'Creature — Werewolf', oracle_text: 'Trample and haste.' }
      ]
    } as Partial<Card>);

    expect(matchesFilters(dfc, withFilters({ text: 'trample' }))).toBe(true);
    expect(matchesFilters(dfc, withFilters({ types: ['Creature'] }))).toBe(true);
  });

  it('filters by power and toughness', () => {
    const bear = bolt({ type_line: 'Creature — Bear', power: '2', toughness: '2' });

    expect(matchesFilters(bear, withFilters({ power: '2' }))).toBe(true);
    expect(matchesFilters(bear, withFilters({ power: '>=3' }))).toBe(false);
    expect(matchesFilters(bear, withFilters({ toughness: '<=2' }))).toBe(true);
  });

  // `*` is a real printed value; asking for a number must simply not match it.
  it('excludes non-numeric power when a number was asked for', () => {
    const spikey = bolt({ type_line: 'Creature — Elemental', power: '*', toughness: '*' });

    expect(matchesFilters(spikey, withFilters({ power: '>=1' }))).toBe(false);
    expect(matchesFilters(spikey, EMPTY_SEARCH_FILTERS)).toBe(true);
  });

  it('requires every active filter to pass, not just one', () => {
    const filters = withFilters({ colors: ['R'], types: ['Instant'], cmc: '1' });
    expect(matchesFilters(bolt(), filters)).toBe(true);

    expect(matchesFilters(bolt({ cmc: 3 }), filters)).toBe(false);
  });
});
