import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaSave,
  FaPlus,
  FaTrash,
  FaFileImport,
  FaTimes,
  FaLightbulb,
  FaBook,
  FaColumns,
  FaHistory,
  FaMagic
} from 'react-icons/fa';
import { Deck } from '../../types/Deck';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { deckActionLabels } from '../../utils/deckActionLabels';

interface DeckManagerToolbarProps {
  selectedDeck: Deck | null;
  showDeckList: boolean;
  onToggleDeckList: () => void;
  editingDeckId: string | null;
  /** Name of the deck being edited — used to make save/clear targets explicit. */
  editingDeckName: string;
  currentDeckCount: number;
  hasSavedDecks: boolean;
  showImportExportDropdown: boolean;
  setShowImportExportDropdown: (value: boolean) => void;
  onSaveChanges: () => void;
  onSaveAsNew: () => void;
  onCancelEdit: () => void;
  onOpenSaveDialog: () => void;
  onClearDeck: () => void;
  onOpenTextImport: () => void;
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportAll: () => void;
  onOpenHistory: () => void;
  // Opens the Scryfall suggestions modal. Absent when the working deck is empty.
  onOpenSuggestions?: () => void;
}

/** Header for the deck manager: title, info tooltip, and the save/clear/import-export toolbar. */
export function DeckManagerToolbar({
  selectedDeck,
  showDeckList,
  onToggleDeckList,
  editingDeckId,
  editingDeckName,
  currentDeckCount,
  hasSavedDecks,
  showImportExportDropdown,
  setShowImportExportDropdown,
  onSaveChanges,
  onSaveAsNew,
  onCancelEdit,
  onOpenSaveDialog,
  onClearDeck,
  onOpenTextImport,
  onImportFile,
  onExportAll,
  onOpenHistory,
  onOpenSuggestions
}: DeckManagerToolbarProps) {
  const { t } = useTranslation();
  useEscapeKey(() => setShowImportExportDropdown(false), showImportExportDropdown);

  // Make the save/clear targets explicit: name the deck being edited, or call
  // out that the unsaved deck is temporary. On small screens the buttons
  // collapse to icons and these strings become their accessible names.
  const { saveLabel, clearLabel } = deckActionLabels(t, editingDeckId, editingDeckName);
  // Icon-only on small screens, but keep a >=44px hit area.
  const responsiveActionClasses = 'max-sm:w-11 max-sm:h-11 max-sm:p-0 max-sm:justify-center';
  const labelClasses = 'hidden sm:inline-block sm:max-w-56 truncate';

  return (
    <div className="workspace-header">
      <div className="manager-title-row">
        <h2 className="text-gray-900 dark:text-white text-2xl font-serif font-bold transition-colors duration-300 flex items-center gap-2 w-full">
          <FaBook className="text-primary text-xl" />
          {t('deck.deckManager')}
          <div className="manager-info-tooltip-trigger group/tooltip">
            <button type="button" className="manager-info-tooltip-btn" aria-label={t('common.info')}>
              <FaLightbulb className="text-yellow-500 text-base" />
            </button>
            <div className="manager-info-tooltip-panel">
              <p className="font-medium leading-relaxed">{t('validation.savedLocationNote')}</p>
            </div>
          </div>

          {onOpenSuggestions ? (
            <button
              type="button"
              onClick={onOpenSuggestions}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title={t('deck.suggestionsTitle')}
            >
              <FaMagic className="text-xs shrink-0" />
              <span className="hidden sm:inline">{t('common.suggestions')}</span>
            </button>
          ) : null}

          {selectedDeck ? (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                title={t('deck.versionHistory')}
              >
                <FaHistory className="text-xs shrink-0" />
                <span className="hidden sm:inline">{t('deck.versionHistory')}</span>
              </button>
              <button
                type="button"
                onClick={onToggleDeckList}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                title={showDeckList ? t('deck.hideDeckList') : t('deck.showDeckList')}
              >
                <FaColumns className="text-xs shrink-0" />
                <span>{showDeckList ? t('deck.hideDeckList') : t('deck.showDeckList')}</span>
              </button>
            </div>
          ) : null}
        </h2>
      </div>

      {!selectedDeck ? (
        // Hidden below `sm` (wrapper div: .manager-toolbar is unlayered CSS,
        // so a utility on the same element could not override its display).
        // The navbar's MobilePageMenu — visible at the same breakpoint —
        // covers save/save-as-new/clear, text/file import and export-all;
        // cancel-edit stays reachable via the EditingDeckBanner.
        <div className="max-sm:hidden">
          <div className="manager-toolbar">
            <div className="toolbar-group">
              {editingDeckId ? (
                <div className="toolbar-group-responsive">
                  <button
                    id="save-changes-btn"
                    type="button"
                    onClick={onSaveChanges}
                    className={`primary-button text-xs py-1.5 px-3 ${responsiveActionClasses}`}
                    aria-label={saveLabel}
                    title={saveLabel}
                  >
                    <FaSave className="text-xs shrink-0" />
                    <span className={labelClasses}>{saveLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSaveAsNew}
                    className={`success-button text-xs py-1.5 px-3 ${responsiveActionClasses}`}
                    aria-label={t('deck.saveAsNew')}
                    title={t('deck.saveAsNew')}
                  >
                    <FaPlus className="text-xs shrink-0" />
                    <span className={labelClasses}>{t('deck.saveAsNew')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className={`danger-button text-xs py-1.5 px-3 ${responsiveActionClasses}`}
                    aria-label={t('common.cancel')}
                    title={t('common.cancel')}
                  >
                    <FaTimes className="text-xs shrink-0" />
                    <span className={labelClasses}>{t('common.cancel')}</span>
                  </button>
                </div>
              ) : (
                <button
                  id="save-deck-btn"
                  type="button"
                  onClick={onOpenSaveDialog}
                  disabled={currentDeckCount === 0}
                  className={`success-button text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed ${responsiveActionClasses}`}
                  aria-label={`${saveLabel} (${currentDeckCount} ${t('common.cards')})`}
                  title={`${saveLabel} (${currentDeckCount} ${t('common.cards')})`}
                >
                  <FaSave className="text-xs shrink-0" />
                  <span className={labelClasses}>
                    {saveLabel} ({currentDeckCount} {t('common.cards')})
                  </span>
                </button>
              )}

              <button
                id="clear-deck-btn"
                type="button"
                onClick={onClearDeck}
                disabled={currentDeckCount === 0}
                className={`danger-button text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed ${responsiveActionClasses}`}
                aria-label={clearLabel}
                title={clearLabel}
              >
                <FaTrash className="text-xs shrink-0" />
                <span className={labelClasses}>{clearLabel}</span>
              </button>
            </div>

            <div className="toolbar-actions">
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => setShowImportExportDropdown(!showImportExportDropdown)}
                  className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                >
                  <FaFileImport className="text-xs shrink-0" />
                  {t('deck.importExport')}
                  <span className="text-[10px] opacity-75">▼</span>
                </button>
                {showImportExportDropdown ? (
                  <>
                    {/* Backdrop click is a mouse-only convenience; Escape provides the keyboard-equivalent action. */}
                    <div
                      className="fixed inset-0 z-[var(--z-backdrop)]"
                      onClick={() => setShowImportExportDropdown(false)}
                      aria-hidden="true"
                    />
                    <div className="import-export-dropdown">
                      <span className="import-export-dropdown-section">── {t('common.import')} ──</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowImportExportDropdown(false);
                          onOpenTextImport();
                        }}
                        className="import-export-dropdown-item"
                      >
                        <FaFileImport className="text-gray-400 shrink-0" />
                        {t('deck.importTextList')}
                      </button>
                      <label className="import-export-dropdown-item">
                        <FaFileImport className="text-gray-400 shrink-0" />
                        {t('deck.importDeck')}{' '}
                        <span className="text-[10px] text-gray-400 font-mono ml-auto">.json / .dec</span>
                        <input
                          id="deck-import-file-input"
                          type="file"
                          accept=".json,.dec,.txt,.deck"
                          onChange={(e) => {
                            setShowImportExportDropdown(false);
                            onImportFile(e);
                          }}
                          className="hidden"
                        />
                      </label>
                      {hasSavedDecks ? (
                        <>
                          <div className="import-export-dropdown-divider" />
                          <span className="import-export-dropdown-section">── {t('deck.export')} ──</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowImportExportDropdown(false);
                              onExportAll();
                            }}
                            className="import-export-dropdown-item"
                          >
                            {t('deck.exportAllDecks')}{' '}
                            <span className="text-[10px] text-gray-400 font-mono ml-auto">.json</span>
                          </button>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
