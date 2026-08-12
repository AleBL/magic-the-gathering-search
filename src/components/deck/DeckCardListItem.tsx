import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaCrown,
  FaBan,
  FaExclamationTriangle,
  FaTimesCircle,
  FaPalette,
  FaPlus,
  FaMinus,
  FaTrash
} from 'react-icons/fa';
import { Card } from '../../types/Card';
import { DeckFormat } from '../../types/Deck';
import { getCardArtCropUrl } from '../../utils/deckGrouping';
import { localizedCardName } from '../../utils/cardFaces';
import { parseTextWithSymbols } from '../../utils/symbolHelper';
import { cardFormatStatus } from '../../utils/deckValidator';

interface DeckCardListItemProps {
  card: Card;
  count: number;
  activeFormat?: DeckFormat;
  isRemovable: boolean;
  isTokenZone: boolean;
  isLeaving?: boolean;
  onToggleCommander: (card: Card) => void;
  onUpdateCard?: (card: Card) => void;
  onAddToDeck: (card: Card) => void;
  onRemoveFromDeck: (card: Card) => void;
  onSelectCard: (card: Card) => void;
  onHoverEnter: (card: Card, e: React.MouseEvent) => void;
  onHoverMove: (e: React.MouseEvent) => void;
  onHoverLeave: () => void;
}

export const DeckCardListItem = memo(function DeckCardListItem({
  card,
  count,
  activeFormat,
  isRemovable,
  isTokenZone,
  isLeaving = false,
  onToggleCommander,
  onUpdateCard,
  onAddToDeck,
  onRemoveFromDeck,
  onSelectCard,
  onHoverEnter,
  onHoverMove,
  onHoverLeave
}: DeckCardListItemProps) {
  const { t } = useTranslation();

  // One source of truth, so a rule that can invalidate the deck cannot be missing here.
  const formatStatus = cardFormatStatus(card, activeFormat);
  const isBanned = formatStatus === 'banned';
  const isRestricted = formatStatus === 'restricted';
  const isInvalid = formatStatus === 'invalid';

  const artCropUrl = getCardArtCropUrl(card);
  const displayName = localizedCardName(card);

  // Only legendary cards (on any face) can be commanders.
  const isLegendary =
    /legendary/i.test(card.type_line ?? '') ||
    (card.card_faces ?? []).some((face) => /legendary/i.test(face.type_line ?? ''));

  return (
    <div className={isLeaving ? 'motion-row-leaving' : 'animate-fadeIn'}>
      <div
        role="button"
        tabIndex={0}
        aria-label={displayName}
        className={`group relative overflow-hidden transition-all duration-200 h-11 border-b border-gray-300 dark:border-gray-800 cursor-pointer ${
          isBanned
            ? 'ring-1 ring-inset ring-red-500 bg-red-50 dark:bg-red-950/40'
            : isRestricted
              ? 'ring-1 ring-inset ring-amber-500 bg-amber-50 dark:bg-amber-950/40'
              : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'
        }`}
        draggable={isRemovable && !isTokenZone}
        onDragStart={(e) => {
          if (isRemovable && !isTokenZone) {
            e.dataTransfer.setData('text/plain', card.id);
            e.dataTransfer.effectAllowed = 'move';
            // Hide the floating card preview so it doesn't cover the zone tabs
            // you're dragging onto.
            onHoverLeave();
          }
        }}
        onClick={() => onSelectCard(card)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectCard(card);
          }
        }}
        onMouseEnter={(e) => onHoverEnter(card, e)}
        onMouseMove={onHoverMove}
        onMouseLeave={onHoverLeave}
      >
        {/*
          A strip of art on the trailing edge, faded out with a mask.

          It used to be the full-bleed art with a 75-95% scrim laid over it, which washed the
          whole row into a blur and made the text sit on a muddy background. Confining the art
          to the side it can afford, and fading it with a mask instead of covering it with a
          gradient, keeps the artwork sharp where it shows and the text on a flat surface.
        */}
        {artCropUrl ? (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 z-0 w-2/5 bg-no-repeat bg-cover opacity-70 group-hover:opacity-90 transition-opacity duration-200"
            style={{
              backgroundImage: `url(${artCropUrl})`,
              backgroundPosition: '50% 25%',
              maskImage: 'linear-gradient(to right, transparent, black 55%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 55%)'
            }}
          />
        ) : null}

        {/* Content */}
        <div className="relative z-20 flex items-center justify-between h-full px-2">
          <div className="flex items-center min-w-0 pr-2">
            <span
              className={`font-black w-6 text-center text-sm mr-1 shrink-0 ${isBanned ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}
            >
              {count}
            </span>
            <span
              className={`font-semibold truncate text-sm hover:text-primary dark:hover:text-blue-400 transition-colors drop-shadow-sm ${isBanned ? 'text-red-800 dark:text-red-300 font-extrabold' : 'text-gray-900 dark:text-white'}`}
            >
              {displayName}
            </span>

            {card.isCommander && (
              <span className="deck-card-status-chip-commander animate-pulse ml-2">
                <FaCrown className="text-amber-500 dark:text-amber-400 shrink-0 text-[10px]" />
                {t('cardDetails.commanderBadge')}
              </span>
            )}
            {isBanned && (
              <span className="deck-card-status-chip-banned ml-2">
                <FaBan className="text-red-500 dark:text-red-400 text-[9px] shrink-0" />
                {t('cardDetails.banned').toUpperCase()}
              </span>
            )}
            {isRestricted && (
              <span className="deck-card-status-chip-restricted ml-2">
                <FaExclamationTriangle className="text-amber-500 dark:text-amber-400 text-[9px] shrink-0" />
                {t('cardDetails.restricted').toUpperCase()}
              </span>
            )}
            {isInvalid && (
              <span className="deck-card-status-chip-invalid ml-2" title={t('cardDetails.invalidInFormatHint')}>
                <FaTimesCircle className="text-violet-500 dark:text-violet-400 text-[9px] shrink-0" />
                {t('cardDetails.invalidInFormat').toUpperCase()}
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-3 shrink-0 drop-shadow-md"
            onMouseEnter={onHoverLeave}
            onMouseLeave={(e) => onHoverEnter(card, e)}
          >
            {card.mana_cost && (
              <span className="flex items-center gap-0.5 mr-2 drop-shadow-md">
                {parseTextWithSymbols(card.mana_cost)}
              </span>
            )}

            {/* Quick Edit Buttons on Hover */}
            {isRemovable && (
              // Only guards against triggering the row's onSelectCard; the buttons/select inside are the real interactive surface.
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
              <div
                className="flex items-center gap-1 transition-opacity duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {activeFormat === 'commander' && !isTokenZone && isLegendary && (
                  <button
                    type="button"
                    onClick={() => onToggleCommander(card)}
                    className="deck-quick-action-commander"
                    title={card.isCommander ? t('cardDetails.removeAsCommander') : t('cardDetails.setAsCommander')}
                  >
                    <FaCrown className="text-[10px]" />
                  </button>
                )}

                {onUpdateCard && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateCard(card);
                    }}
                    className="deck-quick-action-art"
                    title={t('cardDetails.changeArt')}
                  >
                    <FaPalette className="text-[9px]" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onAddToDeck(card)}
                  className="deck-quick-action-add"
                  title={t('cardDetails.addCopy')}
                >
                  <FaPlus className="text-[8px]" />
                </button>

                {!isTokenZone && (
                  <button
                    type="button"
                    onClick={() => onRemoveFromDeck(card)}
                    className="deck-quick-action-remove"
                    title={t('cardDetails.removeCopy')}
                  >
                    <FaMinus className="text-[8px]" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isTokenZone) {
                      onRemoveFromDeck(card);
                    } else {
                      for (let copyIndex = 0; copyIndex < count; copyIndex++) {
                        onRemoveFromDeck(card);
                      }
                    }
                  }}
                  className="deck-quick-action-delete"
                  title={isTokenZone ? t('tokens.deleteToken') : t('cardDetails.deleteCard')}
                >
                  <FaTrash className="text-[8px]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
