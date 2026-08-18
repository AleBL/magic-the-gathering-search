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

// Every number here derives from the deck's own type lines, mana costs and pip counts:
// nothing is inferred from card data Scryfall does not provide.

const OPENING_HAND_SIZE = 7;
export const KEEPABLE_MIN_LANDS = 2;
export const KEEPABLE_MAX_LANDS = 5;
const FLOOD_MIN_LANDS = 6;
const SCREW_MAX_LANDS = 1;

const DEFAULT_GOLDFISH_ITERATIONS = 1000;

/** Seedable PRNG: same seed, same sequence, which is what makes the simulation testable. */
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

interface DeckCardModel {
  isLand: boolean;
  cmc: number;
}

export interface OpeningHandsResult {
  iterations: number;
  playableRate: number;
  noLandRate: number;
  screwRate: number;
  floodRate: number;
  avgLandsInHand: number;
  /** Average mana value of the non-land cards drawn: the curve you actually see. */
  avgCurve: number;
}

function toDeckModel(cards: Card[]): DeckCardModel[] {
  return cards.filter((card) => !card.isCommander).map((card) => ({ isLand: isLandCard(card), cmc: card.cmc || 0 }));
}

// Opening hands only: no mulligans, no colors, no turns. Anything that needs the game
// played out belongs in `playoutSimulation.simulatePlayout` instead.
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

export interface ColorSourceDiagnosis {
  color: ManaColor;
  pips: number;
  sources: number;
  /** Target sources for this color, proportional to its share of the deck's pips. */
  idealSources: number;
  /** P(at least one source of this color in the opening hand). */
  openingHandProb: number;
  deficit: number;
}

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

// Scored 0–100 in three attributable components rather than one opaque number, because the
// panel shows the breakdown and a player has to be able to act on it.
export function computeConsistencyScore(stats: DeckStatistics, colorSources: ColorSourceDiagnosis[]): ConsistencyScore {
  const { totalLands, targetTotalLands, totalCards } = stats;

  // How close the land count sits to the curve-derived target, as a 0–1 closeness.
  const ratioValue =
    targetTotalLands > 0 ? 1 - Math.min(1, Math.abs(totalLands - targetTotalLands) / targetTotalLands) : 0;
  const manaRatio: ScoreComponent = {
    key: 'manaRatio',
    score: MANA_RATIO_MAX * ratioValue,
    max: MANA_RATIO_MAX,
    value: ratioValue
  };

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
  /** Suggested amount, or the low end of the range ending at `countHigh`. */
  count?: number;
  countHigh?: number;
  cmc?: number;
  /** Whole percentage points, for screw and flood risk. */
  percent?: number;
}

const SEVERITY_ORDER: Record<RecommendationSeverity, number> = { critical: 0, warning: 1, info: 2, good: 3 };

const TOP_HEAVY_MIN_CMC = 4;
const TOP_HEAVY_MIN_SHARE = 0.2;
const SCREW_RISK_THRESHOLD = 0.22;
const FLOOD_RISK_THRESHOLD = 0.18;

/** The most populated mana-value slot, with the "7+" bucket read as 7. */
function heaviestCurveSlot(counts: Record<number | string, number>): { cmc: number; count: number } {
  let best = { cmc: 0, count: -1 };
  for (const [key, count] of Object.entries(counts)) {
    const cmc = key === '7+' ? 7 : Number(key);
    if (count > best.count) best = { cmc, count };
  }
  return best;
}

// The recommendations carry no text on purpose: the UI composes the localized sentence from
// `kind` and the numbers, which is what keeps this function unit-testable in one language.
export function buildRecommendations(
  stats: DeckStatistics,
  colorSources: ColorSourceDiagnosis[],
  screwProb: number,
  floodProb: number
): DeckRecommendation[] {
  const recs: DeckRecommendation[] = [];
  const { totalLands, targetTotalLands, convertedManaCostCounts, totalNonBasicCards } = stats;
  const nonLandSpells = Object.values(convertedManaCostCounts).reduce((sum, count) => sum + count, 0);

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

  if (nonLandSpells > 0) {
    const peak = heaviestCurveSlot(convertedManaCostCounts);
    if (peak.cmc >= TOP_HEAVY_MIN_CMC && peak.count / nonLandSpells >= TOP_HEAVY_MIN_SHARE) {
      recs.push({ id: 'curve-heavy', kind: 'curve-heavy', severity: 'info', cmc: peak.cmc });
    }
  }

  if (screwProb >= SCREW_RISK_THRESHOLD) {
    recs.push({ id: 'screw-risk', kind: 'screw-risk', severity: 'warning', percent: Math.round(screwProb * 100) });
  }
  if (floodProb >= FLOOD_RISK_THRESHOLD) {
    recs.push({ id: 'flood-risk', kind: 'flood-risk', severity: 'warning', percent: Math.round(floodProb * 100) });
  }

  const hasIssue = recs.some((r) => r.severity !== 'good');
  if (!hasIssue && totalNonBasicCards > 0) {
    recs.push({ id: 'balanced', kind: 'balanced', severity: 'good' });
  }

  return recs.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export interface LandOdds {
  keepableProb: number;
  expectedLands: number;
  noLandProb: number;
  screwProb: number;
  floodProb: number;
  /** Per milestone turn, P(at least `lands` lands) among everything seen by then. */
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

/** Deterministic except for `openingHands`, which needs a seeded `rng` to be reproducible. */
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

  // Fewer cards than an opening hand makes every probability here meaningless, so the panel
  // is told there is nothing to show rather than shown numbers that read as real.
  const hasData = stats.totalNonBasicCards > 0 && cards.length >= OPENING_HAND_SIZE;

  return { hasData, stats, score, colorSources, landOdds, openingHands, recommendations };
}
