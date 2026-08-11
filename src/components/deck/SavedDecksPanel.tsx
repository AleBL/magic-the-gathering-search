import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaLayerGroup, FaChevronDown, FaThLarge } from 'react-icons/fa';
import DeckList, { DeckListProps } from './DeckList';
import AllDecksModal from './AllDecksModal';

interface SavedDecksPanelProps extends DeckListProps {
  // Total saved decks, shown in the collapse toggle badge. Distinct from
  // `decks.length`, which may include the in-progress (unsaved) editing deck.
  savedDeckCount: number;
  isMobileOpen: boolean;
  onToggleMobileOpen: () => void;
}

function SavedDecksPanel({ savedDeckCount, isMobileOpen, onToggleMobileOpen, ...deckListProps }: SavedDecksPanelProps) {
  const { t } = useTranslation();
  const [isAllDecksOpen, setIsAllDecksOpen] = useState(false);

  return (
    <div className="col-span-1 lg:flex lg:flex-col lg:min-h-0">
      {/* Below lg the saved-decks list collapses behind this toggle so it
          stops permanently eating vertical space on phones. */}
      <button
        type="button"
        onClick={onToggleMobileOpen}
        aria-expanded={isMobileOpen}
        aria-controls="saved-decks-panel"
        className="lg:hidden w-full min-h-11 flex items-center justify-between gap-2 px-4 py-2.5 mb-2 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-800 dark:text-gray-200 shadow-sm active:scale-[0.99] transition-all duration-200 cursor-pointer"
      >
        {/* `relative` is load-bearing: .count-badge is absolutely positioned, so without a
            positioned ancestor here it resolves against the initial containing block and
            lands 6px past the right edge of the *page* instead of on this label's corner. */}
        {/* pr-3 keeps the badge clear of the label's last letter, since an absolutely
            positioned child contributes no width of its own. */}
        <span className="relative flex items-center gap-2 pr-3">
          <FaLayerGroup className="text-primary shrink-0" />
          {t('deck.savedDecks')}
          <span className="count-badge">{savedDeckCount}</span>
        </span>
        <FaChevronDown
          className={`text-xs text-gray-400 transition-transform duration-200 ${isMobileOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id="saved-decks-panel"
        className={`${isMobileOpen ? 'block' : 'hidden'} lg:flex lg:flex-col lg:min-h-0 lg:flex-1`}
      >
        {/* Capped: unbounded, 30 decks make this column ~9,500px tall. At lg+ it fills the
            lane its parent sized, and `overscroll-contain` stops a scroll that reaches the end
            here from continuing into the page — which is what made the two lanes move together. */}
        <div className="max-h-[calc(100vh-13rem)] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto overscroll-contain pr-1">
          <DeckList {...deckListProps} />
        </div>

        {deckListProps.decks.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsAllDecksOpen(true)}
            className="mt-3 w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <FaThLarge className="text-[11px] shrink-0" />
            {t('deck.viewAllDecks')}
          </button>
        ) : null}
      </div>

      {isAllDecksOpen ? <AllDecksModal {...deckListProps} onClose={() => setIsAllDecksOpen(false)} /> : null}
    </div>
  );
}

export default SavedDecksPanel;
