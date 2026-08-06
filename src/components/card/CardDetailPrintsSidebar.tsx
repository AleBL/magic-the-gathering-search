import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../types/Card';

const RARITY_STYLES: Record<string, string> = {
  mythic:
    'border-orange-500/60 bg-gradient-to-b from-orange-500/20 to-orange-600/5 text-orange-500 dark:text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.15)]',
  rare: 'border-amber-400/60 bg-gradient-to-b from-amber-400/15 to-amber-500/5 text-warning dark:text-amber-400',
  uncommon: 'border-slate-400/50 bg-gradient-to-b from-slate-400/10 to-slate-500/5 text-slate-600 dark:text-slate-300',
  common: 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400'
};

interface CardDetailPrintsSidebarProps {
  isLoading: boolean;
  prints: Card[];
  currentCard: Card;
  onHoverImageUrl: (url: string | null) => void;
  onSelectPrint: (print: Card) => void;
  getCardFaceImageUrl: (print: Card) => string;
}

export function CardDetailPrintsSidebar({
  isLoading,
  prints,
  currentCard,
  onHoverImageUrl,
  onSelectPrint,
  getCardFaceImageUrl
}: CardDetailPrintsSidebarProps) {
  const { t } = useTranslation();

  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const selectedPrintId = currentCard.selectedPrintId || currentCard.id;

  /**
   * Keeps the chosen edition centred in the strip. Picking one re-renders this list, which
   * drops the scroll position back to the start — so with many printings the edition you
   * just chose scrolls out of sight.
   *
   * Scrolls the container directly instead of `scrollIntoView`, which would also scroll
   * the modal body and jump the card image around.
   */
  useEffect(() => {
    const list = listRef.current;
    const selected = selectedRef.current;
    if (!list || !selected) return;

    // Measured from bounding rects, not offsetTop: the list is not a positioned ancestor,
    // so offsetTop is relative to some element further up and the arithmetic silently
    // centres on the wrong origin.
    const listBox = list.getBoundingClientRect();
    const selectedBox = selected.getBoundingClientRect();

    // The strip is a column on desktop and a row on phones; centre on whichever axis
    // actually overflows.
    if (list.scrollHeight > list.clientHeight) {
      list.scrollTop += selectedBox.top - listBox.top - (list.clientHeight - selectedBox.height) / 2;
    } else if (list.scrollWidth > list.clientWidth) {
      list.scrollLeft += selectedBox.left - listBox.left - (list.clientWidth - selectedBox.width) / 2;
    }
  }, [selectedPrintId, prints]);

  if (isLoading) {
    return (
      <div
        className="flex flex-row md:flex-col gap-1.5 max-w-full max-h-24 md:max-h-[400px] py-1 shrink-0 animate-pulse select-none"
        aria-label={t('cardDetails.loadingEditions')}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-800/40 w-[62px] h-[62px] flex items-center justify-center shrink-0"
          >
            <span className="w-6 h-2 bg-gray-300 dark:bg-gray-650 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (prints.length <= 1) return null;

  return (
    <div
      ref={listRef}
      className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto max-w-full max-h-24 md:max-h-[400px] pr-1 pb-1 md:pb-0 select-none py-1 shrink-0 animate-fadeIn custom-scrollbar"
      aria-label={t('cardDetails.cardEditions')}
    >
      {prints.map((printCard) => {
        const isSelected = selectedPrintId === printCard.id;
        const rarity = printCard.rarity?.toLowerCase() as keyof typeof RARITY_STYLES;
        const rarityStyle = RARITY_STYLES[rarity] || RARITY_STYLES.common;

        return (
          <button
            type="button"
            key={printCard.id}
            ref={isSelected ? selectedRef : undefined}
            onMouseEnter={() => onHoverImageUrl(getCardFaceImageUrl(printCard))}
            onMouseLeave={() => onHoverImageUrl(null)}
            onClick={() => onSelectPrint(printCard)}
            title={`${printCard.set_name} · ${printCard.set?.toUpperCase()} #${printCard.collector_number || ''}${printCard.lang ? ` · ${printCard.lang.toUpperCase()}` : ''}`}
            aria-pressed={isSelected}
            className={`group relative shrink-0 rounded-xl flex flex-col items-center justify-center border transition-all duration-200 px-2 py-2.5 min-w-[62px] md:w-16 cursor-pointer ${
              isSelected
                ? 'border-blue-500 bg-blue-500/15 text-primary dark:text-blue-400 ring-2 ring-blue-500/30 shadow-md brightness-110'
                : `${rarityStyle} hover:border-blue-400/60 hover:bg-blue-500/5 hover:brightness-110 hover:shadow-xs`
            }`}
          >
            <span className="text-[11px] uppercase font-black tracking-tight leading-none">{printCard.set}</span>
            <span className="text-[9px] font-semibold select-none mt-0.5 leading-none opacity-80">
              #{printCard.collector_number || ''}
            </span>
            {printCard.lang ? (
              <span className="mt-0.5 rounded bg-black/10 dark:bg-white/10 px-1 text-[8px] font-black uppercase leading-none tracking-wide">
                {printCard.lang}
              </span>
            ) : null}

            {isSelected && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
