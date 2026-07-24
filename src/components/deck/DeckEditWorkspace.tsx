import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaLayerGroup } from 'react-icons/fa';

interface DeckEditWorkspaceProps {
  search: ReactNode;
  deck: ReactNode;
}

/**
 * Arena-style two-pane deck editor: card search on the left, the deck itself on
 * the right. Below `lg` the panes collapse behind a Search/Deck toggle so each
 * gets the full width on phones. Both panes scroll independently.
 */
export default function DeckEditWorkspace({ search, deck }: DeckEditWorkspaceProps) {
  const { t } = useTranslation();
  const [mobileView, setMobileView] = useState<'search' | 'deck'>('search');

  return (
    <div className="deck-edit-workspace">
      <div className="deck-edit-mobile-tabs lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView('search')}
          aria-pressed={mobileView === 'search'}
          className={`deck-edit-mobile-tab ${mobileView === 'search' ? 'deck-edit-mobile-tab-active' : ''}`}
        >
          <FaSearch className="text-xs" /> {t('search.searchButton')}
        </button>
        <button
          type="button"
          onClick={() => setMobileView('deck')}
          aria-pressed={mobileView === 'deck'}
          className={`deck-edit-mobile-tab ${mobileView === 'deck' ? 'deck-edit-mobile-tab-active' : ''}`}
        >
          <FaLayerGroup className="text-xs" /> {t('deck.currentDeck')}
        </button>
      </div>

      <div className="deck-edit-panes">
        <div className={`deck-edit-pane-search ${mobileView === 'search' ? '' : 'hidden lg:block'}`}>{search}</div>
        <div className={`deck-edit-pane-deck ${mobileView === 'deck' ? '' : 'hidden lg:block'}`}>{deck}</div>
      </div>
    </div>
  );
}
