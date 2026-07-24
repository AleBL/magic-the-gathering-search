import { DragEvent, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaLayerGroup } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { ADD_CARD_DRAG_TYPE } from '../card/CardItem';

interface DeckEditWorkspaceProps {
  search: ReactNode;
  deck: ReactNode;
  /** Adds a card dropped from the search pane onto the deck side. */
  onDropCard?: (card: Card) => void;
}

/**
 * Arena-style two-pane deck editor: card search on the left, the deck itself on
 * the right. Below `lg` the panes collapse behind a Search/Deck toggle so each
 * gets the full width on phones. Both panes scroll independently.
 */
export default function DeckEditWorkspace({ search, deck, onDropCard }: DeckEditWorkspaceProps) {
  const { t } = useTranslation();
  const [mobileView, setMobileView] = useState<'search' | 'deck'>('search');
  const [isDropTarget, setIsDropTarget] = useState(false);

  const acceptsDrag = (e: DragEvent) => Boolean(onDropCard) && e.dataTransfer.types.includes(ADD_CARD_DRAG_TYPE);

  const handleDragOver = (e: DragEvent) => {
    if (!acceptsDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDropTarget(true);
  };

  const handleDrop = (e: DragEvent) => {
    if (!acceptsDrag(e)) return;
    e.preventDefault();
    setIsDropTarget(false);
    const raw = e.dataTransfer.getData(ADD_CARD_DRAG_TYPE);
    if (!raw) return;
    try {
      onDropCard?.(JSON.parse(raw) as Card);
    } catch {
      // Ignore malformed drag payloads — nothing to add.
    }
  };

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
        <div
          className={`deck-edit-pane-deck ${isDropTarget ? 'deck-edit-pane-deck-drop' : ''} ${mobileView === 'deck' ? '' : 'hidden lg:block'}`}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDropTarget(false)}
          onDrop={handleDrop}
        >
          {deck}
        </div>
      </div>
    </div>
  );
}
