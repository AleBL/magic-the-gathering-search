import { Card } from '../../types/Card';
import { CardSize } from '../../types';
import locales from '../../locales';

export const getGlowColor = (rarity: string | undefined): string => {
  switch (rarity?.toLowerCase()) {
    case 'mythic':
      return 'rgba(249, 115, 22, 0.4)'; // orange
    case 'rare':
      return 'rgba(245, 158, 11, 0.4)'; // amber
    case 'uncommon':
      return 'rgba(148, 163, 184, 0.4)'; // slate
    case 'common':
    default:
      return 'rgba(255, 255, 255, 0.2)'; // white/subtle
  }
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

export function getCardItemImageUrl(card: Card, size: CardSize): string {
  if (card.selectedPrintImageUri) return card.selectedPrintImageUri;

  const imageUris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  if (!imageUris) {
    const landName = BASIC_LAND_NAMES[card.name?.toLowerCase()];
    return landName ? `https://api.scryfall.com/cards/named?exact=${landName}&format=image` : '';
  }

  if (card.image_uris?.gatherer) return card.image_uris.gatherer;

  const sizeToUriKey: Record<CardSize, keyof typeof imageUris> = {
    small: 'small',
    medium: 'normal',
    large: 'large',
    xlarge: 'png'
  };

  const prioritizedUri = imageUris[sizeToUriKey[size]];
  if (prioritizedUri) return prioritizedUri;

  const landName = BASIC_LAND_NAMES[card.name?.toLowerCase()];
  return landName ? `https://api.scryfall.com/cards/named?exact=${landName}&format=image` : '';
}
