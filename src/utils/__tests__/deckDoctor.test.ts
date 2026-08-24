import { describe, expect, it } from 'vitest';
import {
  analyzeDeck,
  buildRecommendations,
  computeConsistencyScore,
  diagnoseColorSources,
  mulberry32,
  simulateOpeningHands
} from '../deckDoctor';
import { computeDeckStatistics } from '../deckStatistics';
import { makeCard } from '../../test/factories';
import { Card } from '../../types/Card';

const spell = (mana_cost: string, overrides: Partial<Card> = {}): Card =>
  makeCard({ type_line: 'Creature — Test', mana_cost, cmc: 1, colors: [], color_identity: [], ...overrides });

const spells = (n: number, mana_cost: string, overrides: Partial<Card> = {}): Card[] =>
  Array.from({ length: n }, (_, i) => spell(mana_cost, { name: `Spell ${mana_cost} ${i}`, ...overrides }));

const basicLand = (name: string, n = 1): Card[] =>
  Array.from({ length: n }, (_, i) =>
    makeCard({
      id: `${name}-${i}`,
      name,
      printed_name: name,
      type_line: `Basic Land — ${name}`,
      mana_cost: '',
      cmc: 0,
      colors: [],
      color_identity: []
    })
  );

/** A tuned mono-red 60: 36 one-drops + 24 Mountains. */
const monoRed60 = (): Card[] => [...spells(36, '{R}'), ...basicLand('Mountain', 24)];

describe('simulateOpeningHands', () => {
  it('is deterministic for a fixed seed', () => {
    const deck = monoRed60();
    const a = simulateOpeningHands(deck, { iterations: 500, rng: mulberry32(42) });
    const b = simulateOpeningHands(deck, { iterations: 500, rng: mulberry32(42) });
    expect(a).toEqual(b);
  });

  it('converges to the hypergeometric expected land count', () => {
    // 60-card / 24-land deck ⇒ expected lands in opener = 7 * 24 / 60 = 2.8.
    const result = simulateOpeningHands(monoRed60(), { iterations: 20000, rng: mulberry32(7) });
    expect(result.avgLandsInHand).toBeGreaterThan(2.65);
    expect(result.avgLandsInHand).toBeLessThan(2.95);
  });

  it('reports playable/screw/flood rates as complementary fractions', () => {
    const result = simulateOpeningHands(monoRed60(), { iterations: 5000, rng: mulberry32(1) });
    expect(result.playableRate).toBeGreaterThan(0.7); // 2–5 lands dominates
    expect(result.screwRate).toBeGreaterThan(0);
    expect(result.floodRate).toBeGreaterThanOrEqual(0);
    expect(result.playableRate).toBeLessThanOrEqual(1);
  });

  it('averages the curve over drawn non-land cards only', () => {
    // Every spell is a 3-drop, so the average curve of drawn spells must be 3.
    const deck = [...spells(36, '{R}', { cmc: 3 }), ...basicLand('Mountain', 24)];
    const result = simulateOpeningHands(deck, { iterations: 1000, rng: mulberry32(9) });
    expect(result.avgCurve).toBeCloseTo(3, 5);
  });

  it('returns an empty result when there are fewer cards than a hand', () => {
    const result = simulateOpeningHands(spells(4, '{R}'), { iterations: 100 });
    expect(result.iterations).toBe(0);
    expect(result.avgLandsInHand).toBe(0);
  });

  it('excludes commanders from the shuffled library', () => {
    const deck = [...spells(20, '{R}'), makeCard({ name: 'Cmdr', isCommander: true })];
    const result = simulateOpeningHands(deck, { iterations: 200, rng: mulberry32(3) });
    // No lands anywhere ⇒ every hand is a no-lander regardless of the commander.
    expect(result.noLandRate).toBe(1);
  });
});

describe('diagnoseColorSources', () => {
  it('only reports colors the deck actually demands', () => {
    const stats = computeDeckStatistics([...spells(12, '{R}'), ...basicLand('Mountain', 8), ...basicLand('Island', 5)]);
    const diag = diagnoseColorSources(stats);
    expect(diag.map((d) => d.color)).toEqual(['R']);
  });

  it('counts pips and sources and flags a deficit', () => {
    // Heavy green demand, almost no green sources.
    const stats = computeDeckStatistics([...spells(30, '{G}{G}'), ...basicLand('Forest', 3)]);
    const green = diagnoseColorSources(stats).find((d) => d.color === 'G');
    expect(green?.pips).toBe(60);
    expect(green?.sources).toBe(3);
    expect(green?.deficit).toBeGreaterThan(0);
    expect(green?.openingHandProb).toBeGreaterThan(0);
    expect(green?.openingHandProb).toBeLessThan(0.7);
  });

  it('shows no deficit when sources comfortably cover the pips', () => {
    const stats = computeDeckStatistics([...spells(12, '{R}'), ...basicLand('Mountain', 20)]);
    const red = diagnoseColorSources(stats).find((d) => d.color === 'R');
    expect(red?.deficit).toBe(0);
    expect(red?.openingHandProb).toBeGreaterThan(0.9);
  });
});

describe('computeConsistencyScore', () => {
  it('scores a well-tuned mono-color deck highly', () => {
    const stats = computeDeckStatistics(monoRed60());
    const score = computeConsistencyScore(stats, diagnoseColorSources(stats));
    expect(score.total).toBeGreaterThanOrEqual(80);
    expect(score.rating).toBe('excellent');
    expect(score.components).toHaveLength(3);
  });

  it('scores a landless deck poorly', () => {
    const stats = computeDeckStatistics(spells(60, '{R}'));
    const score = computeConsistencyScore(stats, diagnoseColorSources(stats));
    expect(score.total).toBeLessThan(40);
    expect(score.rating).toBe('poor');
  });

  it('keeps the total within 0–100 and equal to the sum of components', () => {
    const stats = computeDeckStatistics([
      ...spells(20, '{W}{U}'),
      ...basicLand('Plains', 8),
      ...basicLand('Island', 8)
    ]);
    const score = computeConsistencyScore(stats, diagnoseColorSources(stats));
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    const summed = Math.round(score.components.reduce((sum, c) => sum + c.score, 0));
    expect(score.total).toBe(summed);
    score.components.forEach((c) => {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(c.max);
    });
  });
});

describe('buildRecommendations', () => {
  it('recommends adding lands when the mana base is light', () => {
    const stats = computeDeckStatistics(spells(30, '{R}')); // 0 lands, target 20
    const recs = buildRecommendations(stats, diagnoseColorSources(stats), 1, 0);
    const addLands = recs.find((r) => r.kind === 'add-lands');
    expect(addLands).toBeDefined();
    expect(addLands?.count).toBeGreaterThan(0);
  });

  it('recommends cutting lands when there are far too many', () => {
    const stats = computeDeckStatistics([...spells(10, '{R}'), ...basicLand('Mountain', 30)]);
    const recs = buildRecommendations(stats, diagnoseColorSources(stats), 0, 0.5);
    expect(recs.some((r) => r.kind === 'cut-lands')).toBe(true);
  });

  it('recommends adding sources of an under-supported color', () => {
    const stats = computeDeckStatistics([...spells(30, '{G}{G}'), ...basicLand('Forest', 2)]);
    const recs = buildRecommendations(stats, diagnoseColorSources(stats), 0.1, 0);
    const addSource = recs.find((r) => r.kind === 'add-source' && r.color === 'G');
    expect(addSource).toBeDefined();
    expect(addSource?.countHigh).toBe((addSource?.count ?? 0) + 1);
  });

  it('flags a heavy top-end curve slot', () => {
    const stats = computeDeckStatistics([...spells(20, '{4}{R}', { cmc: 5 }), ...basicLand('Mountain', 16)]);
    const recs = buildRecommendations(stats, diagnoseColorSources(stats), 0, 0);
    const heavy = recs.find((r) => r.kind === 'curve-heavy');
    expect(heavy?.cmc).toBe(5);
  });

  it('raises screw and flood risks from the passed probabilities', () => {
    const stats = computeDeckStatistics(monoRed60());
    const recs = buildRecommendations(stats, diagnoseColorSources(stats), 0.3, 0.25);
    expect(recs.some((r) => r.kind === 'screw-risk' && r.percent === 30)).toBe(true);
    expect(recs.some((r) => r.kind === 'flood-risk' && r.percent === 25)).toBe(true);
  });

  it('returns a single balanced note for a healthy deck', () => {
    const stats = computeDeckStatistics(monoRed60());
    const recs = buildRecommendations(stats, diagnoseColorSources(stats), 0.1, 0.05);
    expect(recs).toHaveLength(1);
    expect(recs[0].kind).toBe('balanced');
    expect(recs[0].severity).toBe('good');
  });

  it('ranks critical recommendations ahead of warnings and info', () => {
    const stats = computeDeckStatistics(spells(30, '{G}{G}')); // no lands, heavy demand
    const recs = buildRecommendations(stats, diagnoseColorSources(stats), 0.4, 0);
    const severities = recs.map((r) => r.severity);
    const order = { critical: 0, warning: 1, info: 2, good: 3 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(order[severities[i]]).toBeGreaterThanOrEqual(order[severities[i - 1]]);
    }
  });
});

describe('analyzeDeck', () => {
  it('marks hasData false for a trivially small deck', () => {
    expect(analyzeDeck(spells(3, '{R}')).hasData).toBe(false);
  });

  it('produces a deterministic report for a fixed seed', () => {
    const deck = monoRed60();
    const a = analyzeDeck(deck, { iterations: 300, rng: mulberry32(11) });
    const b = analyzeDeck(deck, { iterations: 300, rng: mulberry32(11) });
    expect(a).toEqual(b);
  });

  it('ties the pieces together for a real deck', () => {
    const report = analyzeDeck(monoRed60(), { iterations: 500, rng: mulberry32(5) });
    expect(report.hasData).toBe(true);
    expect(report.score.total).toBeGreaterThan(0);
    expect(report.landOdds.keepableProb).toBeGreaterThan(0);
    expect(report.colorSources.some((c) => c.color === 'R')).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
