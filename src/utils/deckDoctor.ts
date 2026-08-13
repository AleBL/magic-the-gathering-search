import { Card } from '../types/Card';
import {
  DeckStatistics,
  ManaColor,
  MANA_COLORS,
  computeDeckStatistics,
  isLandCard,
  landDrawProbabilities,
  hypergeometricAtLeast,
  cardsSeenByTurn
} from './deckStatistics';

/**
 * Deck Doctor — a higher-level synthesis on top of {@link computeDeckStatistics}.
 * It never invents card data Scryfall doesn't provide: every number here derives
 * from the deck's own type lines, mana costs and pip/source counts.
 *
 * The math (hypergeometric odds, opening-hand simulation, source counting) lives in
 * pure functions so it can be unit-tested without React. The UI turns the
 * structured {@link DeckRecommendation}s into localized natural-language advice.
 */

const OPENING_HAND_SIZE = 7;
/** A hand with 2–5 lands is generally keepable (same band as ConsistencyPanel). */
export const KEEPABLE_MIN_LANDS = 2;
export const KEEPABLE_MAX_LANDS = 5;
/** ≥6 lands in the opener is a flood; <2 is a mana screw; 0 is a true no-lander. */
const FLOOD_MIN_LANDS = 6;
const SCREW_MAX_LANDS = 1;

const DEFAULT_GOLDFISH_ITERATIONS = 1000;

// --- Deterministic RNG (for reproducible simulation tests) -----------------

/** mulberry32 — a tiny seedable PRNG. Same seed ⇒ same hand sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Linear score in [0,1]: 0 at or below `lo`, 1 at or above `hi`. */
const bandScore = (value: number, lo: number, hi: number): number =>
  hi <= lo ? 0 : clamp((value - lo) / (hi - lo), 0, 1);

// --- Goldfish simulation ----------------------------------------------------

/** A minimal per-card model — the only fields the simulation actually reads. */
interface DeckCardModel {
  isLand: boolean;
  cmc: number;
}

export interface OpeningHandsResult {
  iterations: number;
  /** Fraction of hands with 2–5 lands. */
  playableRate: number;
  /** Fraction of hands with 0 lands (true no-lander). */
  noLandRate: number;
  /** Fraction of hands with <2 lands (mana screw). */
  screwRate: number;
  /** Fraction of hands with ≥6 lands (flood). */
  floodRate: number;
  avgLandsInHand: number;
  /** Average CMC of the non-land cards drawn — a read on the curve you actually see. */
  avgCurve: number;
}

/** Non-commander cards, reduced to the {@link DeckCardModel} the simulation needs. */
function toDeckModel(cards: Card[]): DeckCardModel[] {
  return cards.filter((card) => !card.isCommander).map((card) => ({ isLand: isLandCard(card), cmc: card.cmc || 0 }));
}

/**
 * Monte-Carlo over **opening hands only**: shuffle (Fisher–Yates, mirroring
 * usePlaytestSimulator) and deal `handSize`, `iterations` times. No mulligans, no colors and
 * no turns — for those, see `playoutSimulation.simulatePlayout`, which plays the game out.
 * Pass a seeded `rng` for reproducible results.
 */
export function simulateOpeningHands(
  cards: Card[],
  options: { iterations?: number; handSize?: number; rng?: () => number } = {}
): OpeningHandsResult {
  const iterations = options.iterations ?? DEFAULT_GOLDFISH_ITERATIONS;
  const handSize = options.handSize ?? OPENING_HAND_SIZE;
  const rng = options.rng ?? Math.random;
  const deck = toDeckModel(cards);

  const empty: OpeningHandsResult = {
    iterations: 0,
    playableRate: 0,
    noLandRate: 0,
    screwRate: 0,
    floodRate: 0,
    avgLandsInHand: 0,
    avgCurve: 0
  };
  if (deck.length < handSize || iterations <= 0) return empty;

  let playable = 0;
  let noLand = 0;
  let screw = 0;
  let flood = 0;
  let totalLands = 0;
  let totalSpellCmc = 0;
  let totalSpells = 0;

  for (let i = 0; i < iterations; i++) {
    const hand = shuffle(deck, rng).slice(0, handSize);
    let lands = 0;
    for (const card of hand) {
      if (card.isLand) {
        lands++;
      } else {
        totalSpellCmc += card.cmc;
        totalSpells++;
      }
    }
    totalLands += lands;
    if (lands >= KEEPABLE_MIN_LANDS && lands <= KEEPABLE_MAX_LANDS) playable++;
    if (lands === 0) noLand++;
    if (lands <= SCREW_MAX_LANDS) screw++;
    if (lands >= FLOOD_MIN_LANDS) flood++;
  }

  return {
    iterations,
    playableRate: playable / iterations,
    noLandRate: noLand / iterations,
    screwRate: screw / iterations,
    floodRate: flood / iterations,
    avgLandsInHand: totalLands / iterations,
    avgCurve: totalSpells > 0 ? totalSpellCmc / totalSpells : 0
  };
}

// --- Color source diagnosis -------------------------------------------------

export interface ColorSourceDiagnosis {
  color: ManaColor;
  /** Colored pips this color's spells demand across the deck. */
  pips: number;
  /** Lands that can produce this color. */
  sources: number;
  /** Proportional target sources for the deck's land count and pip mix. */
  idealSources: number;
  /** Hypergeometric P(≥1 source of this color in the opening hand). */
  openingHandProb: number;
  /** idealSources − sources, floored at 0. */
  deficit: number;
}

/**
 * For every color the deck actually demands, compares available sources against
 * a target proportional to that color's share of the pips, and computes the
 * concrete odds of seeing a source in the opening hand.
 */
export function diagnoseColorSources(stats: DeckStatistics): ColorSourceDiagnosis[] {
  const { manaColorSymbolCounts, landColorCounts, targetTotalLands, totalCards } = stats;
  const activeColors = MANA_COLORS.filter((color) => manaColorSymbolCounts[color] > 0);
  const totalPips = activeColors.reduce((sum, color) => sum + manaColorSymbolCounts[color], 0);

  return activeColors.map((color) => {
    const pips = manaColorSymbolCounts[color];
    const sources = landColorCounts[color] || 0;
    // Each demanded color earns at least one source; the rest split by pip share.
    const idealSources = totalPips > 0 ? Math.max(1, Math.round((pips / totalPips) * targetTotalLands)) : 0;
    const openingHandProb = hypergeometricAtLeast(totalCards, sources, OPENING_HAND_SIZE, 1);
    return {
      color,
      pips,
      sources,
      idealSources,
      openingHandProb,
      deficit: Math.max(0, idealSources - sources)
    };
  });
}

// --- Consistency score ------------------------------------------------------

export interface ScoreComponent {
  key: 'manaRatio' | 'keepableHands' | 'colorSources';
  score: number;
  max: number;
  /** Raw value behind the score (a probability or ratio), for an explainable note. */
  value: number;
}

export interface ConsistencyScore {
  total: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  components: ScoreComponent[];
}

const MANA_RATIO_MAX = 30;
const KEEPABLE_MAX = 40;
const COLOR_SOURCES_MAX = 30;

function ratingFor(total: number): ConsistencyScore['rating'] {
  if (total >= 80) return 'excellent';
  if (total >= 60) return 'good';
  if (total >= 40) return 'fair';
  return 'poor';
}

/**
 * A transparent 0–100 consistency score. Every point is attributable to one of
 * three components (mana ratio, keepable openers, color sources) so the UI can
 * show the breakdown rather than a black-box number.
 */
export function computeConsistencyScore(stats: DeckStatistics, colorSources: ColorSourceDiagnosis[]): ConsistencyScore {
  const { totalLands, targetTotalLands, totalCards } = stats;

  // 1. Mana ratio — how close the land count sits to the curve-derived target.
  const ratioValue =
    targetTotalLands > 0 ? 1 - Math.min(1, Math.abs(totalLands - targetTotalLands) / targetTotalLands) : 0;
  const manaRatio: ScoreComponent = {
    key: 'manaRatio',
    score: MANA_RATIO_MAX * ratioValue,
    max: MANA_RATIO_MAX,
    value: ratioValue
  };

  // 2. Keepable openers — hypergeometric P(2–5 lands in the opening 7).
  const distribution = landDrawProbabilities(totalCards, totalLands, OPENING_HAND_SIZE);
  const keepable = distribution
    .filter((d) => d.lands >= KEEPABLE_MIN_LANDS && d.lands <= KEEPABLE_MAX_LANDS)
    .reduce((sum, d) => sum + d.prob, 0);
  const keepableHands: ScoreComponent = {
    key: 'keepableHands',
    score: KEEPABLE_MAX * bandScore(keepable, 0.45, 0.82),
    max: KEEPABLE_MAX,
    value: keepable
  };

  // 3. Color sources — average odds of seeing a source of each demanded color.
  const colorValue =
    colorSources.length === 0
      ? 1 // no colored requirement ⇒ no color risk
      : colorSources.reduce((sum, c) => sum + bandScore(c.openingHandProb, 0.55, 0.92), 0) / colorSources.length;
  const colorScore: ScoreComponent = {
    key: 'colorSources',
    score: COLOR_SOURCES_MAX * colorValue,
    max: COLOR_SOURCES_MAX,
    value: colorValue
  };

  const components = [manaRatio, keepableHands, colorScore];
  const total = Math.round(components.reduce((sum, c) => sum + c.score, 0));
  return { total, rating: ratingFor(total), components };
}

// --- Recommendations --------------------------------------------------------

export type RecommendationKind =
  | 'add-lands'
  | 'cut-lands'
  | 'add-source'
  | 'curve-heavy'
  | 'screw-risk'
  | 'flood-risk'
  | 'balanced';

export type RecommendationSeverity = 'critical' | 'warning' | 'info' | 'good';

export interface DeckRecommendation {
  id: string;
  kind: RecommendationKind;
  severity: RecommendationSeverity;
  color?: ManaColor;
  /** Suggested amount, or the low end of a range. */
  count?: number;
  /** High end of a suggested range (e.g. "1–2 sources"). */
  countHigh?: number;
  /** The heavy mana-value slot, for curve advice. */
  cmc?: number;
  /** A percentage, for screw/flood risk. */
  percent?: number;
}

const SEVERITY_ORDER: Record<RecommendationSeverity, number> = { critical: 0, warning: 1, info: 2, good: 3 };

/** Numeric key of the heaviest mana-value slot, treating "7+" as 7. */
function heaviestCurveSlot(counts: Record<number | string, number>): { cmc: number; count: number } {
  let best = { cmc: 0, count: -1 };
  for (const [key, count] of Object.entries(counts)) {
    const cmc = key === '7+' ? 7 : Number(key);
    if (count > best.count) best = { cmc, count };
  }
  return best;
}

/**
 * Turns the analysis into a ranked list of structured recommendations. The
 * descriptors are i18n-free on purpose — the UI composes the localized sentence
 * (including color names) so this stays unit-testable.
 */
export function buildRecommendations(
  stats: DeckStatistics,
  colorSources: ColorSourceDiagnosis[],
  screwProb: number,
  floodProb: number
): DeckRecommendation[] {
  const recs: DeckRecommendation[] = [];
  const { totalLands, targetTotalLands, convertedManaCostCounts, totalNonBasicCards } = stats;
  const nonLandSpells = Object.values(convertedManaCostCounts).reduce((sum, count) => sum + count, 0);

  // Land count vs. curve-derived target.
  const landDelta = targetTotalLands - totalLands;
  if (landDelta >= 2) {
    recs.push({
      id: 'add-lands',
      kind: 'add-lands',
      severity: landDelta >= 5 ? 'critical' : 'warning',
      count: landDelta
    });
  } else if (landDelta <= -2) {
    recs.push({ id: 'cut-lands', kind: 'cut-lands', severity: 'warning', count: -landDelta });
  }

  // Per-color source deficits.
  for (const diag of colorSources) {
    if (diag.deficit >= 1) {
      recs.push({
        id: `add-source-${diag.color}`,
        kind: 'add-source',
        severity: diag.openingHandProb < 0.6 ? 'critical' : 'warning',
        color: diag.color,
        count: diag.deficit,
        countHigh: diag.deficit + 1
      });
    }
  }

  // Curve shape — flag a heavy top-end slot.
  if (nonLandSpells > 0) {
    const peak = heaviestCurveSlot(convertedManaCostCounts);
    if (peak.cmc >= 4 && peak.count / nonLandSpells >= 0.2) {
      recs.push({ id: 'curve-heavy', kind: 'curve-heavy', severity: 'info', cmc: peak.cmc });
    }
  }

  // Opening-hand risk from exact hypergeometric odds.
  if (screwProb >= 0.22) {
    recs.push({ id: 'screw-risk', kind: 'screw-risk', severity: 'warning', percent: Math.round(screwProb * 100) });
  }
  if (floodProb >= 0.18) {
    recs.push({ id: 'flood-risk', kind: 'flood-risk', severity: 'warning', percent: Math.round(floodProb * 100) });
  }

  const hasIssue = recs.some((r) => r.severity !== 'good');
  if (!hasIssue && totalNonBasicCards > 0) {
    recs.push({ id: 'balanced', kind: 'balanced', severity: 'good' });
  }

  return recs.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// --- Top-level report -------------------------------------------------------

export interface LandOdds {
  keepableProb: number;
  expectedLands: number;
  noLandProb: number;
  screwProb: number;
  floodProb: number;
  /** P(≥`lands` lands) after the opening hand plus a few draws, per milestone turn. */
  byTurn: { turn: number; lands: number; prob: number }[];
}

export interface DeckDoctorReport {
  hasData: boolean;
  stats: DeckStatistics;
  score: ConsistencyScore;
  colorSources: ColorSourceDiagnosis[];
  landOdds: LandOdds;
  openingHands: OpeningHandsResult;
  recommendations: DeckRecommendation[];
}

/** Milestone turns whose land odds the panel surfaces (on the play). */
const TURN_MILESTONES = [
  { turn: 3, lands: 3 },
  { turn: 5, lands: 4 }
] as const;

function computeLandOdds(deckSize: number, landCount: number): LandOdds {
  const distribution = landDrawProbabilities(deckSize, landCount, OPENING_HAND_SIZE);
  const probFor = (predicate: (lands: number) => boolean) =>
    distribution.filter((d) => predicate(d.lands)).reduce((sum, d) => sum + d.prob, 0);

  return {
    keepableProb: probFor((l) => l >= KEEPABLE_MIN_LANDS && l <= KEEPABLE_MAX_LANDS),
    expectedLands: deckSize > 0 ? (OPENING_HAND_SIZE * landCount) / deckSize : 0,
    noLandProb: probFor((l) => l === 0),
    screwProb: probFor((l) => l <= SCREW_MAX_LANDS),
    floodProb: probFor((l) => l >= FLOOD_MIN_LANDS),
    byTurn: TURN_MILESTONES.map(({ turn, lands }) => ({
      turn,
      lands,
      prob: hypergeometricAtLeast(deckSize, landCount, cardsSeenByTurn(turn), lands)
    }))
  };
}

/**
 * Full Deck Doctor analysis. Deterministic apart from the opening-hands sub-object;
 * pass a seeded `rng` for reproducible results in tests.
 */
export function analyzeDeck(
  cards: Card[],
  options: { iterations?: number; rng?: () => number } = {}
): DeckDoctorReport {
  const stats = computeDeckStatistics(cards);
  const colorSources = diagnoseColorSources(stats);
  const landOdds = computeLandOdds(stats.totalCards, stats.totalLands);
  const score = computeConsistencyScore(stats, colorSources);
  const openingHands = simulateOpeningHands(cards, { iterations: options.iterations, rng: options.rng });
  const recommendations = buildRecommendations(stats, colorSources, landOdds.screwProb, landOdds.floodProb);

  // "Has data" once there is a real deck to reason about — a bare handful of
  // cards produces meaningless odds.
  const hasData = stats.totalNonBasicCards > 0 && cards.length >= OPENING_HAND_SIZE;

  return { hasData, stats, score, colorSources, landOdds, openingHands, recommendations };
}
