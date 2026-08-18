import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '../types/Card';
import { Deck, DeckFormat } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { db } from '../db/database';
import { useDeckExport } from './deck/useDeckExport';
import { useDeckFileImport } from './deck/useDeckFileImport';
import { useDeckRecords } from './deck/useDeckRecords';
import { useDeckSaving } from './deck/useDeckSaving';
import { useDeckValidation } from './deck/useDeckValidation';

export default function useDeckManager(
  currentDeck: Card[],
  editingDeckId: string | null,
  editingDeckFormat: DeckFormat,
  onCancelEdit: () => void
) {
  const savedDecks = useLiveQuery(() => db.decks.toArray()) || [];
  const [deckName, setDeckName] = useState('');
  const [deckFormat, setDeckFormat] = useState<DeckFormat>(DeckFormatType.FREEFORM);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);

  const deckValidation = useDeckValidation(currentDeck, editingDeckId, editingDeckFormat, deckFormat);

  const saving = useDeckSaving({
    onDeckSaved: () => {
      setDeckName('');
      setShowSaveDialog(false);
    }
  });

  const records = useDeckRecords({
    onDeckDeleted: (deckId) => {
      if (selectedDeck?.id === deckId) {
        setSelectedDeck(null);
      }
      if (editingDeckId === deckId) {
        onCancelEdit();
      }
    }
  });

  const deckExport = useDeckExport(savedDecks);
  const fileImport = useDeckFileImport();

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
    importProgress: fileImport.importProgress,
    saveDeck: saving.saveDeck,
    saveEditedDeck: saving.saveEditedDeck,
    deleteDeck: records.deleteDeck,
    exportDeck: deckExport.exportDeck,
    exportDeckAsDec: deckExport.exportDeckAsDec,
    exportAllDecks: deckExport.exportAllDecks,
    importDeckFile: fileImport.importDeckFile,
    importSharedDeckString: fileImport.importSharedDeckString,
    duplicateDeck: records.duplicateDeck,
    saveTokensToDeck: records.saveTokensToDeck,
    setDeckCover: records.setDeckCover,
    restoreDeck: records.restoreDeck,
    fileMissingCards: fileImport.fileMissingCards,
    fileImportError: fileImport.fileImportError,
    isFileImportModalOpen: fileImport.isFileImportModalOpen,
    closeFileImportModal: fileImport.closeFileImportModal
  };
}
