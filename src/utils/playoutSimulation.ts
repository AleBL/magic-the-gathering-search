import { Card } from '../types/Card';
import { ManaColor, MANA_COLORS, isLandCard, landProducedColors } from './deckStatistics';
import { mulberry32 } from './deckDoctor';

// Simulated rather than derived because only the path-dependent part needs it:
// `hypergeometricAtLeast` already gives exact odds of N lands by turn T, and simulating that
// would only add noise. London mulligans changing which hands are kept, and casting on curve
// depending on the order cards arrive in, have no such formula.
//
// Deliberately not a rules engine: card text is never read, so rituals, ramp, draw, cost
// reduction and lands that enter tapped all behave like plain cards. The output answers "how
// does the mana behave", not "how does the deck play".

const OPENING_HAND_SIZE = 7;
const MAX_MULLIGANS = 3;
const STALL_CHECK_TURN = 4;
const STALL_MAX_LANDS = 2;

export interface PlayoutOptions {
  runs?: number;
  /** On the play there is no first-turn draw. */
  onPlay?: boolean;
  turns?: number;
  seed?: number;
}

export interface LandMilestone {
  lands: number;
  /** Null when no game ever reached this land count. */
  medianTurn: number | null;
  reachedShare: number;
}

export interface PlayoutResult {
  runs: number;
  keptHandSizes: { size: number; share: number }[];
  mulliganRate: number;
  landMilestones: LandMilestone[];
  /** Share of games still on `STALL_MAX_LANDS` or fewer lands at `STALL_CHECK_TURN`. */
  stalledRate: number;
  /** Mean share of turns that had something castable with the mana available. */
  onCurveShare: number;
}

interface SimCard {
  isLand: boolean;
  produces: ManaColor[];
  cmc: number;
  /** Colored requirements; a hybrid pip lists every color that can pay it. */
  pips: ManaColor[][];
}

const COLOR_SYMBOLS = new Set<string>(MANA_COLORS);

/** Generic, X and snow are skipped: they contribute to `cmc` and demand no color. */
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

// Scarcest pip first, then generic from whatever is left: a naive left-to-right assignment
// spends a dual on a pip a basic could have paid and reports castable spells as uncastable.
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

// The window tightens as the hand shrinks because a mulligan to five cannot afford to be
// picky. Common heuristic, not a claim about optimal play.
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

export function simulatePlayout(deck: Card[], options: PlayoutOptions = {}): PlayoutResult | null {
  const runs = Math.max(1, Math.floor(options.runs ?? 1000));
  const turns = Math.max(1, Math.floor(options.turns ?? 8));
  const onPlay = options.onPlay ?? true;

  const library = deck.map(toSimCard);
  if (library.length < OPENING_HAND_SIZE) return null;

  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 31));

  const keptSizes: number[] = [];
  let mulliganed = 0;
  let stalled = 0;
  let onCurveTotal = 0;
  const milestoneTurns: Record<number, number[]> = { 3: [], 4: [], 5: [] };
  const milestoneReached: Record<number, number> = { 3: 0, 4: 0, 5: 0 };

  for (let run = 0; run < runs; run += 1) {
    let deckOrder = shuffle(library, random);
    let hand = deckOrder.slice(0, OPENING_HAND_SIZE);
    let mulligans = 0;

    // London mulligan: every hand is drawn at seven, and the cost is paid afterwards by
    // bottoming one card per mulligan taken.
    while (
      mulligans < MAX_MULLIGANS &&
      !shouldKeep(hand.filter((c) => c.isLand).length, OPENING_HAND_SIZE - mulligans)
    ) {
      mulligans += 1;
      deckOrder = shuffle(library, random);
      hand = deckOrder.slice(0, OPENING_HAND_SIZE);
    }

    const keptSize = OPENING_HAND_SIZE - mulligans;
    keptSizes.push(keptSize);
    if (mulligans > 0) mulliganed += 1;

    // A flooded hand bottoms lands, any other hand bottoms its costliest spells.
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

    let libraryIndex = OPENING_HAND_SIZE;
    const battlefieldLands: SimCard[] = [];
    let castableTurns = 0;
    const reachedAt: Record<number, number> = {};

    for (let turn = 1; turn <= turns; turn += 1) {
      const draws = turn === 1 && onPlay ? 0 : 1;
      for (let d = 0; d < draws && libraryIndex < deckOrder.length; d += 1) {
        hand.push(deckOrder[libraryIndex]);
        libraryIndex += 1;
      }

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

      if (turn === STALL_CHECK_TURN && battlefieldLands.length <= STALL_MAX_LANDS) stalled += 1;

      // Casting the most expensive affordable spell, so the hand develops instead of piling up.
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
    stalledRate: stalled / runs,
    onCurveShare: onCurveTotal / runs
  };
}
