import { Card } from '../types/Card';
import { PlaytestCard } from '../types/Playtest';
import { PlaytestZone, LibraryPlacement } from '../types/enums';
import { newId } from './id';

export const OPENING_HAND_SIZE = 7;

const COMMANDER_LIFE_TOTAL = 40;
const DEFAULT_LIFE_TOTAL = 20;

export const playtestCardName = (item: PlaytestCard): string => item.card.printed_name || item.card.name;

export const startingLifeTotal = (deckFormat?: string): number =>
  deckFormat === 'commander' ? COMMANDER_LIFE_TOTAL : DEFAULT_LIFE_TOTAL;

export function shufflePlaytestCards(cards: PlaytestCard[]): PlaytestCard[] {
  const shuffledCards = [...cards];
  for (let currentIndex = shuffledCards.length - 1; currentIndex > 0; currentIndex--) {
    const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
    const temporaryCardHolder = shuffledCards[currentIndex];
    shuffledCards[currentIndex] = shuffledCards[randomIndex];
    shuffledCards[randomIndex] = temporaryCardHolder;
  }
  return shuffledCards;
}

export function toPlaytestCards(cards: Card[]): PlaytestCard[] {
  return cards.map((card) => ({
    playtestId: `${card.id}-${newId()}`,
    card,
    isTapped: false,
    counters: 0,
    isFaceDown: true
  }));
}

export interface OpeningDeal {
  hand: PlaytestCard[];
  library: PlaytestCard[];
}

export function dealOpeningHand(deckCards: Card[]): OpeningDeal {
  const shuffled = shufflePlaytestCards(toPlaytestCards(deckCards));
  return {
    hand: shuffled.slice(0, OPENING_HAND_SIZE).map((item) => ({ ...item, isFaceDown: false })),
    library: shuffled.slice(OPENING_HAND_SIZE)
  };
}

/** Normalizes a card's tap/face state as it enters a zone (library cards are hidden). */
export function applyZoneTransform(card: PlaytestCard, to: PlaytestZone): PlaytestCard {
  // Outside the battlefield a double-faced card is always its full physical
  // card again — drop the single-face representation chosen when it was played.
  const normalized =
    to !== PlaytestZone.BATTLEFIELD && card.baseCard ? { ...card, card: card.baseCard, baseCard: undefined } : card;
  if (to === PlaytestZone.LIBRARY) {
    return { ...normalized, isTapped: false, isFaceDown: true };
  }
  return { ...normalized, isTapped: false, isFaceDown: false };
}

export function insertIntoZone(
  zone: PlaytestCard[],
  entering: PlaytestCard,
  to: PlaytestZone,
  placement: LibraryPlacement
): PlaytestCard[] {
  const base = zone.filter((item) => item.playtestId !== entering.playtestId);
  if (to === PlaytestZone.LIBRARY) {
    if (placement === 'top') return [entering, ...base];
    if (placement === 'bottom') return [...base, entering];
    const index = Math.max(0, Math.min(placement, base.length));
    const next = [...base];
    next.splice(index, 0, entering);
    return next;
  }
  // Graveyard and exile stack newest-on-top; hand and battlefield append.
  if (to === PlaytestZone.GRAVEYARD || to === PlaytestZone.EXILE) {
    return [entering, ...base];
  }
  return [...base, entering];
}
