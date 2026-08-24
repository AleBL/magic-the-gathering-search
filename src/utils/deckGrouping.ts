import { Card } from '../types/Card';
import { GroupCriteria, SortCriteria } from '../types/enums';
import locales from '../locales';
import { scryfallNamedImageUrl } from '../constants/urls';

interface CardWithSelectedPrintImage extends Card {
  selectedPrintImageUri?: string;
}

export interface GroupedCards {
  title: string;
  cards: Card[];
}

export interface DeckCardGrouped {
  name: string;
  count: number;
  card: Card;
  /** Stable React key: two printings of one card share a name but not this. */
  key: string;
}

export const sortCards = (cardsList: Card[], sortCriteria: SortCriteria): Card[] => {
  const list = [...cardsList];
  const rarityWeight: Record<string, number> = { mythic: 4, rare: 3, uncommon: 2, common: 1 };

  return list.sort((a, b) => {
    if (sortCriteria === SortCriteria.CMC) {
      return (a.cmc || 0) - (b.cmc || 0) || a.name.localeCompare(b.name);
    }
    if (sortCriteria === SortCriteria.RARITY) {
      const weightA = rarityWeight[a.rarity?.toLowerCase()] || 0;
      const weightB = rarityWeight[b.rarity?.toLowerCase()] || 0;
      return weightB - weightA || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
};

export const groupCards = (
  cardsList: Card[],
  groupCriteria: GroupCriteria,
  sortCriteria: SortCriteria
): GroupedCards[] => {
  const sorted = sortCards(cardsList, sortCriteria);

  if (groupCriteria === GroupCriteria.NONE) {
    return [{ title: '', cards: sorted }];
  }

  const groups: Record<string, Card[]> = {};

  if (groupCriteria === GroupCriteria.TYPE) {
    sorted.forEach((card) => {
      const typeLine = card.type_line?.toLowerCase() || '';
      let key = 'other';
      if (typeLine.includes('creature')) key = 'creature';
      else if (typeLine.includes('planeswalker')) key = 'planeswalker';
      else if (typeLine.includes('instant')) key = 'instant';
      else if (typeLine.includes('sorcery')) key = 'sorcery';
      else if (typeLine.includes('enchantment')) key = 'enchantment';
      else if (typeLine.includes('artifact')) key = 'artifact';
      else if (typeLine.includes('land')) key = 'land';
      groups[key] = groups[key] || [];
      groups[key].push(card);
    });
  } else if (groupCriteria === GroupCriteria.CMC) {
    sorted.forEach((card) => {
      const cmc = Math.floor(card.cmc || 0);
      const key = cmc >= 7 ? 'CMC 7+' : `CMC ${cmc}`;
      groups[key] = groups[key] || [];
      groups[key].push(card);
    });
  } else if (groupCriteria === GroupCriteria.COLOR) {
    sorted.forEach((card) => {
      const colors = card.colors;
      let key = 'colorless';
      if (colors && colors.length > 1) {
        key = 'multicolored';
      } else if (colors && colors.length === 1) {
        const c = colors[0];
        if (c === 'W') key = 'white';
        else if (c === 'U') key = 'blue';
        else if (c === 'B') key = 'black';
        else if (c === 'R') key = 'red';
        else if (c === 'G') key = 'green';
      }
      groups[key] = groups[key] || [];
      groups[key].push(card);
    });
  }

  const orderedGroups = Object.entries(groups).map(([title, cards]) => ({ title, cards }));

  if (groupCriteria === GroupCriteria.CMC) {
    return orderedGroups.sort((a, b) => {
      const numA = parseInt(a.title.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.title.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }

  return orderedGroups.sort((a, b) => a.title.localeCompare(b.title));
};

/**
 * Stacks copies by **printing**, not by name: four copies of a creature across four
 * editions are four things in a deck, each with its own art and its own price. Grouping by
 * name collapsed them into one pile wearing whichever art came first.
 */
export const groupCardsByUnique = (cardsList: Card[]): DeckCardGrouped[] => {
  const grouped: DeckCardGrouped[] = [];
  const byPrinting = new Map<string, DeckCardGrouped>();

  cardsList.forEach((card) => {
    const key = card.id;
    const existing = byPrinting.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const entry = { name: card.name, count: 1, card, key };
      byPrinting.set(key, entry);
      grouped.push(entry);
    }
  });

  return grouped;
};

type LocaleTranslations = (typeof locales)['en']['translations'];
type BasicLandKey = keyof LocaleTranslations['land'];

const getBasicLandNamesMap = (): Record<string, string> => {
  const map: Record<string, string> = {};
  const landKeys: BasicLandKey[] = ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'];

  landKeys.forEach((key) => {
    map[key] = key;
  });

  Object.values(locales).forEach(({ translations }) => {
    landKeys.forEach((key) => {
      const translatedName = translations.land[key];
      if (typeof translatedName === 'string') {
        map[translatedName.toLowerCase()] = key;
      }
    });
  });

  return map;
};

const BASIC_LAND_NAMES = getBasicLandNamesMap();

/** URL of the best available image for the card. */
export const getCardImageUrl = (card: Card): string => {
  const cardWithSelectedPrintImage = card as CardWithSelectedPrintImage;

  if (cardWithSelectedPrintImage.selectedPrintImageUri) return cardWithSelectedPrintImage.selectedPrintImageUri;

  if (card.image_uris?.gatherer) return card.image_uris.gatherer;

  const imageUris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  const baseUrl = imageUris ? imageUris.normal || imageUris.large || '' : '';

  if (baseUrl) return baseUrl;

  const landName = BASIC_LAND_NAMES[card.name?.toLowerCase()];
  if (landName) {
    return scryfallNamedImageUrl(landName);
  }

  return '';
};

/** URL of the art crop image for the card, often used as backgrounds. */
export const getCardArtCropUrl = (card: Card): string => {
  const imageUris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  const baseUrl = imageUris ? imageUris.art_crop || imageUris.normal || imageUris.large || '' : '';

  if (baseUrl) return baseUrl;

  const landName = BASIC_LAND_NAMES[card.name?.toLowerCase()];
  if (landName) {
    return scryfallNamedImageUrl(landName);
  }

  return '';
};
