import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCrown, FaBan, FaExclamationTriangle, FaPalette, FaPlus, FaMinus, FaTrash } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { DeckFormat } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';
import { getCardArtCropUrl } from '../../utils/deckGrouping';
import { parseTextWithSymbols } from '../../utils/symbolHelper';

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

  const isBanned =
    activeFormat &&
    activeFormat !== DeckFormatType.FREEFORM &&
    card.legalities?.[activeFormat as keyof typeof card.legalities] === 'banned';
  const isRestricted =
    activeFormat &&
    activeFormat !== DeckFormatType.FREEFORM &&
    card.legalities?.[activeFormat as keyof typeof card.legalities] === 'restricted';

  const artCropUrl = getCardArtCropUrl(card);

  // Only legendary cards (on any face) can be commanders.
  const isLegendary =
    /legendary/i.test(card.type_line ?? '') ||
    (card.card_faces ?? []).some((face) => /legendary/i.test(face.type_line ?? ''));

  return (
    <div className={isLeaving ? 'motion-row-leaving' : 'animate-fadeIn'}>
      <div
        role="button"
        tabIndex={0}
        aria-label={card.printed_name || card.name}
        className={`group relative overflow-hidden transition-all duration-200 h-11 border-b border-gray-300 dark:border-gray-800 cursor-pointer ${
          isBanned ? 'ring-1 ring-inset ring-red-500' : isRestricted ? 'ring-1 ring-inset ring-amber-500' : ''
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
        {/* Background Image Container */}
        <div
          className="absolute inset-0 z-0 bg-no-repeat bg-cover bg-slate-200 dark:bg-slate-800"
          style={artCropUrl ? { backgroundImage: `url(${artCropUrl})`, backgroundPosition: '50% 25%' } : {}}
        />

        {/* Gradient Overlay */}
        <div
          className={`absolute inset-0 z-10 bg-gradient-to-r from-white/95 via-white/75 to-transparent dark:from-slate-900 dark:via-slate-900/95 transition-colors duration-200 ${
            isBanned
              ? 'dark:from-red-950/90 dark:via-red-900/80 from-red-100/95 via-red-50/80'
              : isRestricted
                ? 'dark:from-amber-950/90 dark:via-amber-900/80 from-amber-100/95 via-amber-50/80'
                : 'group-hover:dark:via-slate-800/90 group-hover:via-white/60'
          }`}
        />

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
              {card.printed_name || card.name}
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
