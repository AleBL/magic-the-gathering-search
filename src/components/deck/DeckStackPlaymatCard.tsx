import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaMinus, FaBan, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { DeckZone } from '../../types/enums';
import { DeckFormat } from '../../types/Deck';
import { getCardImageUrl } from '../../utils/deckGrouping';
import { cardFormatStatus } from '../../utils/deckValidator';

interface DeckStackPlaymatCardProps {
  readonly item: { name: string; count: number; card: Card };
  readonly cardDimensions: { width: string; height: string };
  readonly isRemovable: boolean;
  readonly activeFormat?: DeckFormat;
  readonly onSelectCard: (card: Card) => void;
  readonly onHoverEnter: (card: Card, e: React.MouseEvent) => void;
  readonly onHoverMove: (e: React.MouseEvent) => void;
  readonly onHoverLeave: () => void;
  readonly onAddToDeck: (card: Card) => void;
  readonly onRemoveFromDeck: (card: Card) => void;
  readonly onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
}

/** One card tile in the playmat stack: art, count badge, legality badge, and hover-only zone controls. */
export function DeckStackPlaymatCard({
  item,
  cardDimensions,
  isRemovable,
  activeFormat,
  onSelectCard,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onAddToDeck,
  onRemoveFromDeck,
  onUpdateCardZone
}: DeckStackPlaymatCardProps) {
  const { t } = useTranslation();
  const { count, card } = item;
  const imageUrl = getCardImageUrl(card);
  const status = cardFormatStatus(card, activeFormat);
  const isBanned = status === 'banned';
  const isRestricted = status === 'restricted';
  const isInvalid = status === 'invalid';
  const dynamicCardStyle = {
    '--stack-card-width': cardDimensions.width,
    '--stack-card-height': cardDimensions.height
  } as CSSProperties;

  return (
    <div
      key={card.id}
      className="deck-stack-card-wrapper group"
      data-stack-depth={count > 2 ? '3' : count > 1 ? '2' : '1'}
      style={dynamicCardStyle}
    >
      {count > 1 ? (
        <div
          className={`deck-stack-shadow deck-stack-shadow-level-one ${
            isBanned
              ? 'bg-red-950/60 border border-red-900/60'
              : isRestricted
                ? 'bg-amber-100/60 dark:bg-amber-950/60 border border-amber-300/60 dark:border-amber-900/60'
                : 'bg-gray-300 dark:bg-slate-950 border border-gray-400/80 dark:border-slate-800/80'
          }`}
        />
      ) : null}

      {count > 2 ? (
        <div
          className={`deck-stack-shadow deck-stack-shadow-level-two ${
            isBanned
              ? 'bg-red-950/40 border border-red-900/40'
              : isRestricted
                ? 'bg-amber-100/40 dark:bg-amber-950/40 border border-amber-300/40 dark:border-amber-900/40'
                : 'bg-gray-200 dark:bg-slate-950 border border-gray-300/80 dark:border-slate-800/80'
          }`}
        />
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label={card.printed_name || card.name}
        className={`deck-stack-main-card ${
          isBanned
            ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
            : isRestricted
              ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
              : 'border-gray-300 dark:border-slate-800/50 hover:border-blue-500/80'
        }`}
        data-has-stack={count > 1 ? 'true' : 'false'}
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
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.name}
            className={`w-full h-full object-cover pointer-events-none select-none transition-all duration-300 ${
              isBanned ? 'opacity-50 grayscale-[40%] brightness-[75%]' : ''
            }`}
          />
        ) : (
          <div
            className={`p-2.5 text-left h-full flex flex-col justify-between ${isBanned ? 'bg-red-100 dark:bg-red-950/20' : 'bg-gray-100 dark:bg-slate-850'}`}
          >
            <span
              className={`text-[10px] font-extrabold block leading-tight truncate-2-lines ${isBanned ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
            >
              {card.printed_name || card.name}
            </span>
            <span className="text-[9px] text-yellow-500 font-mono font-bold">{card.mana_cost}</span>
          </div>
        )}

        {count > 1 ? <span className="deck-stack-count-badge">{count}x</span> : null}

        {isBanned ? (
          <div className="deck-stack-status-badge deck-stack-status-badge-banned animate-pulse">
            <FaBan className="text-white text-[8px] shrink-0" />
            <span>{t('cardDetails.banned').toUpperCase()}</span>
          </div>
        ) : null}

        {isRestricted ? (
          <div className="deck-stack-status-badge deck-stack-status-badge-restricted">
            <FaExclamationTriangle className="text-white text-[8px] shrink-0" />
            <span>{t('cardDetails.restricted').toUpperCase()}</span>
          </div>
        ) : null}

        {isInvalid ? (
          <div
            className="deck-stack-status-badge bg-violet-600/90 border border-violet-500"
            title={t('cardDetails.invalidInFormatHint')}
          >
            <FaTimesCircle className="text-white text-[8px] shrink-0" />
            <span>{t('cardDetails.invalidInFormat').toUpperCase()}</span>
          </div>
        ) : null}

        {isRemovable ? (
          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 items-end">
            <div className="flex gap-1.5 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToDeck(card);
                }}
                className="w-6 h-6 rounded-full bg-success/90 text-white flex items-center justify-center text-xs font-extrabold hover:bg-green-500 hover:scale-110 transition-all pointer-events-auto"
                title={t('cardDetails.addCopy')}
              >
                <FaPlus className="text-[10px]" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromDeck(card);
                }}
                className="w-6 h-6 rounded-full bg-danger/90 text-white flex items-center justify-center text-xs font-extrabold hover:bg-red-500 hover:scale-110 transition-all pointer-events-auto"
                title={t('cardDetails.removeCopy')}
              >
                <FaMinus className="text-[10px]" />
              </button>
            </div>

            {onUpdateCardZone && card.zone ? (
              <div className="flex gap-1 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg pointer-events-auto mt-1 flex-col items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCardZone(card.id, DeckZone.MAIN);
                  }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                    card.zone === DeckZone.MAIN
                      ? 'bg-primary text-white ring-1 ring-white/50'
                      : 'bg-slate-700/80 text-gray-300 hover:bg-blue-500 hover:text-white'
                  }`}
                  title={t('deck.printFilters.main')}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCardZone(card.id, DeckZone.SIDEBOARD);
                  }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                    card.zone === DeckZone.SIDEBOARD
                      ? 'bg-purple-600 text-white ring-1 ring-white/50'
                      : 'bg-slate-700/80 text-gray-300 hover:bg-purple-500 hover:text-white'
                  }`}
                  title={t('deck.printFilters.sideboard')}
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCardZone(card.id, DeckZone.MAYBEBOARD);
                  }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                    card.zone === DeckZone.MAYBEBOARD
                      ? 'bg-warning text-white ring-1 ring-white/50'
                      : 'bg-slate-700/80 text-gray-300 hover:bg-amber-500 hover:text-white'
                  }`}
                  title={t('deck.printFilters.maybeboard')}
                >
                  ?
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
