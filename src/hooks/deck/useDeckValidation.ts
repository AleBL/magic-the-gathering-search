import { useEffect, useState } from 'react';
import { Card } from '../../types/Card';
import { DeckFormat } from '../../types/Deck';
import { validateDeck, ValidationResult } from '../../utils/deckValidator';

/** Validates against the format being edited when there is one, and the save form's otherwise. */
export function useDeckValidation(
  currentDeck: Card[],
  editingDeckId: string | null,
  editingDeckFormat: DeckFormat,
  deckFormat: DeckFormat
): ValidationResult {
  const [deckValidation, setDeckValidation] = useState<ValidationResult>({ isValid: true, errors: [] });

  useEffect(() => {
    const activeFormat = editingDeckId ? editingDeckFormat : deckFormat;
    setDeckValidation(validateDeck(currentDeck, activeFormat));
  }, [currentDeck, deckFormat, editingDeckFormat, editingDeckId]);

  return deckValidation;
}
