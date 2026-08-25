import { useTranslation } from 'react-i18next';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { DeckZone } from '../../types/enums';

interface CardItemHoverControlsProps {
  readonly card: Card;
  readonly showRemoveButton: boolean;
  readonly onAddToDeck?: (card: Card) => void;
  readonly onRemoveFromDeck?: (card: Card) => void;
  readonly onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
}

/** The hover-only bottom bar: remove, zone move, and add-copy buttons. */
export function CardItemHoverControls({
  card,
  showRemoveButton,
  onAddToDeck,
  onRemoveFromDeck,
  onUpdateCardZone
}: CardItemHoverControlsProps) {
  const { t } = useTranslation();

  if (!onAddToDeck && !onRemoveFromDeck && !onUpdateCardZone) return null;

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-row gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none items-center justify-center bg-black/40 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-white/10">
      {showRemoveButton && onRemoveFromDeck && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromDeck(card);
          }}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-full bg-danger/90 text-white flex items-center justify-center text-xs sm:text-[10px] font-extrabold shadow-md hover:bg-red-500 hover:scale-110 transition-all pointer-events-auto"
          title={t('cardDetails.remove')}
        >
          <FaMinus />
        </button>
      )}
      {onUpdateCardZone && card.zone && (
        <div className="flex gap-1 pointer-events-auto border-l border-r border-white/20 px-1.5 mx-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateCardZone(card.id, DeckZone.MAIN);
            }}
            className={`zone-menu-item w-10 h-10 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-[10px] font-bold transition-all ${
              card.zone === DeckZone.MAIN
                ? 'bg-primary text-white ring-2 ring-white/50'
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
            className={`zone-menu-item w-10 h-10 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-[10px] font-bold transition-all ${
              card.zone === DeckZone.SIDEBOARD
                ? 'bg-purple-600 text-white ring-2 ring-white/50'
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
            className={`zone-menu-item w-10 h-10 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-[10px] font-bold transition-all ${
              card.zone === DeckZone.MAYBEBOARD
                ? 'bg-warning text-white ring-2 ring-white/50'
                : 'bg-slate-700/80 text-gray-300 hover:bg-amber-500 hover:text-white'
            }`}
            title={t('deck.printFilters.maybeboard')}
          >
            ?
          </button>
        </div>
      )}
      {onAddToDeck && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToDeck(card);
          }}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-full bg-primary/90 text-white flex items-center justify-center text-xs sm:text-[10px] font-extrabold shadow-md hover:bg-blue-500 hover:scale-110 transition-all pointer-events-auto"
          title={t('cardDetails.addCopy')}
        >
          <FaPlus />
        </button>
      )}
    </div>
  );
}
