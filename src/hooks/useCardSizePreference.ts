import { useEffect, useState } from 'react';

import { CARD_SIZES } from '../constants';
import { STORAGE_KEYS } from '../constants/storage';
import { CardSize } from '../types';

const readStoredCardSize = (): CardSize => {
  const saved = localStorage.getItem(STORAGE_KEYS.cardSize);
  return saved && (CARD_SIZES as readonly string[]).includes(saved) ? (saved as CardSize) : 'small';
};

/**
 * Shared card-size preference for every grid with a CardSizeSelector. Keeping the read and
 * the write in one hook is what makes the screens agree: the collection screen used to read
 * the stored size and never write its own changes back.
 */
export function useCardSizePreference() {
  const [cardSize, setCardSize] = useState<CardSize>(readStoredCardSize);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cardSize, cardSize);
  }, [cardSize]);

  return [cardSize, setCardSize] as const;
}
