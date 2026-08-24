import { Card } from '../../types/Card';
import { Deck, DeckFormat, DeckRelatedToken } from '../../types/Deck';
import { ShowToastFn } from '../../types/Toast';
import { DialogState } from '../../hooks/useDialog';
import { ImportProgressData } from '../../services/deckImportService';
import DeckVersionHistoryModal from './DeckVersionHistoryModal';
import DeckSuggestionsModal from './DeckSuggestionsModal';
import DeckCoverModal from './DeckCoverModal';
import DeckSaveDialog from './DeckSaveDialog';
import CustomDialog from '../ui/CustomDialog';
import DeckTextImportModal from './DeckTextImportModal';
import DeckImportProgressModal from './DeckImportProgressModal';
import { DeckExportDialog } from './DeckExportDialog';

interface DeckManagerModalsProps {
  readonly showToast: ShowToastFn;
  readonly editDeckInfoTitle: string;

  readonly showSaveDialog: boolean;
  readonly deckName: string;
  readonly deckFormat: DeckFormat;
  readonly onDeckNameChange: (name: string) => void;
  readonly onDeckFormatChange: (format: DeckFormat) => void;
  readonly onSaveDeck: () => void;
  readonly onCancelSaveDialog: () => void;

  readonly deckInfoEdit: Deck | null;
  readonly infoName: string;
  readonly infoFormat: DeckFormat;
  readonly onInfoNameChange: (name: string) => void;
  readonly onInfoFormatChange: (format: DeckFormat) => void;
  readonly onSaveDeckInfo: () => void;
  readonly onCloseDeckInfoEditor: () => void;

  readonly dialogState: DialogState;
  readonly onCloseDialog: () => void;

  readonly isHistoryOpen: boolean;
  readonly selectedDeck: Deck | null;
  readonly onRestoreVersion: (version: {
    deckId: string;
    name: string;
    format: DeckFormat;
    cards: Card[];
    relatedTokens?: DeckRelatedToken[];
  }) => void;
  readonly onCloseHistory: () => void;

  readonly isSuggestionsOpen: boolean;
  readonly currentDeck: Card[];
  readonly activeFormat: DeckFormat;
  readonly onAddToDeck: (card: Card) => void;
  readonly onCloseSuggestions: () => void;

  readonly deckForCover: Deck | null;
  readonly onSelectCover: (cardId: string) => Promise<void>;
  readonly onCloseCoverModal: () => void;

  readonly deckToExport: Deck | null;
  readonly onExportJson: (deck: Deck) => void;
  readonly onExportDec: (deck: Deck) => void;
  readonly onCancelExport: () => void;

  readonly isTextImportOpen: boolean;
  readonly onCloseTextImport: () => void;
  readonly onImportText: (text: string) => void;
  readonly isTextImporting: boolean;
  readonly textImportErrorMsg: string | null;

  readonly isProgressModalOpen: boolean;
  readonly textImportProgress: ImportProgressData;
  readonly textMissingCards: string[];
  readonly onCloseProgressModal: () => void;
  readonly onFinishTextImport: () => void;

  readonly isFileImportModalOpen: boolean;
  readonly fileImportProgress: ImportProgressData;
  readonly fileMissingCards: string[];
  readonly fileImportError: string | null;
  readonly onCloseFileImportModal: () => void;
}

/** The tail of dialogs/modals DeckManager can show; extracted verbatim, same tree. */
export function DeckManagerModals({
  showToast,
  editDeckInfoTitle,
  showSaveDialog,
  deckName,
  deckFormat,
  onDeckNameChange,
  onDeckFormatChange,
  onSaveDeck,
  onCancelSaveDialog,
  deckInfoEdit,
  infoName,
  infoFormat,
  onInfoNameChange,
  onInfoFormatChange,
  onSaveDeckInfo,
  onCloseDeckInfoEditor,
  dialogState,
  onCloseDialog,
  isHistoryOpen,
  selectedDeck,
  onRestoreVersion,
  onCloseHistory,
  isSuggestionsOpen,
  currentDeck,
  activeFormat,
  onAddToDeck,
  onCloseSuggestions,
  deckForCover,
  onSelectCover,
  onCloseCoverModal,
  deckToExport,
  onExportJson,
  onExportDec,
  onCancelExport,
  isTextImportOpen,
  onCloseTextImport,
  onImportText,
  isTextImporting,
  textImportErrorMsg,
  isProgressModalOpen,
  textImportProgress,
  textMissingCards,
  onCloseProgressModal,
  onFinishTextImport,
  isFileImportModalOpen,
  fileImportProgress,
  fileMissingCards,
  fileImportError,
  onCloseFileImportModal
}: DeckManagerModalsProps) {
  return (
    <>
      {showSaveDialog ? (
        <DeckSaveDialog
          deckName={deckName}
          deckFormat={deckFormat}
          onDeckNameChange={onDeckNameChange}
          onDeckFormatChange={onDeckFormatChange}
          onSave={onSaveDeck}
          onCancel={onCancelSaveDialog}
        />
      ) : null}

      {deckInfoEdit ? (
        <DeckSaveDialog
          deckName={infoName}
          deckFormat={infoFormat}
          onDeckNameChange={onInfoNameChange}
          onDeckFormatChange={onInfoFormatChange}
          onSave={onSaveDeckInfo}
          onCancel={onCloseDeckInfoEditor}
          title={editDeckInfoTitle}
        />
      ) : null}

      {dialogState.isOpen ? (
        <CustomDialog
          isOpen={dialogState.isOpen}
          type={dialogState.type}
          title={dialogState.title}
          message={dialogState.message}
          onConfirm={dialogState.onConfirm}
          onCancel={onCloseDialog}
          variant={dialogState.variant}
        />
      ) : null}

      {isHistoryOpen && selectedDeck ? (
        <DeckVersionHistoryModal
          deck={selectedDeck}
          onRestore={(version) => {
            onRestoreVersion(version);
            onCloseHistory();
          }}
          onClose={onCloseHistory}
        />
      ) : null}

      {isSuggestionsOpen ? (
        <DeckSuggestionsModal
          cards={selectedDeck ? selectedDeck.cards : currentDeck}
          format={selectedDeck ? selectedDeck.format : activeFormat}
          onAddToDeck={onAddToDeck}
          onClose={onCloseSuggestions}
        />
      ) : null}

      {deckForCover ? (
        <DeckCoverModal
          deck={deckForCover}
          onSelect={async (cardId) => {
            await onSelectCover(cardId);
          }}
          onClose={onCloseCoverModal}
        />
      ) : null}

      {deckToExport ? (
        <DeckExportDialog
          deck={deckToExport}
          onExportJson={onExportJson}
          onExportDec={onExportDec}
          onCancel={onCancelExport}
          showToast={showToast}
        />
      ) : null}

      <DeckTextImportModal
        isOpen={isTextImportOpen}
        onClose={onCloseTextImport}
        onImport={onImportText}
        isImporting={isTextImporting}
        errorMsg={textImportErrorMsg}
      />

      <DeckImportProgressModal
        isOpen={isProgressModalOpen}
        progress={textImportProgress}
        missingCards={textMissingCards}
        errorMsg={textImportErrorMsg}
        onClose={onCloseProgressModal}
        onFinish={onFinishTextImport}
      />

      <DeckImportProgressModal
        isOpen={isFileImportModalOpen}
        progress={fileImportProgress}
        missingCards={fileMissingCards}
        errorMsg={fileImportError}
        onClose={onCloseFileImportModal}
      />
    </>
  );
}

export default DeckManagerModals;
