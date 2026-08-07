import { Card } from '../types/Card';
import { ManaColor, MANA_COLORS, isLandCard, landProducedColors } from './deckStatistics';

/**
 * Monte Carlo "goldfish": play the deck out alone, many times, and report what the closed-form
 * hypergeometric panels cannot answer.
 *
 * `hypergeometricAtLeast` already gives exact odds of N lands among the cards seen by turn T,
 * and a simulation would only add noise to a number that has a formula. What has no formula is
 * anything path-dependent: London mulligans change which hands are kept, and casting on curve
 * depends on the order cards arrive and on which colors are already down. That is what this
 * measures.
 *
 * Deliberately not a rules engine. It does not read card text, so rituals, ramp, card draw,
 * cost reduction and lands that enter tapped all behave like plain cards. Read the output as
 * "how does the mana behave", not "how does the deck play".
 */

export interface GoldfishOptions {
  /** Games to play. Higher is steadier and slower; the panel's default is 1,000. */
  runs?: number;
  /** On the play skips the first-turn draw. */
  onPlay?: boolean;
  /** How many turns to play each game. */
  turns?: number;
  /** Fixed seed keeps a run reproducible; omit for a fresh shuffle each time. */
  seed?: number;
}

export interface LandMilestone {
  lands: number;
  /** Median turn the land count is first reached, or null if most games never got there. */
  medianTurn: number | null;
  reachedShare: number;
}

export interface GoldfishResult {
  runs: number;
  /** Share of games kept at each hand size, after London mulligans. */
  keptHandSizes: { size: number; share: number }[];
  mulliganRate: number;
  landMilestones: LandMilestone[];
  /** Share of games still on two or fewer lands entering turn four. */
  screwRate: number;
  /** Mean share of turns that had something castable with the mana available. */
  onCurveShare: number;
}

/** Deterministic PRNG (mulberry32) so a seeded run is reproducible in tests. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SimCard {
  isLand: boolean;
  produces: ManaColor[];
  cmc: number;
  /** Colored requirements; a hybrid pip lists every color that can pay it. */
  pips: ManaColor[][];
}

const COLOR_SYMBOLS = new Set<string>(MANA_COLORS);

/**
 * Colored requirements from a mana cost. Hybrid and Phyrexian symbols keep every color that
 * could pay them; generic, X and snow contribute to `cmc` only.
 */
function parsePips(manaCost: string): ManaColor[][] {
  const symbols = manaCost.match(/\{[^}]+\}/g) ?? [];
  const pips: ManaColor[][] = [];

  symbols.forEach((symbol) => {
    const inner = symbol.slice(1, -1).toUpperCase().replace(/\/P$/, '');
    const options = inner.split('/').filter((part): part is ManaColor => COLOR_SYMBOLS.has(part) && part !== 'C');
    if (options.length > 0) pips.push(options);
  });

  return pips;
}

function toSimCard(card: Card): SimCard {
  const isLand = isLandCard(card);
  const manaCost = card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '';
  return {
    isLand,
    produces: isLand ? landProducedColors(card) : [],
    cmc: Math.max(0, Math.round(card.cmc ?? 0)),
    pips: isLand ? [] : parsePips(manaCost)
  };
}

/**
 * Can `card` be cast with these lands? Colored pips are assigned before generic, and the most
 * constrained pip goes first — a greedy pass in that order settles the dual-land cases that a
 * naive left-to-right assignment would fail.
 */
function isCastable(card: SimCard, lands: SimCard[]): boolean {
  if (card.cmc > lands.length) return false;
  if (card.pips.length === 0) return true;

  const available = lands.map((land) => land.produces);
  const used = new Array(available.length).fill(false);

  const sortedPips = [...card.pips].sort((a, b) => {
    const supply = (options: ManaColor[]) =>
      available.filter((produces) => produces.some((color) => options.includes(color))).length;
    return supply(a) - supply(b);
  });

  for (const options of sortedPips) {
    const index = available.findIndex((produces, i) => !used[i] && produces.some((color) => options.includes(color)));
    if (index === -1) return false;
    used[index] = true;
  }

  // Generic can come from anything still untapped.
  const remaining = used.filter((isUsed) => !isUsed).length;
  return card.cmc - card.pips.length <= remaining;
}

function shuffle(cards: SimCard[], random: () => number): SimCard[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Keep a hand of `size` if its land count is playable. The window tightens as the hand shrinks
 * because a mulligan to five cannot afford to be picky — this is the common heuristic, not a
 * claim about optimal play.
 */
function shouldKeep(landsInHand: number, size: number): boolean {
  if (size <= 5) return true;
  if (size === 6) return landsInHand >= 2 && landsInHand <= 4;
  return landsInHand >= 2 && landsInHand <= 5;
}

const MILESTONES = [3, 4, 5];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function simulateGoldfish(deck: Card[], options: GoldfishOptions = {}): GoldfishResult | null {
  const runs = Math.max(1, Math.floor(options.runs ?? 1000));
  const turns = Math.max(1, Math.floor(options.turns ?? 8));
  const onPlay = options.onPlay ?? true;

  const library = deck.map(toSimCard);
  // Nothing to report from a deck too small to deal an opening hand.
  if (library.length < 7) return null;

  const random = createRandom(options.seed ?? Math.floor(Math.random() * 2 ** 31));

  const keptSizes: number[] = [];
  let mulliganed = 0;
  let screwed = 0;
  let onCurveTotal = 0;
  const milestoneTurns: Record<number, number[]> = { 3: [], 4: [], 5: [] };
  const milestoneReached: Record<number, number> = { 3: 0, 4: 0, 5: 0 };

  for (let run = 0; run < runs; run += 1) {
    let deckOrder = shuffle(library, random);
    let hand = deckOrder.slice(0, 7);
    let mulligans = 0;

    // London: always draw seven, then bottom one card per mulligan taken.
    while (mulligans < 3 && !shouldKeep(hand.filter((c) => c.isLand).length, 7 - mulligans)) {
      mulligans += 1;
      deckOrder = shuffle(library, random);
      hand = deckOrder.slice(0, 7);
    }

    const keptSize = 7 - mulligans;
    keptSizes.push(keptSize);
    if (mulligans > 0) mulliganed += 1;

    // Bottom the surplus: excess lands when flooded, otherwise the costliest spells.
    if (mulligans > 0) {
      const landsInHand = hand.filter((c) => c.isLand).length;
      const bottomLands = landsInHand > 3;
      hand = [...hand]
        .sort((a, b) => {
          if (bottomLands && a.isLand !== b.isLand) return a.isLand ? -1 : 1;
          return b.cmc - a.cmc;
        })
        .slice(mulligans);
    }

    let libraryIndex = 7;
    const battlefieldLands: SimCard[] = [];
    let castableTurns = 0;
    const reachedAt: Record<number, number> = {};

    for (let turn = 1; turn <= turns; turn += 1) {
      const draws = turn === 1 && onPlay ? 0 : 1;
      for (let d = 0; d < draws && libraryIndex < deckOrder.length; d += 1) {
        hand.push(deckOrder[libraryIndex]);
        libraryIndex += 1;
      }

      // One land per turn, preferring a color not already on the battlefield.
      const landIndex = hand.findIndex((card) => card.isLand);
      if (landIndex !== -1) {
        const haveColors = new Set(battlefieldLands.flatMap((land) => land.produces));
        const newColorIndex = hand.findIndex(
          (card) => card.isLand && card.produces.some((color) => !haveColors.has(color))
        );
        const chosen = newColorIndex !== -1 ? newColorIndex : landIndex;
        battlefieldLands.push(hand[chosen]);
        hand.splice(chosen, 1);
      }

      MILESTONES.forEach((target) => {
        if (reachedAt[target] === undefined && battlefieldLands.length >= target) {
          reachedAt[target] = turn;
        }
      });

      if (turn === 4 && battlefieldLands.length <= 2) screwed += 1;

      // Cast the most expensive thing affordable, so the hand develops instead of piling up.
      const affordable = hand
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => !card.isLand && isCastable(card, battlefieldLands))
        .sort((a, b) => b.card.cmc - a.card.cmc)[0];

      if (affordable) {
        castableTurns += 1;
        hand.splice(affordable.index, 1);
      }
    }

    MILESTONES.forEach((target) => {
      if (reachedAt[target] !== undefined) {
        milestoneReached[target] += 1;
        milestoneTurns[target].push(reachedAt[target]);
      }
    });

    onCurveTotal += castableTurns / turns;
  }

  const sizeCounts = new Map<number, number>();
  keptSizes.forEach((size) => sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1));

  return {
    runs,
    keptHandSizes: [...sizeCounts.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([size, count]) => ({ size, share: count / runs })),
    mulliganRate: mulliganed / runs,
    landMilestones: MILESTONES.map((lands) => ({
      lands,
      medianTurn: median(milestoneTurns[lands]),
      reachedShare: milestoneReached[lands] / runs
    })),
    screwRate: screwed / runs,
    onCurveShare: onCurveTotal / runs
  };
}
