import { Card } from '../types/Card';
import { BASIC_LAND_NAMES, MIN_DECK_SIZE, COMMANDER_DECK_SIZE } from '../constants';

type StatFilterType = 'cmc' | 'color' | 'type';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export const MANA_COLORS: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export const MANA_COLOR_TO_BASIC_LAND: Record<ManaColor, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
  C: 'Wastes'
};

export interface StatFilter {
  type: StatFilterType;
  value: string | number;
}

// Front face only: Scryfall joins both faces of a double-faced card into one top-level
// `type_line` with "//", so a creature that transforms into a land reads as
// "Creature ... // Land" and would count as a land while it is still cast as a creature.
export function isLandCard(card: Card): boolean {
  const typeLine = (card.card_faces?.[0]?.type_line ?? card.type_line ?? '').toLowerCase();
  return typeLine.includes('land');
}

// Basics are matched by printed name because a localized deck never says "Plains".
// Approximate by construction: a fetchland reads as its own identity rather than what it
// finds, and a conditional producer still counts. Enough for "can I cast this on curve".
export function landProducedColors(card: Card): ManaColor[] {
  if (!isLandCard(card)) return [];

  const name = card.name.toLowerCase();
  if (name.includes('plains') || name.includes('planície')) return ['W'];
  if (name.includes('island') || name.includes('ilha')) return ['U'];
  if (name.includes('swamp') || name.includes('pântano')) return ['B'];
  if (name.includes('mountain') || name.includes('montanha')) return ['R'];
  if (name.includes('forest') || name.includes('floresta')) return ['G'];
  if (name.includes('wastes') || name.includes('ermo')) return ['C'];

  if (card.color_identity?.length) {
    return card.color_identity.filter((color): color is ManaColor => MANA_COLORS.includes(color as ManaColor));
  }

  const oracleText = card.oracle_text?.toLowerCase() || '';
  if (!oracleText) return [];
  return MANA_COLORS.filter((color) => oracleText.includes(`{t}: add {${color.toLowerCase()}}`));
}

// Scryfall leaves the top-level `mana_cost` empty for double-faced cards, so pip
// requirements have to be read per face. A land face never contributes: lands produce
// mana, they don't require it.
function combinedNonLandManaCost(card: Card): string {
  if (card.mana_cost) return card.mana_cost;
  if (!card.card_faces?.length) return '';
  return card.card_faces
    .filter((face) => !face.type_line?.toLowerCase().includes('land'))
    .map((face) => face.mana_cost || '')
    .join(' ');
}

export interface DeckStatistics {
  averageConvertedManaCost: string;
  convertedManaCostCounts: Record<number | string, number>;
  maximumConvertedManaCostCount: number;
  colorDistributionCounts: Record<string, number>;
  totalColorsOccurrenceCount: number;
  cardTypeCounts: Record<string, number>;
  rarityCounts: Record<string, number>;
  totalCards: number;
  suggestedBasicLandCounts: Record<string, number>;
  neededBasicLands: number;
  targetTotalLands: number;
  /**
   * Basic + non-basic. Reconcile against this, never against `cardTypeCounts.land`, whose
   * else-if chain files "Artifact Land" under artifact and "Creature — Land" under creature.
   */
  totalLands: number;
  totalNonBasicCards: number;
  finalDeckSize: number;
  targetDeckLimit: number;
  removeCount: number;
  totalUsdPrice: number;
  totalEurPrice: number;
  mostExpensiveCards: Card[];
  manaColorSymbolCounts: Record<ManaColor, number>;
  landColorCounts: Record<ManaColor, number>;
}

export function filterCardsByStat(currentDeck: Card[], activeFilter: StatFilter | null): Card[] {
  if (!activeFilter) return [];
  return currentDeck
    .filter((card) => {
      if (activeFilter.type === 'cmc') {
        if (isLandCard(card)) return false;
        const cmc = Math.floor(card.cmc || 0);
        if (activeFilter.value === '7+') return cmc >= 7;
        return cmc.toString() === activeFilter.value.toString();
      }
      if (activeFilter.type === 'color') {
        if (activeFilter.value === 'C') {
          if (isLandCard(card)) return false;
          const hasColor = ['W', 'U', 'B', 'R', 'G'].some(
            (c) => card.colors?.includes(c) || card.mana_cost?.includes(c)
          );
          return !hasColor;
        }
        return (
          card.colors?.includes(activeFilter.value as string) || card.mana_cost?.includes(activeFilter.value as string)
        );
      }
      if (activeFilter.type === 'type') {
        return card.type_line?.toLowerCase().includes(activeFilter.value as string);
      }
      return true;
    })
    .filter((c) => !c.isCommander);
}

// Largest-remainder (Hamilton) apportionment, so the parts add up to the whole exactly.
function allocateLandsByPips(
  pipCounts: Record<ManaColor, number>,
  activeColors: readonly ManaColor[],
  landsToAllocate: number
): Partial<Record<ManaColor, number>> {
  const allocations: Partial<Record<ManaColor, number>> = {};
  if (landsToAllocate <= 0 || activeColors.length === 0) return allocations;

  if (landsToAllocate < activeColors.length) {
    [...activeColors]
      .sort((a, b) => pipCounts[b] - pipCounts[a])
      .slice(0, landsToAllocate)
      .forEach((color) => {
        allocations[color] = 1;
      });
    return allocations;
  }

  const totalPips = activeColors.reduce((sum, color) => sum + pipCounts[color], 0);

  const quotas = activeColors.map((color) => {
    const quota = (pipCounts[color] / totalPips) * landsToAllocate;
    return { color, quota, lands: Math.floor(quota) };
  });
  let remaining = landsToAllocate - quotas.reduce((sum, q) => sum + q.lands, 0);
  [...quotas]
    .sort((a, b) => b.quota - b.lands - (a.quota - a.lands))
    .forEach((entry) => {
      if (remaining > 0) {
        entry.lands += 1;
        remaining -= 1;
      }
    });

  // A used color can never end at zero sources: without one, its spells are uncastable.
  quotas.forEach((zeroed) => {
    if (zeroed.lands > 0) return;
    const donor = quotas.reduce((max, q) => (q.lands > max.lands ? q : max), quotas[0]);
    if (donor.lands > 1) {
      donor.lands -= 1;
      zeroed.lands += 1;
    }
  });

  quotas.forEach((entry) => {
    allocations[entry.color] = entry.lands;
  });
  return allocations;
}

function isBasicLandCard(card: Card): boolean {
  const typeLine = card.type_line?.toLowerCase() || '';
  return typeLine.includes('basic land') || BASIC_LAND_NAMES.includes(card.name);
}

export function computeDeckStatistics(currentDeck: Card[]): DeckStatistics {
  const nonLandCards = currentDeck.filter((card) => !isLandCard(card) && !card.isCommander);

  const totalConvertedManaCost = nonLandCards.reduce((sum, card) => sum + (card.cmc || 0), 0);
  const averageConvertedManaCost =
    nonLandCards.length > 0 ? (totalConvertedManaCost / nonLandCards.length).toFixed(2) : '0.00';

  const convertedManaCostCounts: Record<number | string, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    '7+': 0
  };

  nonLandCards.forEach((card) => {
    const manaCostValue = Math.floor(card.cmc || 0);
    if (manaCostValue >= 7) {
      convertedManaCostCounts['7+'] += 1;
    } else if (manaCostValue in convertedManaCostCounts) {
      convertedManaCostCounts[manaCostValue] += 1;
    } else {
      convertedManaCostCounts[0] += 1;
    }
  });

  const maximumConvertedManaCostCount = Math.max(...Object.values(convertedManaCostCounts), 1);

  const colorDistributionCounts: Record<string, number> = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0
  };

  currentDeck.forEach((card) => {
    const cardColorsList = card.colors;
    if (cardColorsList && cardColorsList.length > 0) {
      cardColorsList.forEach((colorSymbol) => {
        if (colorSymbol in colorDistributionCounts) {
          colorDistributionCounts[colorSymbol] += 1;
        }
      });
      return;
    }

    // Double-faced cards leave top-level `colors` empty too, so fall back to the faces.
    const manaCostForColors = combinedNonLandManaCost(card);
    if (manaCostForColors) {
      let hasColorSymbol = false;
      ['W', 'U', 'B', 'R', 'G'].forEach((colorSymbol) => {
        if (manaCostForColors.includes(colorSymbol)) {
          colorDistributionCounts[colorSymbol] += 1;
          hasColorSymbol = true;
        }
      });
      if (!hasColorSymbol && !isLandCard(card)) {
        colorDistributionCounts.C += 1;
      }
    } else if (!isLandCard(card)) {
      colorDistributionCounts.C += 1;
    }
  });

  const totalColorsOccurrenceCount = Object.values(colorDistributionCounts).reduce((sum, count) => sum + count, 0) || 1;

  const cardTypeCounts = {
    creature: 0,
    instant: 0,
    sorcery: 0,
    enchantment: 0,
    artifact: 0,
    planeswalker: 0,
    land: 0
  };

  currentDeck.forEach((card) => {
    const cardTypeLine = card.type_line?.toLowerCase() || '';
    if (cardTypeLine.includes('creature')) cardTypeCounts.creature += 1;
    else if (cardTypeLine.includes('instant')) cardTypeCounts.instant += 1;
    else if (cardTypeLine.includes('sorcery')) cardTypeCounts.sorcery += 1;
    else if (cardTypeLine.includes('enchantment')) cardTypeCounts.enchantment += 1;
    else if (cardTypeLine.includes('artifact')) cardTypeCounts.artifact += 1;
    else if (cardTypeLine.includes('planeswalker')) cardTypeCounts.planeswalker += 1;
    else if (cardTypeLine.includes('land')) cardTypeCounts.land += 1;
  });

  const rarityCounts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
  currentDeck.forEach((card) => {
    const rarity = (card.rarity || '').toLowerCase();
    if (rarity in rarityCounts) rarityCounts[rarity] += 1;
  });

  // Generic ({2}, {X}) and snow ({S}) costs are excluded on purpose: any land pays them,
  // so counting them would skew the colors the mana base is built for.
  const manaColorSymbolCounts: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  nonLandCards.forEach((card) => {
    const manaCostSymbolMatches = combinedNonLandManaCost(card).match(/\{[WUBRGC](\/[WUBRGC])?\}/g) || [];
    manaCostSymbolMatches.forEach((manaSymbol) => {
      MANA_COLORS.forEach((manaColor) => {
        if (manaSymbol.includes(manaColor)) {
          manaColorSymbolCounts[manaColor] += 1;
        }
      });
    });
  });

  const totalManaColorSymbols = Object.values(manaColorSymbolCounts).reduce((a, b) => a + b, 0);
  const activeManaColors = MANA_COLORS.filter((color) => manaColorSymbolCounts[color] > 0);

  // ~2/3 land ratio, but never below one source per mana kind actually used:
  // even a one-spell deck needs at least one land that can cast that spell.
  const targetTotalLands =
    nonLandCards.length === 0 ? 0 : Math.max(Math.floor(nonLandCards.length * (2 / 3)), activeManaColors.length, 1);

  const existingNonBasicLandCount = currentDeck.filter((card) => isLandCard(card) && !isBasicLandCard(card)).length;
  const existingBasicLandCount = currentDeck.filter(isBasicLandCard).length;

  // Applying the suggestion adds to the deck instead of replacing it (see useSuggestedLands),
  // so discounting the basics already there is what makes a second apply a no-op and flips
  // the panel to "lands already sufficient" instead of offering the same +N again.
  const neededBasicLands = Math.max(0, targetTotalLands - existingNonBasicLandCount - existingBasicLandCount);

  const totalNonBasicCards = currentDeck.filter((card) => !isBasicLandCard(card)).length;
  const finalDeckSize = currentDeck.length + neededBasicLands;
  const targetDeckLimit = currentDeck.length >= 80 ? COMMANDER_DECK_SIZE : MIN_DECK_SIZE;
  const removeCount = Math.max(0, finalDeckSize - targetDeckLimit);

  const suggestedBasicLandCounts: Record<string, number> = {
    Plains: 0,
    Island: 0,
    Swamp: 0,
    Mountain: 0,
    Forest: 0,
    Wastes: 0
  };

  if (neededBasicLands > 0 && totalManaColorSymbols > 0) {
    const allocations = allocateLandsByPips(manaColorSymbolCounts, activeManaColors, neededBasicLands);
    activeManaColors.forEach((color) => {
      suggestedBasicLandCounts[MANA_COLOR_TO_BASIC_LAND[color]] = allocations[color] ?? 0;
    });
  } else if (neededBasicLands > 0) {
    // Every spell costs pure generic, so any land works and Wastes is the neutral pick.
    suggestedBasicLandCounts['Wastes'] = neededBasicLands;
  }

  const landColorCounts: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  currentDeck.forEach((card) => {
    landProducedColors(card).forEach((color) => {
      landColorCounts[color] += 1;
    });
  });

  let totalUsdPrice = 0;
  let totalEurPrice = 0;
  currentDeck.forEach((card) => {
    const usdPriceValue = card.prices?.usd ? parseFloat(card.prices.usd) : 0;
    const eurPriceValue = card.prices?.eur ? parseFloat(card.prices.eur) : 0;
    totalUsdPrice += usdPriceValue;
    totalEurPrice += eurPriceValue;
  });

  // Deduped by name so a playset of one expensive card doesn't fill every slot.
  const seenExpensiveNames = new Set<string>();
  const mostExpensiveCards = [...currentDeck]
    .filter((card) => card.prices?.usd)
    .sort((a, b) => parseFloat(b.prices!.usd!) - parseFloat(a.prices!.usd!))
    .filter((card) => {
      if (seenExpensiveNames.has(card.name)) return false;
      seenExpensiveNames.add(card.name);
      return true;
    })
    .slice(0, 3);

  return {
    averageConvertedManaCost,
    convertedManaCostCounts,
    maximumConvertedManaCostCount,
    colorDistributionCounts,
    totalColorsOccurrenceCount,
    cardTypeCounts,
    rarityCounts,
    totalCards: currentDeck.length,
    suggestedBasicLandCounts,
    neededBasicLands,
    targetTotalLands,
    totalLands: existingNonBasicLandCount + existingBasicLandCount,
    totalNonBasicCards,
    finalDeckSize,
    targetDeckLimit,
    removeCount,
    totalUsdPrice,
    totalEurPrice,
    mostExpensiveCards,
    manaColorSymbolCounts,
    landColorCounts
  };
}

// Binomial coefficient "n choose r", multiplicative so a 100-card deck never hits
// the overflow a factorial version would.
function combinations(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  const k = Math.min(r, n - r);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/** One entry per land count from 0 to min(handSize, landCount), each holding P(exactly that many). */
export function landDrawProbabilities(
  deckSize: number,
  landCount: number,
  handSize = 7
): { lands: number; prob: number }[] {
  if (deckSize < handSize || handSize <= 0 || landCount < 0) return [];
  const denominator = combinations(deckSize, handSize);
  if (denominator === 0) return [];

  const maxLands = Math.min(handSize, landCount);
  const distribution: { lands: number; prob: number }[] = [];
  for (let k = 0; k <= maxLands; k++) {
    const prob = (combinations(landCount, k) * combinations(deckSize - landCount, handSize - k)) / denominator;
    distribution.push({ lands: k, prob });
  }
  return distribution;
}

export function hypergeometricExactly(population: number, successes: number, draws: number, k: number): number {
  if (population <= 0 || draws <= 0 || draws > population) return 0;
  if (successes < 0 || successes > population) return 0;
  if (k < 0 || k > successes || k > draws) return 0;
  const denominator = combinations(population, draws);
  if (denominator === 0) return 0;
  return (combinations(successes, k) * combinations(population - successes, draws - k)) / denominator;
}

export function hypergeometricAtLeast(population: number, successes: number, draws: number, k: number): number {
  if (k <= 0) return population > 0 && draws > 0 && draws <= population ? 1 : 0;
  const upper = Math.min(draws, successes);
  let cumulative = 0;
  for (let i = k; i <= upper; i++) {
    cumulative += hypergeometricExactly(population, successes, draws, i);
  }
  return Math.min(1, cumulative);
}

// Opening 7 plus one card per draw step. On the play there is no turn-1 draw, which is
// the whole difference between the two curves.
export function cardsSeenByTurn(turn: number, onPlay = true): number {
  const safeTurn = Math.max(1, Math.floor(turn));
  return 7 + (onPlay ? safeTurn - 1 : safeTurn);
}
