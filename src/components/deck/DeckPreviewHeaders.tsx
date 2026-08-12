import { useTranslation } from 'react-i18next';
import { FaBolt, FaExclamationTriangle, FaFileAlt, FaPencilAlt } from 'react-icons/fa';
import { Deck } from '../../types/Deck';
import { formatLabelKey } from '../../utils/formatLabel';

/**
 * The two deck-preview headers. They stay separate on purpose: beyond sitting in the same slot
 * they have nothing in common — one names a stored deck, the other describes the state of a
 * deck that has no name yet.
 */

interface SavedDeckHeaderProps {
  deck: Deck;
  onEditInfo?: (deck: Deck) => void;
}

/** A stored deck: its name, an edit affordance, and the format/size it was saved with. */
export function SavedDeckHeader({ deck, onEditInfo }: SavedDeckHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-gray-900 dark:text-white text-xl font-bold transition-colors duration-300 flex items-center gap-2 min-w-0">
          <FaFileAlt className="text-primary shrink-0" />
          <span className="truncate">{deck.name}</span>
        </h3>
        {onEditInfo ? (
          <button
            type="button"
            onClick={() => onEditInfo(deck)}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
            title={t('deck.editDeckInfo')}
            aria-label={t('deck.editDeckInfo')}
          >
            <FaPencilAlt className="text-xs" />
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-muted">
          {t('validation.format')}:{' '}
          <span className="font-semibold text-gray-800 dark:text-gray-200">{t(formatLabelKey(deck.format))}</span>
        </span>
        <span className="text-muted">•</span>
        <span className="text-muted">
          {deck.cards.length} {t('common.cards')}
        </span>
      </div>
    </>
  );
}

interface WorkingDeckHeaderProps {
  /** Set while a saved deck is open for editing; drives the "editing" wording. */
  isEditing: boolean;
  cardCount: number;
}

/** The deck being built: either editing a saved deck, or an unnamed temporary one. */
export function WorkingDeckHeader({ isEditing, cardCount }: WorkingDeckHeaderProps) {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="editing-mode-badge">
            <FaBolt className="text-[9px] shrink-0" />
            {t('deck.activeEditingMode')}
          </span>
        </div>
        {cardCount > 0 ? (
          <h3 className="text-gray-900 dark:text-white text-xl font-bold transition-colors duration-300 text-left truncate">
            {cardCount} {t('common.cards')}
          </h3>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-left leading-snug">{t('deck.addCardsMessage')}</p>
        )}
      </>
    );
  }

  return (
    <>
      <h3 className="text-gray-900 dark:text-white text-xl font-serif font-semibold transition-colors duration-300 text-left">
        {t('deck.currentDeck')}
      </h3>
      {cardCount > 0 ? (
        <span className="unsaved-deck-chip">
          <FaExclamationTriangle className="text-rose-500 dark:text-rose-400 text-[9px] shrink-0" />
          <span>{t('deck.temporaryUnsavedDeck')}</span>
        </span>
      ) : null}
    </>
  );
}
