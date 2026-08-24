import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { Deck, DeckFormat } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';
import { db } from '../../db/database';
import { dispatchToast } from '../../utils/toastHelper';
import { newId } from '../../utils/id';
import { fetchCardsFromParsedList, ParseResult, parseDeckJson, parseDeckText } from '../../services/deckImportService';
import { DecodedShareDeck, decodeShareString, parseDeckFileContent } from '../../services/deckShare';
import { useImportProgressModal } from './useImportProgressModal';

/** Reads a file as text, resolving to null when the browser cannot read it at all. */
const readFileAsText = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => {
      logger.error('Failed to read deck file:', reader.error);
      resolve(null);
    };
    reader.readAsText(file);
  });

interface ParsedListImport {
  entries: ParseResult[];
  name: string;
  format: DeckFormat;
  /** Log line identifying which import path failed, since they share this resolver. */
  logLabel: string;
}

export function useDeckFileImport() {
  const { t, i18n } = useTranslation();
  const modal = useImportProgressModal();
  const { beginImport, completeImport, failImport, failFromScryfall, setImportProgress, setFileMissingCards } = modal;

  /** Resolves a parsed card list against Scryfall and stores the deck it produces. */
  const importParsedList = async ({ entries, name, format, logLabel }: ParsedListImport): Promise<void> => {
    try {
      const { cards, missing } = await fetchCardsFromParsedList(entries, i18n.language || 'en', (progress) => {
        setImportProgress(progress);
      });

      setFileMissingCards(missing);

      if (cards.length === 0) {
        failImport('deck.importError');
        return;
      }

      const newDeck: Deck = { id: newId(), name, cards, format, createdAt: new Date().toISOString() };
      await db.decks.put(newDeck);
      completeImport();
      dispatchToast(t('deck.deckImported'));
    } catch (error) {
      logger.error(logLabel, error);
      failFromScryfall(error);
    }
  };

  const resolveShareDeck = async (decoded: DecodedShareDeck): Promise<void> => {
    beginImport(decoded.entries.length);
    await importParsedList({
      entries: decoded.entries,
      name: decoded.name || t('deck.importedDeckName'),
      format: decoded.format || DeckFormatType.FREEFORM,
      logLabel: 'Failed to import shared deck:'
    });
  };

  const importSharedDeckString = async (encoded: string): Promise<void> => {
    const decoded = decodeShareString(encoded);
    if (!decoded) {
      modal.setIsFileImportModalOpen(true);
      setFileMissingCards([]);
      failImport('deck.invalidShareLink');
      return;
    }
    await resolveShareDeck(decoded);
  };

  const importDeckJson = async (content: string): Promise<void> => {
    const importedDecks = parseDeckJson(content);
    if (!importedDecks) {
      failImport('deck.invalidFile');
      return;
    }
    // bulkPut runs in one transaction, so a failure leaves nothing half-imported.
    await db.decks.bulkPut(importedDecks);
    completeImport();
    dispatchToast(
      importedDecks.length > 1 ? t('deck.decksImported', { count: importedDecks.length }) : t('deck.deckImported')
    );
  };

  const importShareFile = async (content: string): Promise<void> => {
    const decoded = parseDeckFileContent(content);
    if (!decoded) {
      failImport('deck.invalidFile');
      return;
    }
    await resolveShareDeck(decoded);
  };

  const importDeckList = async (fileName: string, content: string): Promise<void> => {
    const parsed = parseDeckText(content);
    if (parsed.length === 0) {
      failImport('deck.invalidFile');
      return;
    }
    await importParsedList({
      entries: parsed,
      name: fileName.replace(/\.(dec|txt)$/i, ''),
      format: DeckFormatType.FREEFORM,
      logLabel: 'Failed to import deck file (text list):'
    });
  };

  const importDeckFile = async (file: File): Promise<void> => {
    beginImport(100);

    const content = await readFileAsText(file);
    if (content === null) {
      failImport('deck.invalidFile');
      return;
    }

    try {
      if (file.name.endsWith('.json')) await importDeckJson(content);
      else if (file.name.endsWith('.deck')) await importShareFile(content);
      else if (file.name.endsWith('.dec') || file.name.endsWith('.txt')) await importDeckList(file.name, content);
      else failImport('deck.invalidFile');
    } catch (error) {
      logger.error('Failed to import deck file:', error);
      failImport('deck.invalidFile');
    }
  };

  return {
    importProgress: modal.importProgress,
    fileMissingCards: modal.fileMissingCards,
    fileImportError: modal.fileImportError,
    isFileImportModalOpen: modal.isFileImportModalOpen,
    closeFileImportModal: modal.closeFileImportModal,
    importDeckFile,
    importSharedDeckString
  };
}
