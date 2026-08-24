import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaMagic, FaTimes, FaPlus } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { fetchDeckSuggestions } from '../../services/suggestionService';
import { getCardImageUrl } from '../../utils/deckGrouping';
import { localizedCardName } from '../../utils/cardFaces';
import { NESTED_CARD_DETAIL_Z_INDEX } from '../../constants';
import CardDetailModal from '../card/CardDetailModal';

interface DeckSuggestionsModalProps {
  cards: Card[];
  format?: string;
  onAddToDeck: (card: Card) => void;
  onClose: () => void;
}

/** Suggests cards from Scryfall that fit the current deck's colors, with quick-add. */
export default function DeckSuggestionsModal({ cards, format, onAddToDeck, onClose }: DeckSuggestionsModalProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  const [detailCard, setDetailCard] = useState<Card | null>(null);

  // Escape belongs to the card detail while it is open, so the suggestion list does not
  // close out from under it.
  useEscapeKey(onClose, !detailCard);

  const [suggestions, setSuggestions] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchDeckSuggestions(cards, format).then((result) => {
      if (active) {
        setSuggestions(result);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [cards, format]);

  const handleAdd = (card: Card) => {
    onAddToDeck(card);
    setAdded((prev) => new Set(prev).add(card.id));
  };

  return (
    // Backdrop click is a mouse-only convenience; Escape and the close button cover keyboard users.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-overlay z-[var(--z-overlay)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* The height cap and the scroll container below are what keep a long suggestion
          list inside the viewport: the grid used to grow past the bottom of the screen
          with no way to reach the cards under the fold. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-suggestions-title"
        className="modal-container sm:max-w-5xl w-full max-h-[85vh] flex flex-col animate-fadeIn"
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 id="deck-suggestions-title" className="modal-title">
            <FaMagic className="text-primary" />
            {t('deck.suggestionsTitle')}
          </h3>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label={t('common.close')}>
            <FaTimes />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{t('deck.suggestionsLoading')}</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{t('deck.suggestionsEmpty')}</p>
        ) : (
          // `min-h-0` is what lets this pane shrink inside the flex column; without it the
          // grid dictates the height and the cap above never applies.
          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
            {/* Sized by the card rather than by a column count: a suggestion is only useful
                if its rules text is readable, which the four-across grid was not. */}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
              {suggestions.map((card) => (
                <li
                  key={card.id}
                  className="rounded-lg overflow-hidden bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => setDetailCard(card)}
                    title={t('cardDetails.viewCardDetails')}
                    aria-label={localizedCardName(card)}
                    className="block w-full cursor-pointer transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {getCardImageUrl(card) ? (
                      <img
                        src={getCardImageUrl(card)}
                        alt={localizedCardName(card)}
                        loading="lazy"
                        className="w-full aspect-[63/88] object-cover"
                      />
                    ) : (
                      <span className="w-full aspect-[63/88] flex items-center justify-center p-2 text-xs text-center text-gray-500">
                        {localizedCardName(card)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdd(card)}
                    disabled={added.has(card.id)}
                    className="w-full min-h-11 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-default transition-all cursor-pointer"
                  >
                    <FaPlus className="text-[10px] shrink-0" />
                    {added.has(card.id) ? t('deck.suggestionAdded') : t('deck.addSuggestion')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {detailCard ? (
        <CardDetailModal
          card={detailCard}
          imageUrl={getCardImageUrl(detailCard)}
          onAddToDeck={handleAdd}
          onClose={() => setDetailCard(null)}
          zIndex={NESTED_CARD_DETAIL_Z_INDEX}
        />
      ) : null}
    </div>
  );
}
