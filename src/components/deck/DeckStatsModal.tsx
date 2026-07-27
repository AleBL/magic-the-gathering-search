import { lazy, Suspense, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChartBar, FaTimes } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const DeckStats = lazy(() => import('../stats/DeckStats'));

interface DeckStatsModalProps {
  cards: Card[];
  onApplySuggestedLands?: (landCounts: Record<string, number>) => void;
  renderFilteredCards: (filteredCards: Card[]) => ReactNode;
  onClose: () => void;
}

/** Deck statistics in a wide modal — used while editing, where the deck pane is
 *  too narrow to show the charts comfortably inline. */
export default function DeckStatsModal({
  cards,
  onApplySuggestedLands,
  renderFilteredCards,
  onClose
}: DeckStatsModalProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(onClose);

  return (
    // Backdrop click is a mouse-only convenience; Escape and the close button cover keyboard users.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-overlay z-[var(--z-overlay)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-stats-modal-title"
        className="modal-container sm:max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn"
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id="deck-stats-modal-title"
            className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"
          >
            <FaChartBar className="text-primary" />
            {t('stats.deckStats')}
          </h3>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label={t('common.close')}>
            <FaTimes />
          </button>
        </div>

        <Suspense
          fallback={<div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('common.loading')}...</div>}
        >
          <DeckStats
            currentDeck={cards}
            onApplySuggestedLands={onApplySuggestedLands}
            renderFilteredCards={renderFilteredCards}
          />
        </Suspense>
      </div>
    </div>
  );
}
