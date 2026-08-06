import { logger } from '../utils/logger';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import { Card } from '../types/Card';
import { DeckFormat } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { parseDeckText, fetchCardsFromParsedList, ImportProgressData } from '../services/deckImportService';

export function useDeckTextImport(
  i18n: I18nInstance,
  editingDeckId: string | null,
  editingDeckName: string,
  editingDeckFormat: DeckFormat,
  onLoadDeckToEdit: (id: string, name: string, format: DeckFormat, cards: Card[]) => void,
  showToast: (text: string) => void,
  showAlert: (title: string, message: string, variant: 'info' | 'warning' | 'danger' | 'success') => void,
  setIsTextImportOpen: (isOpen: boolean) => void
) {
  const { t } = useTranslation();
  const [importProgress, setImportProgress] = useState<ImportProgressData>({
    isImporting: false,
    current: 0,
    total: 0,
    message: ''
  });
  const [missingCards, setMissingCards] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [importedCardsCache, setImportedCardsCache] = useState<Card[]>([]);

  const importTextDeck = async (text: string) => {
    const parsed = parseDeckText(text);
    if (parsed.length === 0) return;

    setIsProgressModalOpen(true);
    setImportProgress({
      isImporting: true,
      current: 0,
      total: parsed.length,
      message: t('common.loading')
    });
    setErrorMsg(null);
    setMissingCards([]);
    setImportedCardsCache([]);

    try {
      const currentLang = i18n.language || 'en';

      const { cards: finalCards, missing } = await fetchCardsFromParsedList(
        parsed,
        currentLang,
        (progress: ImportProgressData) => {
          setImportProgress(progress);
        },
        t
      );

      setMissingCards(missing);

      if (finalCards.length > 0) {
        setImportedCardsCache(finalCards);
        setImportProgress((prev: ImportProgressData) => ({ ...prev, isImporting: false, current: prev.total }));
      } else {
        setErrorMsg(t('deck.importError'));
        setImportProgress((prev: ImportProgressData) => ({ ...prev, isImporting: false }));
      }
    } catch (err: unknown) {
      logger.error('Failed to import deck from text:', err);
      if (err instanceof Error && err.message === 'ScryfallOffline') {
        setErrorMsg(t('search.scryfallOffline'));
      } else if (err instanceof Error && err.message === 'ScryfallRateLimited') {
        setErrorMsg(t('search.rateLimited'));
      } else {
        setErrorMsg(t('deck.importError'));
      }
      setImportProgress((prev: ImportProgressData) => ({ ...prev, isImporting: false }));
    }
  };

  const finishImport = () => {
    setIsProgressModalOpen(false);
    if (importedCardsCache.length > 0) {
      const deckIdToLoad = editingDeckId || '';
      const deckNameToLoad = editingDeckName || t('deck.importedDeckName');
      const deckFormatToLoad = editingDeckFormat || DeckFormatType.FREEFORM;

      onLoadDeckToEdit(deckIdToLoad, deckNameToLoad, deckFormatToLoad, importedCardsCache);
      showToast(t('deck.deckImported'));
      setIsTextImportOpen(false);
    }
  };

  return {
    isImporting: importProgress.isImporting,
    errorMsg,
    setErrorMsg,
    importTextDeck,
    isProgressModalOpen,
    setIsProgressModalOpen,
    importProgress,
    missingCards,
    finishImport
  };
}
