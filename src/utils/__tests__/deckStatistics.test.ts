import { describe, expect, it } from 'vitest';
import {
  computeDeckStatistics,
  landDrawProbabilities,
  hypergeometricExactly,
  hypergeometricAtLeast,
  cardsSeenByTurn
} from '../deckStatistics';
import { makeCard } from '../../test/factories';
import { Card } from '../../types/Card';

/** A non-land spell with the given mana cost. */
const spell = (mana_cost: string, overrides: Partial<Card> = {}): Card =>
  makeCard({
    type_line: 'Creature — Test',
    mana_cost,
    colors: [],
    color_identity: [],
    ...overrides
  });

const basicLand = (name: string, overrides: Partial<Card> = {}): Card =>
  makeCard({
    name,
    printed_name: name,
    type_line: `Basic Land — ${name}`,
    mana_cost: '',
    cmc: 0,
    colors: [],
    color_identity: [],
    ...overrides
  });

const spells = (n: number, mana_cost: string, overrides: Partial<Card> = {}): Card[] =>
  Array.from({ length: n }, (_, i) => spell(mana_cost, { name: `Spell ${mana_cost} ${i}`, ...overrides }));

describe('computeDeckStatistics — colorless ({C}) and Wastes support', () => {
  it('counts {C} pips in manaColorSymbolCounts.C', () => {
    const deck = [spell('{2}{C}'), spell('{C}{C}{R}')];
    const stats = computeDeckStatistics(deck);
    expect(stats.manaColorSymbolCounts.C).toBe(3);
    expect(stats.manaColorSymbolCounts.R).toBe(1);
  });

  it('does not count generic numeric costs or snow mana as colorless pips', () => {
    const deck = [spell('{2}{R}'), spell('{X}{S}{G}')];
    const stats = computeDeckStatistics(deck);
    expect(stats.manaColorSymbolCounts.C).toBe(0);
  });

  it('reads pips from card_faces for double-faced cards with no top-level mana_cost', () => {
    // Transform/modal DFCs carry mana_cost per face on Scryfall — the
    // top-level field is '' — so a plain card.mana_cost read misses the pips.
    const dfc = spell('', {
      card_faces: [
        { name: 'Front', mana_cost: '{3}{B}{B}', type_line: 'Creature' },
        { name: 'Back', mana_cost: '', type_line: 'Creature' }
      ]
    });
    const stats = computeDeckStatistics([dfc]);
    expect(stats.manaColorSymbolCounts.B).toBe(2);
  });

  it('counts pips for a transform card whose back face is a Land (e.g. Aclazotz, Deepest Betrayal)', () => {
    // Scryfall's top-level type_line joins both faces with "//", so this
    // reads as "Legendary Creature — Bat God // Land" — a naive
    // type_line.includes('land') check would wrongly treat the whole card as
    // a land and drop it out of nonLandCards before its pips are ever read.
    const dfc = spell('', {
      type_line: 'Legendary Creature — Bat God // Land',
      card_faces: [
        { name: 'Aclazotz, Deepest Betrayal', mana_cost: '{3}{B}{B}', type_line: 'Legendary Creature — Bat God' },
        { name: 'Temple of the Dead', mana_cost: '', type_line: 'Land' }
      ]
    });
    const stats = computeDeckStatistics([dfc]);
    expect(stats.manaColorSymbolCounts.B).toBe(2);
    expect(stats.totalLands).toBe(0);
    expect(stats.cardTypeCounts.creature).toBe(1);
    // The front face's color must show up in the distribution chart, and the
    // land back face must not make the whole card register as colorless.
    expect(stats.colorDistributionCounts.B).toBe(1);
    expect(stats.colorDistributionCounts.C).toBe(0);
  });

  it('treats Wastes as a basic land when counting the existing mana base', () => {
    // 6 spells → target lands = floor(6 * 2/3) = 4; 4 Wastes already fully cover it.
    const deck = [
      ...spells(6, '{2}{C}'),
      ...Array.from({ length: 4 }, (_, i) => basicLand('Wastes', { id: `wastes-${i}` }))
    ];
    const stats = computeDeckStatistics(deck);
    expect(stats.neededBasicLands).toBe(0);
  });

  it('counts Wastes as a colorless mana source in landColorCounts.C', () => {
    const deck = [spell('{C}'), basicLand('Wastes')];
    const stats = computeDeckStatistics(deck);
    expect(stats.landColorCounts.C).toBe(1);
  });

  it('counts non-basic lands that only add {C} as colorless sources', () => {
    const deck = [
      spell('{C}'),
      makeCard({
        name: 'Crystal Vein',
        type_line: 'Land',
        mana_cost: '',
        colors: [],
        color_identity: [],
        oracle_text: '{T}: Add {C}.'
      })
    ];
    const stats = computeDeckStatistics(deck);
    expect(stats.landColorCounts.C).toBe(1);
  });

  it('suggests Wastes for decks whose spells require {C}', () => {
    const deck = spells(9, '{1}{C}');
    const stats = computeDeckStatistics(deck);
    expect(stats.suggestedBasicLandCounts.Wastes).toBeGreaterThan(0);
  });

  it('splits suggestions between Wastes and colored basics when {C} and colored pips coexist', () => {
    const deck = [...spells(6, '{C}{C}'), ...spells(6, '{R}{R}')];
    const stats = computeDeckStatistics(deck);
    expect(stats.suggestedBasicLandCounts.Wastes).toBeGreaterThan(0);
    expect(stats.suggestedBasicLandCounts.Mountain).toBeGreaterThan(0);
  });
});

describe('computeDeckStatistics — mana base optimizer floors and rounding', () => {
  it('recommends at least one red source for a deck with a single red card and no lands', () => {
    const deck = [spell('{R}', { name: 'Lone Bolt' })];
    const stats = computeDeckStatistics(deck);
    expect(stats.suggestedBasicLandCounts.Mountain).toBeGreaterThanOrEqual(1);
    expect(stats.neededBasicLands).toBeGreaterThanOrEqual(1);
  });

  it('never allocates zero sources to a color that appears in the deck (minimum floor)', () => {
    // 19 W pips vs a single G pip: proportional rounding alone would give G zero.
    const deck = [...spells(19, '{W}'), spell('{G}', { name: 'Lone Elf' })];
    const stats = computeDeckStatistics(deck);
    expect(stats.suggestedBasicLandCounts.Forest).toBeGreaterThanOrEqual(1);
    expect(stats.suggestedBasicLandCounts.Plains).toBeGreaterThanOrEqual(1);
  });

  it('allocates exactly neededBasicLands lands in total', () => {
    const deck = [...spells(10, '{W}{U}'), ...spells(5, '{B}'), ...spells(3, '{R}'), spell('{G}')];
    const stats = computeDeckStatistics(deck);
    const totalSuggested = Object.values(stats.suggestedBasicLandCounts).reduce((a, b) => a + b, 0);
    expect(totalSuggested).toBe(stats.neededBasicLands);
  });

  it('keeps allocations proportional: the dominant color receives the most lands', () => {
    const deck = [...spells(12, '{R}{R}'), ...spells(3, '{U}')];
    const stats = computeDeckStatistics(deck);
    expect(stats.suggestedBasicLandCounts.Mountain).toBeGreaterThan(stats.suggestedBasicLandCounts.Island);
    expect(stats.suggestedBasicLandCounts.Island).toBeGreaterThanOrEqual(1);
  });

  it('handles more colors than land slots by covering the most-demanded colors first', () => {
    // 2 spells → tiny target; five colors present. Sum must still match neededBasicLands
    // and no allocation may be negative.
    const deck = [spell('{W}{U}{B}{R}{G}'), spell('{R}{R}{R}')];
    const stats = computeDeckStatistics(deck);
    const counts = Object.values(stats.suggestedBasicLandCounts);
    expect(counts.every((c) => c >= 0)).toBe(true);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(stats.neededBasicLands);
    if (stats.neededBasicLands > 0) {
      expect(stats.suggestedBasicLandCounts.Mountain).toBeGreaterThanOrEqual(1);
    }
  });

  it('counts artifact/creature lands in totalLands (unlike the type breakdown)', () => {
    const deck = [
      spell('{R}'),
      makeCard({
        name: 'Darksteel Citadel',
        type_line: 'Artifact Land',
        mana_cost: '',
        colors: [],
        color_identity: []
      }),
      basicLand('Wastes')
    ];
    const stats = computeDeckStatistics(deck);
    expect(stats.totalLands).toBe(2);
  });

  it('returns all-zero suggestions for an empty deck without NaN or negatives', () => {
    const stats = computeDeckStatistics([]);
    expect(stats.neededBasicLands).toBe(0);
    expect(stats.targetTotalLands).toBe(0);
    Object.values(stats.suggestedBasicLandCounts).forEach((count) => {
      expect(Number.isFinite(count)).toBe(true);
      expect(count).toBe(0);
    });
  });

  it('suggests nothing when the existing mana base already meets the target', () => {
    const deck = [
      ...spells(6, '{R}'),
      ...Array.from({ length: 10 }, (_, i) => basicLand('Mountain', { id: `mtn-${i}` }))
    ];
    const stats = computeDeckStatistics(deck);
    expect(stats.neededBasicLands).toBe(0);
    const totalSuggested = Object.values(stats.suggestedBasicLandCounts).reduce((a, b) => a + b, 0);
    expect(totalSuggested).toBe(0);
  });

  it('still fills the whole remaining land budget when only one color is present', () => {
    const deck = spells(30, '{R}{R}');
    const stats = computeDeckStatistics(deck);
    expect(stats.suggestedBasicLandCounts.Mountain).toBe(stats.neededBasicLands);
    expect(stats.neededBasicLands).toBe(20);
  });
});

describe('hypergeometric helpers', () => {
  // Reference value: P(exactly 3 lands in an opening 7 from a 60-card / 24-land
  // deck) = C(24,3)·C(36,4)/C(60,7) ≈ 0.3087.
  it('landDrawProbabilities matches the known 60/24 opening-hand distribution', () => {
    const distribution = landDrawProbabilities(60, 24, 7);
    const at3 = distribution.find((d) => d.lands === 3);
    expect(at3?.prob).toBeCloseTo(0.3087, 3);
    const total = distribution.reduce((sum, d) => sum + d.prob, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('hypergeometricExactly agrees with landDrawProbabilities term by term', () => {
    for (let k = 0; k <= 7; k++) {
      const fromArray = landDrawProbabilities(60, 24, 7).find((d) => d.lands === k)?.prob ?? 0;
      expect(hypergeometricExactly(60, 24, 7, k)).toBeCloseTo(fromArray, 10);
    }
  });

  it('hypergeometricExactly returns 0 for impossible draws', () => {
    expect(hypergeometricExactly(60, 24, 7, 8)).toBe(0); // more successes than cards drawn
    expect(hypergeometricExactly(60, 24, 7, 25)).toBe(0); // more than exist
    expect(hypergeometricExactly(60, 24, 7, -1)).toBe(0);
    expect(hypergeometricExactly(0, 0, 7, 0)).toBe(0);
  });

  it('hypergeometricAtLeast equals the summed tail of the exact distribution', () => {
    // P(≥1 source of a color with 14 sources in a 60-card deck, opening 7).
    const tail =
      hypergeometricExactly(60, 14, 7, 1) +
      Array.from({ length: 6 }, (_, i) => hypergeometricExactly(60, 14, 7, i + 2)).reduce((a, b) => a + b, 0);
    expect(hypergeometricAtLeast(60, 14, 7, 1)).toBeCloseTo(tail, 10);
  });

  it('hypergeometricAtLeast(≥1) is the complement of drawing none', () => {
    const none = hypergeometricExactly(60, 14, 7, 0);
    expect(hypergeometricAtLeast(60, 14, 7, 1)).toBeCloseTo(1 - none, 10);
  });

  it('hypergeometricAtLeast handles the k=0 and impossible edges', () => {
    expect(hypergeometricAtLeast(60, 14, 7, 0)).toBe(1);
    expect(hypergeometricAtLeast(0, 0, 7, 1)).toBe(0);
    expect(hypergeometricAtLeast(60, 0, 7, 1)).toBe(0); // no sources ⇒ never draw one
  });

  it('more sources strictly increase the odds of seeing at least one', () => {
    const odds = [8, 12, 16, 20].map((sources) => hypergeometricAtLeast(60, sources, 7, 1));
    for (let i = 1; i < odds.length; i++) {
      expect(odds[i]).toBeGreaterThan(odds[i - 1]);
    }
  });

  it('cardsSeenByTurn counts the opening 7 plus draws (on the play vs. draw)', () => {
    expect(cardsSeenByTurn(1)).toBe(7); // on the play, no turn-1 draw
    expect(cardsSeenByTurn(3)).toBe(9);
    expect(cardsSeenByTurn(1, false)).toBe(8); // on the draw
    expect(cardsSeenByTurn(3, false)).toBe(10);
  });
});

describe('computeDeckStatistics — most expensive cards', () => {
  const priced = (name: string, usd: string): Card => spell('{1}{R}', { name, prices: { usd } });

  it('ranks by price and keeps one row per card name', () => {
    const deck = [
      priced('Cheap', '1.00'),
      priced('Expensive', '50.00'),
      priced('Expensive', '50.00'),
      priced('Expensive', '50.00'),
      priced('Middling', '10.00'),
      priced('Modest', '5.00')
    ];

    const { mostExpensiveCards } = computeDeckStatistics(deck);

    expect(mostExpensiveCards.map((card) => card.name)).toEqual(['Expensive', 'Middling', 'Modest']);
  });

  it('ignores cards with no USD price', () => {
    const deck = [priced('Priced', '3.00'), spell('{1}{R}', { name: 'Unpriced', prices: undefined })];

    expect(computeDeckStatistics(deck).mostExpensiveCards.map((card) => card.name)).toEqual(['Priced']);
  });
});
