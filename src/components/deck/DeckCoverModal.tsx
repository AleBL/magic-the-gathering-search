import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImage, FaTimes, FaCheck } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { Deck } from '../../types/Deck';
import { cardArtCrop, resolveDeckCoverCard } from '../../utils/deckCover';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface DeckCoverModalProps {
  deck: Deck;
  onSelect: (cardId: string) => void;
  onClose: () => void;
}

/** Picks which card's art represents a deck on its deck box (the cover). */
export default function DeckCoverModal({ deck, onSelect, onClose }: DeckCoverModalProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(onClose);

  // One art option per distinct card name that actually carries artwork.
  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: Card[] = [];
    for (const card of deck.cards) {
      if (seen.has(card.name) || !cardArtCrop(card)) continue;
      seen.add(card.name);
      list.push(card);
    }
    return list;
  }, [deck.cards]);

  const activeCoverId = deck.coverCardId ?? resolveDeckCoverCard(deck)?.id;

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
        aria-labelledby="deck-cover-title"
        className="modal-container sm:max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-fadeIn"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="deck-cover-title" className="modal-title">
            <FaImage className="text-primary" />
            {t('deck.setCover')}
          </h3>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label={t('common.close')}>
            <FaTimes />
          </button>
        </div>

        {options.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">{t('deck.addCardsMessage')}</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {options.map((card) => {
              const isActive = card.id === activeCoverId;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card.id)}
                  title={card.printed_name || card.name}
                  className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                    isActive ? 'border-blue-500 ring-2 ring-blue-500/40' : 'border-transparent hover:border-blue-400'
                  }`}
                >
                  <img
                    src={cardArtCrop(card)}
                    alt={card.printed_name || card.name}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {isActive && (
                    <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow">
                      <FaCheck className="text-[10px]" />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">
                    {card.printed_name || card.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
