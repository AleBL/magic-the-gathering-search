import { useTranslation } from 'react-i18next';
import { FaLayerGroup, FaTimes } from 'react-icons/fa';
import DeckList, { DeckListProps } from './DeckList';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface AllDecksModalProps extends DeckListProps {
  onClose: () => void;
}

/**
 * Every saved deck in a grid, with the sidebar's actions. The sidebar lane fits one deck
 * per row, which turns 30 decks into ~13 screens of scrolling; this is the wide view.
 */
function AllDecksModal({ onClose, ...deckListProps }: AllDecksModalProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(onClose);

  return (
    // Backdrop click is a mouse-only convenience; Escape and the close button cover keyboard users.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-overlay z-[var(--z-overlay)]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-decks-title"
        className="modal-container w-full max-w-6xl max-h-[85vh] flex flex-col animate-fadeIn"
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 id="all-decks-title" className="modal-title">
            <FaLayerGroup className="text-primary" />
            {t('deck.savedDecks')} ({deckListProps.decks.length})
          </h3>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label={t('common.close')}>
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <DeckList {...deckListProps} layout="grid" hideHeading />
        </div>
      </div>
    </div>
  );
}

export default AllDecksModal;
