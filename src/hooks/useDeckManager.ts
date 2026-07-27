import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { Card } from '../types/Card';
import { Deck, DeckFormat, DeckRelatedToken } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { validateDeck, ValidationResult } from '../utils/deckValidator';
import { downloadAsJson } from '../services/fileDownload';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useTranslation } from 'react-i18next';
import { dispatchToast } from '../utils/toastHelper';
import { parseDeckText, fetchCardsFromParsedList, ImportProgressData } from '../services/deckImportService';
import { saveDeckSnapshotIfChanged, saveDeckSnapshot } from '../services/deckVersionService';
import { DecodedShareDeck, decodeShareString, parseDeckFileContent } from '../services/deckShare';

export default function useDeckManager(
  currentDeck: Card[],
  editingDeckId: string | null,
  editingDeckFormat: DeckFormat,
  onCancelEdit: () => void
) {
  const savedDecks = useLiveQuery(() => db.decks.toArray()) || [];
  const { t, i18n } = useTranslation();
  const [deckName, setDeckName] = useState('');
  const [deckFormat, setDeckFormat] = useState<DeckFormat>(DeckFormatType.FREEFORM);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [deckValidation, setDeckValidation] = useState<ValidationResult>({
    isValid: true,
    errors: []
  });

  const [importProgress, setImportProgress] = useState<ImportProgressData>({
    isImporting: false,
    current: 0,
    total: 0,
    message: ''
  });
  const [fileMissingCards, setFileMissingCards] = useState<string[]>([]);
  const [fileImportError, setFileImportError] = useState<string | null>(null);
  const [isFileImportModalOpen, setIsFileImportModalOpen] = useState(false);

  // Recalculate validation whenever deck format or cards change
  useEffect(() => {
    const activeFormat = editingDeckId ? editingDeckFormat : deckFormat;
    setDeckValidation(validateDeck(currentDeck, activeFormat));
  }, [currentDeck, deckFormat, editingDeckFormat, editingDeckId]);

  /** Snapshots a deck after a successful save; never fails the save itself. */
  const snapshotQuietly = async (deck: Deck): Promise<void> => {
    try {
      await saveDeckSnapshotIfChanged(deck);
    } catch (error) {
      logger.error('Failed to snapshot deck version:', error);
    }
  };

  const saveDeck = async (
    name: string,
    format: DeckFormat,
    cards: Card[],
    notes?: string,
    relatedTokens?: DeckRelatedToken[]
  ): Promise<{ success: boolean; errorKey?: string; createdDeck?: Deck }> => {
    if (!name.trim()) {
      return { success: false, errorKey: 'deckNamePlaceholder' };
    }

    if (cards.length === 0) {
      return { success: false, errorKey: 'addCardsMessage' };
    }

    const newDeck: Deck = {
      id: Date.now().toString(),
      name: name.trim(),
      cards,
      format,
      notes,
      relatedTokens,
      createdAt: new Date().toISOString()
    };

    try {
      await db.decks.put(newDeck);
    } catch (error) {
      logger.error('Failed to save deck:', error);
      return { success: false, errorKey: 'deck.saveError' };
    }
    await snapshotQuietly(newDeck);
    setDeckName('');
    setShowSaveDialog(false);
    return { success: true, createdDeck: newDeck };
  };

  const saveEditedDeck = async (
    id: string,
    name: string,
    format: DeckFormat,
    cards: Card[],
    notes?: string,
    relatedTokens?: DeckRelatedToken[]
  ): Promise<{ success: boolean; errorKey?: string }> => {
    try {
      const existing = await db.decks.get(id);
      if (existing) {
        const updated: Deck = {
          ...existing,
          name: name.trim(),
          format,
          cards,
          notes,
          relatedTokens: relatedTokens || existing.relatedTokens
        };
        await db.decks.put(updated);
        await snapshotQuietly(updated);
      }
      return { success: true };
    } catch (error) {
      logger.error('Failed to save edited deck:', error);
      return { success: false, errorKey: 'deck.saveError' };
    }
  };

  const deleteDeck = async (deckId: string): Promise<Deck | undefined> => {
    try {
      const deckToDelete = await db.decks.get(deckId);
      if (!deckToDelete) return undefined;

      await db.decks.delete(deckId);

      if (selectedDeck?.id === deckId) {
        setSelectedDeck(null);
      }
      if (editingDeckId === deckId) {
        onCancelEdit();
      }

      return deckToDelete;
    } catch (error) {
      logger.error('Failed to delete deck:', error);
      dispatchToast(t('deck.deleteError'), 'danger');
      return undefined;
    }
  };

  const restoreDeck = async (deck: Deck) => {
    try {
      const existing = await db.decks.get(deck.id);
      if (existing) return;
      await db.decks.put(deck);
    } catch (error) {
      logger.error('Failed to restore deck:', error);
      dispatchToast(t('deck.restoreError'), 'danger');
    }
  };

  const exportDeck = (deck: Deck) => {
    downloadAsJson(deck, `${deck.name.replace(/\\s+/g, '_')}.json`);
  };

  const exportDeckAsDec = (deck: Deck) => {
    try {
      const cardCounts: Record<string, { count: number; name: string; set?: string; number?: string }> = {};
      deck.cards.forEach((card) => {
        const key = `${card.name}|${card.set || ''}|${card.collector_number || ''}`;
        if (!cardCounts[key]) {
          cardCounts[key] = { count: 0, name: card.name, set: card.set, number: card.collector_number };
        }
        cardCounts[key].count++;
      });

      let content = `// ${deck.name}\n// Format: ${deck.format}\n\n`;
      for (const data of Object.values(cardCounts)) {
        if (data.set && data.number) {
          content += `${data.count} ${data.name} (${data.set.toUpperCase()}) ${data.number}\n`;
        } else {
          content += `${data.count} ${data.name}\n`;
        }
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${deck.name.replace(/\\s+/g, '_')}.dec`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      logger.error('Failed to export deck as .dec:', error);
      dispatchToast(t('common.unexpectedError'), 'danger');
    }
  };

  const exportAllDecks = () => {
    downloadAsJson(savedDecks, `all-decks-${Date.now()}.json`);
  };

  const saveTokensToDeck = async (deckId: string, tokens: DeckRelatedToken[]) => {
    try {
      const existing = await db.decks.get(deckId);
      if (existing) {
        await db.decks.put({ ...existing, relatedTokens: tokens });
      }
    } catch (error) {
      logger.error('Failed to save tokens to deck:', error);
      dispatchToast(t('deck.saveError'), 'danger');
    }
  };

  // Sets which card's art represents the deck on its deck box. The live query
  // over db.decks re-renders the list automatically after the update.
  const setDeckCover = async (deckId: string, coverCardId: string) => {
    try {
      await db.decks.update(deckId, { coverCardId });
    } catch (error) {
      logger.error('Failed to set deck cover:', error);
      dispatchToast(t('deck.saveError'), 'danger');
    }
  };

  // Resolves a decoded share payload (from a link or a .deck file) into real
  // cards via Scryfall and saves it, reusing the file-import progress modal.
  const resolveShareDeck = async (decoded: DecodedShareDeck): Promise<void> => {
    setIsFileImportModalOpen(true);
    setFileImportError(null);
    setFileMissingCards([]);
    setImportProgress({
      isImporting: true,
      current: 0,
      total: decoded.entries.length,
      message: t('common.loading')
    });

    try {
      const currentLang = i18n.language || 'en';
      const { cards, missing } = await fetchCardsFromParsedList(decoded.entries, currentLang, (progress) => {
        setImportProgress(progress);
      });

      setFileMissingCards(missing);

      if (cards.length === 0) {
        setFileImportError(t('deck.importError'));
        setImportProgress((prev) => ({ ...prev, isImporting: false }));
        return;
      }

      const newDeck: Deck = {
        id: Date.now().toString(),
        name: decoded.name || t('deck.importedDeckName'),
        cards,
        format: decoded.format || DeckFormatType.FREEFORM,
        createdAt: new Date().toISOString()
      };
      await db.decks.put(newDeck);
      setImportProgress((prev) => ({ ...prev, isImporting: false, current: prev.total }));
      dispatchToast(t('deck.deckImported'));
    } catch (error) {
      logger.error('Failed to import shared deck:', error);
      if (error instanceof Error && error.message === 'ScryfallOffline') {
        setFileImportError(t('search.scryfallOffline'));
      } else if (error instanceof Error && error.message === 'ScryfallRateLimited') {
        setFileImportError(t('search.rateLimited'));
      } else {
        setFileImportError(t('deck.importError'));
      }
      setImportProgress((prev) => ({ ...prev, isImporting: false }));
    }
  };

  // Imports a deck encoded in a shareable link (e.g. opened from another device).
  const importSharedDeckString = async (encoded: string): Promise<void> => {
    const decoded = decodeShareString(encoded);
    if (!decoded) {
      setIsFileImportModalOpen(true);
      setFileMissingCards([]);
      setFileImportError(t('deck.invalidShareLink'));
      setImportProgress((prev) => ({ ...prev, isImporting: false }));
      return;
    }
    await resolveShareDeck(decoded);
  };

  // Saves an independent copy of a deck under a "(copy)" name.
  const duplicateDeck = async (deck: Deck): Promise<Deck | undefined> => {
    try {
      const copy: Deck = {
        ...deck,
        id: Date.now().toString(),
        name: `${deck.name} (${t('common.copy')})`,
        createdAt: new Date().toISOString()
      };
      await db.decks.put(copy);
      // Seed the copy's version history with its initial state.
      await saveDeckSnapshot(copy).catch(() => undefined);
      return copy;
    } catch (error) {
      logger.error('Failed to duplicate deck:', error);
      dispatchToast(t('deck.saveError'), 'danger');
      return undefined;
    }
  };

  const importDeckFile = async (file: File): Promise<void> => {
    setIsFileImportModalOpen(true);
    setFileImportError(null);
    setFileMissingCards([]);
    setImportProgress({ isImporting: true, current: 0, total: 100, message: t('common.loading') });

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;

          if (file.name.endsWith('.json')) {
            const deck = JSON.parse(content) as Deck;
            if (!deck.name || !Array.isArray(deck.cards)) {
              setFileImportError(t('deck.invalidFile'));
              setImportProgress((prev) => ({ ...prev, isImporting: false }));
              resolve();
              return;
            }
            deck.id = Date.now().toString();
            if (!deck.format) deck.format = DeckFormatType.FREEFORM;
            await db.decks.put(deck);
            setImportProgress((prev) => ({ ...prev, isImporting: false, current: prev.total }));
            dispatchToast(t('deck.deckImported'));
            resolve();
          } else if (file.name.endsWith('.deck')) {
            const decoded = parseDeckFileContent(content);
            if (!decoded) {
              setFileImportError(t('deck.invalidFile'));
              setImportProgress((prev) => ({ ...prev, isImporting: false }));
              resolve();
              return;
            }
            await resolveShareDeck(decoded);
            resolve();
          } else if (file.name.endsWith('.dec') || file.name.endsWith('.txt')) {
            const parsed = parseDeckText(content);
            if (parsed.length === 0) {
              setFileImportError(t('deck.invalidFile'));
              setImportProgress((prev) => ({ ...prev, isImporting: false }));
              resolve();
              return;
            }

            try {
              const currentLang = i18n.language || 'en';
              const { cards, missing } = await fetchCardsFromParsedList(parsed, currentLang, (progress) => {
                setImportProgress(progress);
              });

              setFileMissingCards(missing);

              if (cards.length === 0) {
                setFileImportError(t('deck.importError'));
                setImportProgress((prev) => ({ ...prev, isImporting: false }));
                resolve();
                return;
              }

              const newDeck: Deck = {
                id: Date.now().toString(),
                name: file.name.replace(/\.(dec|txt)$/i, ''),
                cards,
                format: DeckFormatType.FREEFORM,
                createdAt: new Date().toISOString()
              };
              await db.decks.put(newDeck);

              setImportProgress((prev) => ({ ...prev, isImporting: false, current: prev.total }));
              dispatchToast(t('deck.deckImported'));
              resolve();
            } catch (error) {
              logger.error('Failed to import deck file (text list):', error);
              if (error instanceof Error && error.message === 'ScryfallOffline') {
                setFileImportError(t('search.scryfallOffline'));
              } else if (error instanceof Error && error.message === 'ScryfallRateLimited') {
                setFileImportError(t('search.rateLimited'));
              } else {
                setFileImportError(t('deck.importError'));
              }
              setImportProgress((prev) => ({ ...prev, isImporting: false }));
              resolve();
            }
          } else {
            setFileImportError(t('deck.invalidFile'));
            setImportProgress((prev) => ({ ...prev, isImporting: false }));
            resolve();
          }
        } catch (error) {
          logger.error('Failed to import deck file:', error);
          setFileImportError(t('deck.invalidFile'));
          setImportProgress((prev) => ({ ...prev, isImporting: false }));
          resolve();
        }
      };
      reader.onerror = () => {
        logger.error('Failed to read deck file:', reader.error);
        setFileImportError(t('deck.invalidFile'));
        setImportProgress((prev) => ({ ...prev, isImporting: false }));
        resolve();
      };
      reader.readAsText(file);
    });
  };

  const closeFileImportModal = () => {
    setIsFileImportModalOpen(false);
  };

  return {
    savedDecks,
    deckName,
    setDeckName,
    deckFormat,
    setDeckFormat,
    showSaveDialog,
    setShowSaveDialog,
    selectedDeck,
    setSelectedDeck,
    deckValidation,
    importProgress,
    saveDeck,
    saveEditedDeck,
    deleteDeck,
    exportDeck,
    exportDeckAsDec,
    exportAllDecks,
    importDeckFile,
    importSharedDeckString,
    duplicateDeck,
    saveTokensToDeck,
    setDeckCover,
    restoreDeck,
    fileMissingCards,
    fileImportError,
    isFileImportModalOpen,
    closeFileImportModal
  };
}
