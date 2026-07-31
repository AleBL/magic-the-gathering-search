import { useEffect, useState } from 'react';

import { CARD_SIZES } from '../constants';
import { STORAGE_KEYS } from '../constants/storage';
import { CardSize } from '../types';

const readStoredCardSize = (): CardSize => {
  const saved = localStorage.getItem(STORAGE_KEYS.cardSize);
  return saved && (CARD_SIZES as readonly string[]).includes(saved) ? (saved as CardSize) : 'small';
};

/**
 * Shared card-size preference for the grids that offer a CardSizeSelector.
 *
 * The deck and collection screens read the same key, so keeping the read/write
 * pair in one hook is what makes them actually agree — before this, the
 * collection screen read the stored size but never wrote its own changes back.
 */
export function useCardSizePreference() {
  const [cardSize, setCardSize] = useState<CardSize>(readStoredCardSize);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cardSize, cardSize);
  }, [cardSize]);

  return [cardSize, setCardSize] as const;
}
