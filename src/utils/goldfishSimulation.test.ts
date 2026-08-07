import { describe, expect, it } from 'vitest';
import { simulateGoldfish } from './goldfishSimulation';
import { Card } from '../types/Card';
import { makeCard } from '../test/factories';

const mountain = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) =>
    makeCard({ id: `mtn-${i}`, name: 'Mountain', type_line: 'Basic Land — Mountain', cmc: 0, mana_cost: '' })
  );

const spell = (n: number, cmc: number, manaCost: string): Card[] =>
  Array.from({ length: n }, (_, i) =>
    makeCard({ id: `spell-${cmc}-${i}`, name: `Spell ${cmc}`, type_line: 'Instant', cmc, mana_cost: manaCost })
  );

describe('simulateGoldfish', () => {
  it('returns nothing for a deck too small to deal an opening hand', () => {
    expect(simulateGoldfish(mountain(6))).toBeNull();
  });

  it('is reproducible for a given seed, and varies without one', () => {
    const deck = [...mountain(24), ...spell(36, 3, '{2}{R}')];
    const a = simulateGoldfish(deck, { runs: 50, seed: 7 });
    const b = simulateGoldfish(deck, { runs: 50, seed: 7 });
    const c = simulateGoldfish(deck, { runs: 50, seed: 8 });

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  // An all-land deck plays exactly one land per turn, so the milestones are arithmetic.
  it('reaches land milestones on schedule when every card is a land', () => {
    const result = simulateGoldfish(mountain(60), { runs: 30, seed: 1, turns: 8 });

    expect(result?.landMilestones.find((m) => m.lands === 3)?.medianTurn).toBe(3);
    expect(result?.landMilestones.find((m) => m.lands === 5)?.medianTurn).toBe(5);
    expect(result?.screwRate).toBe(0);
  });

  // Nothing castable ever, so no turn can be on curve — and no hand is keepable, which is
  // what caps mulligans instead of looping forever.
  it('reports no on-curve turns for a deck with no lands', () => {
    const result = simulateGoldfish(spell(60, 3, '{2}{R}'), { runs: 20, seed: 3 });

    expect(result?.onCurveShare).toBe(0);
    expect(result?.mulliganRate).toBe(1);
    expect(result?.keptHandSizes.every(({ size }) => size <= 7)).toBe(true);
  });

  it('will not cast a spell whose color no land produces', () => {
    // Mountains cannot pay {U}, however many of them are on the battlefield.
    const result = simulateGoldfish([...mountain(30), ...spell(30, 1, '{U}')], { runs: 40, seed: 5 });

    expect(result?.onCurveShare).toBe(0);
  });

  it('casts on curve once the matching color is down', () => {
    const result = simulateGoldfish([...mountain(30), ...spell(30, 1, '{R}')], { runs: 40, seed: 5 });

    expect(result?.onCurveShare).toBeGreaterThan(0.5);
  });

  it('shares always describe the same number of games', () => {
    const result = simulateGoldfish([...mountain(24), ...spell(36, 2, '{1}{R}')], { runs: 100, seed: 11 });
    const handShareTotal = result!.keptHandSizes.reduce((sum, entry) => sum + entry.share, 0);

    expect(handShareTotal).toBeCloseTo(1, 10);
    expect(result!.screwRate).toBeGreaterThanOrEqual(0);
    expect(result!.screwRate).toBeLessThanOrEqual(1);
    expect(result!.onCurveShare).toBeLessThanOrEqual(1);
  });
});
