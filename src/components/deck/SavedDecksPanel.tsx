import { useTranslation } from 'react-i18next';
import { FaLayerGroup, FaChevronDown } from 'react-icons/fa';
import DeckList, { DeckListProps } from './DeckList';

interface SavedDecksPanelProps extends DeckListProps {
  // Total saved decks, shown in the collapse toggle badge. Distinct from
  // `decks.length`, which may include the in-progress (unsaved) editing deck.
  savedDeckCount: number;
  isMobileOpen: boolean;
  onToggleMobileOpen: () => void;
}

function SavedDecksPanel({ savedDeckCount, isMobileOpen, onToggleMobileOpen, ...deckListProps }: SavedDecksPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="col-span-1">
      {/* Below lg the saved-decks list collapses behind this toggle so it
          stops permanently eating vertical space on phones. */}
      <button
        type="button"
        onClick={onToggleMobileOpen}
        aria-expanded={isMobileOpen}
        aria-controls="saved-decks-panel"
        className="lg:hidden w-full min-h-11 flex items-center justify-between gap-2 px-4 py-2.5 mb-2 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-800 dark:text-gray-200 shadow-sm active:scale-[0.99] transition-all duration-200 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <FaLayerGroup className="text-primary shrink-0" />
          {t('deck.savedDecks')}
          <span className="count-badge">{savedDeckCount}</span>
        </span>
        <FaChevronDown
          className={`text-xs text-gray-400 transition-transform duration-200 ${isMobileOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div id="saved-decks-panel" className={`${isMobileOpen ? 'block' : 'hidden'} lg:block`}>
        <DeckList {...deckListProps} />
      </div>
    </div>
  );
}

export default SavedDecksPanel;
