import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaBars,
  FaSave,
  FaPlus,
  FaTrash,
  FaDiceD20,
  FaPrint,
  FaFileExport,
  FaFileImport,
  FaFilter,
  FaLayerGroup,
  FaEdit,
  FaHistory,
  FaColumns
} from 'react-icons/fa';
import { PendingAction, useDeckStore } from '../../store/useDeckStore';
import { dispatchPendingAction } from '../../hooks/usePendingAction';
import { deckActionLabels } from '../../utils/deckActionLabels';
import BottomSheet from '../ui/BottomSheet';
import { AppTab } from '../../types';

interface MobilePageMenuProps {
  activeTab: AppTab;
}

interface PageMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  action: PendingAction;
  disabled?: boolean;
}

/**
 * Mobile-only (< sm) page-actions menu in the navbar. Opens a bottom sheet with
 * the current page's actions. Below `sm` this menu REPLACES the on-screen
 * toolbars (search filter row, DeckManagerToolbar, DeckActionBar) — they are
 * hidden at the same breakpoint that shows this button, so every action they
 * offer must exist here. Actions are dispatched through the store's
 * pendingAction channel — the same mechanism keyboard shortcuts use — so the
 * owning component executes them with its full context.
 */
function MobilePageMenu({ activeTab }: MobilePageMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const currentDeckLength = useDeckStore((state) => state.currentDeck.length);
  const editingDeck = useDeckStore((state) => state.editingDeck);
  const selectedDeckSummary = useDeckStore((state) => state.selectedDeckSummary);
  const savedDeckCount = useDeckStore((state) => state.savedDeckCount);

  const hasDeckCards = currentDeckLength > 0;
  const isEditing = editingDeck.deckId !== null;
  const { saveLabel, clearLabel } = deckActionLabels(t, editingDeck.deckId, editingDeck.deckName);

  // The on-screen toolbars (DeckManagerToolbar, DeckActionBar) are hidden
  // below `sm`, so every action they offer must be reachable from here. Items
  // mirror the deck screen's three states: viewing a saved deck, editing a
  // deck, or building the temporary deck. The search tab has no item list of
  // its own — see handleButtonClick below.
  let items: PageMenuItem[];
  if (selectedDeckSummary) {
    const hasSelectedCards = selectedDeckSummary.cardCount > 0;
    items = [
      { key: 'edit', label: t('common.edit'), icon: <FaEdit />, action: 'edit-selected-deck' },
      {
        key: 'playtest',
        label: t('playtest.playtest'),
        icon: <FaDiceD20 />,
        action: 'playtest-deck',
        disabled: !hasSelectedCards
      },
      {
        key: 'print',
        label: t('print.printProxies'),
        icon: <FaPrint />,
        action: 'print-proxies',
        disabled: !hasSelectedCards
      },
      {
        key: 'export',
        label: t('deck.export'),
        icon: <FaFileExport />,
        action: 'export-deck',
        disabled: !hasSelectedCards
      },
      { key: 'history', label: t('deck.versionHistory'), icon: <FaHistory />, action: 'open-history' },
      { key: 'toggle-list', label: t('deck.hideDeckList'), icon: <FaColumns />, action: 'toggle-deck-list' },
      { key: 'saved', label: t('deck.savedDecks'), icon: <FaLayerGroup />, action: 'show-saved-decks' }
    ];
  } else {
    items = [
      { key: 'save', label: saveLabel, icon: <FaSave />, action: 'save-deck', disabled: !hasDeckCards },
      ...(isEditing
        ? [
            {
              key: 'save-as-new',
              label: t('deck.saveAsNew'),
              icon: <FaPlus />,
              action: 'save-deck-as-new' as PendingAction,
              disabled: !hasDeckCards
            }
          ]
        : []),
      { key: 'clear', label: clearLabel, icon: <FaTrash />, action: 'clear-deck', disabled: !hasDeckCards },
      {
        key: 'playtest',
        label: t('playtest.playtest'),
        icon: <FaDiceD20 />,
        action: 'playtest-deck',
        disabled: !hasDeckCards
      },
      {
        key: 'print',
        label: t('print.printProxies'),
        icon: <FaPrint />,
        action: 'print-proxies',
        disabled: !hasDeckCards
      },
      {
        key: 'export',
        label: t('deck.export'),
        icon: <FaFileExport />,
        action: 'export-deck',
        disabled: !hasDeckCards
      },
      { key: 'import-text', label: t('deck.importTextList'), icon: <FaFileImport />, action: 'import-deck-text' },
      { key: 'import-file', label: t('deck.importDeck'), icon: <FaFileImport />, action: 'import-deck-file' },
      {
        key: 'export-all',
        label: t('deck.exportAllDecks'),
        icon: <FaFileExport />,
        action: 'export-all-decks',
        disabled: savedDeckCount === 0
      },
      { key: 'saved', label: t('deck.savedDecks'), icon: <FaLayerGroup />, action: 'show-saved-decks' }
    ];
  }

  const handleItemClick = (action: PendingAction) => {
    setIsOpen(false);
    dispatchPendingAction(action);
  };

  // The search tab only ever offered two items here (focus search — redundant
  // since the search bar is already on screen — and advanced filters), so the
  // extra "open a menu to pick the one useful item" step just got in the way.
  // Go straight to the filters sheet instead.
  const handleButtonClick = () => {
    if (activeTab === 'search') {
      dispatchPendingAction('open-search-filters');
      return;
    }
    setIsOpen(true);
  };

  // The collection screen keeps its own always-visible toolbar, so there is no
  // navbar page menu for it.
  if (activeTab === 'collection') return null;

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        className="sm:hidden flex items-center justify-center w-11 h-11 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 active:scale-95 transition-all duration-200 cursor-pointer"
        aria-label={activeTab === 'search' ? t('search.advancedFilters') : t('common.pageMenu')}
        aria-haspopup="dialog"
        aria-expanded={activeTab === 'deck' ? isOpen : undefined}
      >
        {activeTab === 'search' ? <FaFilter className="text-base" /> : <FaBars className="text-base" />}
      </button>

      {activeTab === 'deck' && (
        <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} labelledBy="page-menu-title">
          <h3
            id="page-menu-title"
            className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3"
          >
            {t('common.pageMenu')} — {t('common.decksTab')}
          </h3>
          <div className="flex flex-col gap-1 pb-2">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled}
                onClick={() => handleItemClick(item.action)}
                className="flex items-center gap-3 w-full min-h-11 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.99] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="text-slate-400 dark:text-slate-500 shrink-0 w-5 flex justify-center">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}

export default MobilePageMenu;
