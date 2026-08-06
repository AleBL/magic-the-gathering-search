import { describe, expect, it } from 'vitest';
import { groupCards, groupCardsByUnique, sortCards, getCardImageUrl } from './deckGrouping';
import { GroupCriteria, SortCriteria } from '../types/enums';
import { makeCard } from '../test/factories';

describe('sortCards', () => {
  it('sorts by name alphabetically', () => {
    const cards = [makeCard({ name: 'Charlie' }), makeCard({ name: 'Alice' }), makeCard({ name: 'Bob' })];
    const result = sortCards(cards, SortCriteria.NAME);
    expect(result.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('sorts by cmc ascending, breaking ties by name', () => {
    const cards = [
      makeCard({ name: 'Zed', cmc: 1 }),
      makeCard({ name: 'Ada', cmc: 1 }),
      makeCard({ name: 'Big', cmc: 5 })
    ];
    const result = sortCards(cards, SortCriteria.CMC);
    expect(result.map((c) => c.name)).toEqual(['Ada', 'Zed', 'Big']);
  });

  it('sorts by rarity from mythic down to common', () => {
    const cards = [
      makeCard({ name: 'C', rarity: 'common' }),
      makeCard({ name: 'M', rarity: 'mythic' }),
      makeCard({ name: 'U', rarity: 'uncommon' }),
      makeCard({ name: 'R', rarity: 'rare' })
    ];
    const result = sortCards(cards, SortCriteria.RARITY);
    expect(result.map((c) => c.rarity)).toEqual(['mythic', 'rare', 'uncommon', 'common']);
  });

  it('does not mutate the input array', () => {
    const cards = [makeCard({ name: 'B' }), makeCard({ name: 'A' })];
    const original = [...cards];
    sortCards(cards, SortCriteria.NAME);
    expect(cards).toEqual(original);
  });
});

describe('groupCards', () => {
  it('returns a single untitled group when grouping is NONE', () => {
    const cards = [makeCard({ name: 'A' }), makeCard({ name: 'B' })];
    const groups = groupCards(cards, GroupCriteria.NONE, SortCriteria.NAME);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('');
    expect(groups[0].cards).toHaveLength(2);
  });

  it('groups by card type, bucketing unknown types as "other"', () => {
    const cards = [
      makeCard({ name: 'Bear', type_line: 'Creature — Bear' }),
      makeCard({ name: 'Wastes', type_line: 'Basic Land' }),
      makeCard({ name: 'Bolt', type_line: 'Instant' }),
      makeCard({ name: 'Mystery', type_line: 'Conspiracy' })
    ];
    const groups = groupCards(cards, GroupCriteria.TYPE, SortCriteria.NAME);
    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.cards.map((c) => c.name)]));
    expect(byTitle.creature).toEqual(['Bear']);
    expect(byTitle.land).toEqual(['Wastes']);
    expect(byTitle.instant).toEqual(['Bolt']);
    expect(byTitle.other).toEqual(['Mystery']);
  });

  it('groups by CMC and orders buckets numerically with a 7+ bucket', () => {
    const cards = [
      makeCard({ name: 'Big', cmc: 8 }),
      makeCard({ name: 'Cheap', cmc: 0 }),
      makeCard({ name: 'Mid', cmc: 3 })
    ];
    const groups = groupCards(cards, GroupCriteria.CMC, SortCriteria.NAME);
    expect(groups.map((g) => g.title)).toEqual(['CMC 0', 'CMC 3', 'CMC 7+']);
  });

  it('groups by color into mono, multicolor, and colorless buckets', () => {
    const cards = [
      makeCard({ name: 'Whitey', colors: ['W'] }),
      makeCard({ name: 'Gold', colors: ['W', 'U'] }),
      makeCard({ name: 'Rock', colors: [] })
    ];
    const groups = groupCards(cards, GroupCriteria.COLOR, SortCriteria.NAME);
    const titles = groups.map((g) => g.title);
    expect(titles).toContain('white');
    expect(titles).toContain('multicolored');
    expect(titles).toContain('colorless');
  });
});

describe('groupCardsByUnique', () => {
  it('collapses copies of the same printing into counts', () => {
    const cards = [
      makeCard({ id: 'bolt-m10', name: 'Lightning Bolt' }),
      makeCard({ id: 'bolt-m10', name: 'Lightning Bolt' }),
      makeCard({ id: 'counterspell-7ed', name: 'Counterspell' })
    ];
    const grouped = groupCardsByUnique(cards);
    expect(grouped).toHaveLength(2);
    expect(grouped.find((g) => g.name === 'Lightning Bolt')?.count).toBe(2);
    expect(grouped.find((g) => g.name === 'Counterspell')?.count).toBe(1);
  });

  // The reported bug: changing one Island's art and adding another Island produced a
  // single pile wearing the changed art.
  it('keeps two printings of one card apart', () => {
    const grouped = groupCardsByUnique([
      makeCard({ id: 'island-unf', name: 'Island', set: 'unf' }),
      makeCard({ id: 'island-unf', name: 'Island', set: 'unf' }),
      makeCard({ id: 'island-unf', name: 'Island', set: 'unf' }),
      makeCard({ id: 'island-znr', name: 'Island', set: 'znr' })
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((group) => group.count)).toEqual([3, 1]);
    // Four copies in the deck either way — only the pile count changed.
    expect(grouped.reduce((total, group) => total + group.count, 0)).toBe(4);
  });

  it('gives each printing a distinct key, since the name no longer separates them', () => {
    const grouped = groupCardsByUnique([
      makeCard({ id: 'island-unf', name: 'Island' }),
      makeCard({ id: 'island-znr', name: 'Island' })
    ]);

    expect(new Set(grouped.map((group) => group.key)).size).toBe(2);
  });

  it('returns an empty list for an empty deck', () => {
    expect(groupCardsByUnique([])).toEqual([]);
  });
});

describe('getCardImageUrl', () => {
  it('prefers an explicitly selected print image', () => {
    const card = makeCard({
      selectedPrintImageUri: 'https://example.test/selected.png',
      image_uris: { small: '', normal: 'https://example.test/normal.png', large: '', png: '' }
    });
    expect(getCardImageUrl(card)).toBe('https://example.test/selected.png');
  });

  it('falls back to the normal image when no gatherer image exists', () => {
    const card = makeCard({
      image_uris: { small: '', normal: 'https://example.test/normal.png', large: '', png: '' }
    });
    expect(getCardImageUrl(card)).toBe('https://example.test/normal.png');
  });

  it('builds a Scryfall named endpoint for basic lands with no image', () => {
    const card = makeCard({ name: 'Forest', image_uris: undefined, card_faces: undefined });
    expect(getCardImageUrl(card)).toBe('https://api.scryfall.com/cards/named?exact=forest&format=image');
  });

  it('returns an empty string when no image and not a basic land', () => {
    const card = makeCard({ name: 'Nonbasic Thing', image_uris: undefined, card_faces: undefined });
    expect(getCardImageUrl(card)).toBe('');
  });
});
