import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportProgressData } from '../../services/deckImportService';

const IDLE_PROGRESS: ImportProgressData = { isImporting: false, current: 0, total: 0, message: '' };

/**
 * The state the deck import modal renders. Every import path reports through it, so progress
 * and failure look the same whether the deck came from a file, a text list or a share link.
 */
export function useImportProgressModal() {
  const { t } = useTranslation();
  const [importProgress, setImportProgress] = useState<ImportProgressData>(IDLE_PROGRESS);
  const [fileMissingCards, setFileMissingCards] = useState<string[]>([]);
  const [fileImportError, setFileImportError] = useState<string | null>(null);
  const [isFileImportModalOpen, setIsFileImportModalOpen] = useState(false);

  const beginImport = (total: number) => {
    setIsFileImportModalOpen(true);
    setFileImportError(null);
    setFileMissingCards([]);
    setImportProgress({ isImporting: true, current: 0, total, message: t('common.loading') });
  };

  const completeImport = () => {
    setImportProgress((previous) => ({ ...previous, isImporting: false, current: previous.total }));
  };

  const failImport = (errorKey: string) => {
    setFileImportError(t(errorKey));
    setImportProgress((previous) => ({ ...previous, isImporting: false }));
  };

  // Scryfall's own failures have to reach the modal as themselves: "deck could not be
  // imported" over a rate limit sends the user back to a file that was never the problem.
  const failFromScryfall = (error: unknown) => {
    if (error instanceof Error && error.message === 'ScryfallOffline') {
      failImport('search.scryfallOffline');
    } else if (error instanceof Error && error.message === 'ScryfallRateLimited') {
      failImport('search.rateLimited');
    } else {
      failImport('deck.importError');
    }
  };

  const closeFileImportModal = () => {
    setIsFileImportModalOpen(false);
  };

  return {
    importProgress,
    setImportProgress,
    fileMissingCards,
    setFileMissingCards,
    fileImportError,
    isFileImportModalOpen,
    setIsFileImportModalOpen,
    beginImport,
    completeImport,
    failImport,
    failFromScryfall,
    closeFileImportModal
  };
}
