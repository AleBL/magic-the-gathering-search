import { describe, expect, it } from 'vitest';
import { makeCard } from '../../test/factories';
import { PlaytestCard } from '../../types/Playtest';
import { PlaytestZone } from '../../types/enums';
import {
  applyZoneTransform,
  dealOpeningHand,
  insertIntoZone,
  OPENING_HAND_SIZE,
  playtestCardName,
  shufflePlaytestCards,
  startingLifeTotal,
  toPlaytestCards
} from '../playtestBoard';

const deckOf = (count: number) => Array.from({ length: count }, (_, i) => makeCard({ id: `deck-${i}` }));

const playtestCard = (overrides: Partial<PlaytestCard> = {}): PlaytestCard => ({
  playtestId: 'p-1',
  card: makeCard(),
  isTapped: false,
  ...overrides
});

describe('playtestCardName', () => {
  it('prefers the printed name over the English one', () => {
    const item = playtestCard({ card: makeCard({ name: 'Lightning Bolt', printed_name: 'Raio' }) });
    expect(playtestCardName(item)).toBe('Raio');
  });

  it('falls back to the English name when there is no printed name', () => {
    const item = playtestCard({ card: makeCard({ name: 'Lightning Bolt', printed_name: undefined }) });
    expect(playtestCardName(item)).toBe('Lightning Bolt');
  });
});

describe('startingLifeTotal', () => {
  it('starts commander games at 40', () => {
    expect(startingLifeTotal('commander')).toBe(40);
  });

  it('starts every other format at 20', () => {
    expect(startingLifeTotal('modern')).toBe(20);
    expect(startingLifeTotal()).toBe(20);
  });
});

describe('toPlaytestCards', () => {
  it('hides every card and gives each copy its own tracking id', () => {
    const sameCard = makeCard({ id: 'repeat' });
    const items = toPlaytestCards([sameCard, sameCard]);

    expect(items).toHaveLength(2);
    expect(items[0].playtestId).not.toBe(items[1].playtestId);
    expect(items.every((item) => item.isFaceDown && !item.isTapped && item.counters === 0)).toBe(true);
  });
});

describe('shufflePlaytestCards', () => {
  it('preserves the exact set of cards and leaves the input untouched', () => {
    const items = toPlaytestCards(deckOf(20));
    const original = items.map((item) => item.playtestId);

    const shuffled = shufflePlaytestCards(items);

    expect(shuffled.map((item) => item.playtestId).sort()).toEqual([...original].sort());
    expect(items.map((item) => item.playtestId)).toEqual(original);
  });
});

describe('dealOpeningHand', () => {
  it('deals seven face-up cards and hides the rest in the library', () => {
    const { hand, library } = dealOpeningHand(deckOf(20));

    expect(hand).toHaveLength(OPENING_HAND_SIZE);
    expect(library).toHaveLength(13);
    expect(hand.every((item) => item.isFaceDown === false)).toBe(true);
    expect(library.every((item) => item.isFaceDown === true)).toBe(true);
  });

  it('deals a short deck entirely to the hand', () => {
    const { hand, library } = dealOpeningHand(deckOf(3));

    expect(hand).toHaveLength(3);
    expect(library).toHaveLength(0);
  });
});

describe('applyZoneTransform', () => {
  it('hides and untaps a card entering the library', () => {
    const item = playtestCard({ isTapped: true, isFaceDown: false });
    expect(applyZoneTransform(item, PlaytestZone.LIBRARY)).toMatchObject({ isTapped: false, isFaceDown: true });
  });

  it('reveals and untaps a card entering any other zone', () => {
    const item = playtestCard({ isTapped: true, isFaceDown: true });
    expect(applyZoneTransform(item, PlaytestZone.GRAVEYARD)).toMatchObject({ isTapped: false, isFaceDown: false });
  });

  it('restores the whole double-faced card when it leaves the battlefield', () => {
    const front = makeCard({ id: 'front', name: 'Delver of Secrets' });
    const whole = makeCard({ id: 'whole', name: 'Delver of Secrets // Insectile Aberration' });
    const played = playtestCard({ card: front, baseCard: whole });

    const returned = applyZoneTransform(played, PlaytestZone.HAND);

    expect(returned.card).toBe(whole);
    expect(returned.baseCard).toBeUndefined();
  });

  it('keeps the chosen face while the card stays on the battlefield', () => {
    const front = makeCard({ id: 'front' });
    const whole = makeCard({ id: 'whole' });
    const played = playtestCard({ card: front, baseCard: whole });

    expect(applyZoneTransform(played, PlaytestZone.BATTLEFIELD).card).toBe(front);
  });
});

describe('insertIntoZone', () => {
  const zone: PlaytestCard[] = [
    playtestCard({ playtestId: 'a' }),
    playtestCard({ playtestId: 'b' }),
    playtestCard({ playtestId: 'c' })
  ];
  const entering = playtestCard({ playtestId: 'new' });
  const ids = (items: PlaytestCard[]) => items.map((item) => item.playtestId);

  it('puts a card on top of the library', () => {
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.LIBRARY, 'top'))).toEqual(['new', 'a', 'b', 'c']);
  });

  it('puts a card at the bottom of the library', () => {
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.LIBRARY, 'bottom'))).toEqual(['a', 'b', 'c', 'new']);
  });

  it('puts a card at a numeric library position', () => {
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.LIBRARY, 2))).toEqual(['a', 'b', 'new', 'c']);
  });

  it('clamps a library position past either end', () => {
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.LIBRARY, 99))).toEqual(['a', 'b', 'c', 'new']);
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.LIBRARY, -5))).toEqual(['new', 'a', 'b', 'c']);
  });

  it('stacks graveyard and exile newest first', () => {
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.GRAVEYARD, 'top'))).toEqual(['new', 'a', 'b', 'c']);
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.EXILE, 'top'))).toEqual(['new', 'a', 'b', 'c']);
  });

  it('appends to the hand and the battlefield', () => {
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.HAND, 'top'))).toEqual(['a', 'b', 'c', 'new']);
    expect(ids(insertIntoZone(zone, entering, PlaytestZone.BATTLEFIELD, 'top'))).toEqual(['a', 'b', 'c', 'new']);
  });

  it('never leaves a duplicate of the card it inserts', () => {
    const withDuplicate = [...zone, playtestCard({ playtestId: 'new' })];
    expect(ids(insertIntoZone(withDuplicate, entering, PlaytestZone.HAND, 'top'))).toEqual(['a', 'b', 'c', 'new']);
  });
});
