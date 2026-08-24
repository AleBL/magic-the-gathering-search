import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '../types/Card';
import { Deck, DeckFormat, DeckRelatedToken } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { ShowToastFn } from '../types/Toast';
import { SupportedDialogVariant } from './useDialog';

type SaveEditedDeck = (
  id: string,
  name: string,
  format: DeckFormat,
  cards: Card[],
  notes?: string,
  relatedTokens?: DeckRelatedToken[]
) => Promise<{ success: boolean; errorKey?: string }>;

type ShowAlertFn = (title: string, message: string, variant?: SupportedDialogVariant) => void;

interface UseDeckInfoEditorParams {
  readonly saveEditedDeck: SaveEditedDeck;
  readonly setSelectedDeck: Dispatch<SetStateAction<Deck | null>>;
  readonly showToast: ShowToastFn;
  readonly showAlert: ShowAlertFn;
}

/**
 * Rename or re-format a saved deck through the reused DeckSaveDialog. A closed loop, hence
 * kept out of DeckManager: it only reaches outside to keep an open deck's header in sync.
 */
export function useDeckInfoEditor({ saveEditedDeck, setSelectedDeck, showToast, showAlert }: UseDeckInfoEditorParams) {
  const { t } = useTranslation();
  const [deckInfoEdit, setDeckInfoEdit] = useState<Deck | null>(null);
  const [infoName, setInfoName] = useState('');
  const [infoFormat, setInfoFormat] = useState<DeckFormat>(DeckFormatType.FREEFORM);

  const openDeckInfoEditor = useCallback((deck: Deck) => {
    setDeckInfoEdit(deck);
    setInfoName(deck.name);
    setInfoFormat(deck.format || DeckFormatType.FREEFORM);
  }, []);

  const closeDeckInfoEditor = useCallback(() => setDeckInfoEdit(null), []);

  const handleSaveDeckInfo = useCallback(async () => {
    if (!deckInfoEdit) return;
    const result = await saveEditedDeck(
      deckInfoEdit.id,
      infoName.trim() || deckInfoEdit.name,
      infoFormat,
      deckInfoEdit.cards,
      deckInfoEdit.notes,
      deckInfoEdit.relatedTokens
    );
    if (result.success) {
      setSelectedDeck((prev) =>
        prev && prev.id === deckInfoEdit.id ? { ...prev, name: infoName.trim() || prev.name, format: infoFormat } : prev
      );
      setDeckInfoEdit(null);
      showToast(t('deck.deckSaved'));
    } else if (result.errorKey) {
      showAlert(t('common.errorTitle'), t(result.errorKey), 'danger');
    }
  }, [deckInfoEdit, infoName, infoFormat, saveEditedDeck, setSelectedDeck, showToast, showAlert, t]);

  return {
    deckInfoEdit,
    infoName,
    infoFormat,
    setInfoName,
    setInfoFormat,
    openDeckInfoEditor,
    closeDeckInfoEditor,
    handleSaveDeckInfo
  };
}
