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

  if (isLoading) {
    return (
      <div
        className="flex flex-row md:flex-col gap-1.5 max-w-full max-h-20 md:max-h-[400px] py-1 shrink-0 animate-pulse select-none"
        aria-label={t('cardDetails.loadingEditions')}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-800/40 w-[52px] h-[52px] flex items-center justify-center shrink-0"
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
      className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto max-w-full max-h-20 md:max-h-[400px] pr-1 pb-1 md:pb-0 select-none py-1 shrink-0 animate-fadeIn custom-scrollbar"
      aria-label={t('cardDetails.cardEditions')}
    >
      {prints.map((printCard) => {
        const isSelected = (currentCard.selectedPrintId || currentCard.id) === printCard.id;
        const rarity = printCard.rarity?.toLowerCase() as keyof typeof RARITY_STYLES;
        const rarityStyle = RARITY_STYLES[rarity] || RARITY_STYLES.common;

        return (
          <button
            type="button"
            key={printCard.id}
            onMouseEnter={() => onHoverImageUrl(getCardFaceImageUrl(printCard))}
            onMouseLeave={() => onHoverImageUrl(null)}
            onClick={() => onSelectPrint(printCard)}
            title={`${printCard.set_name} · ${printCard.set?.toUpperCase()} #${printCard.collector_number || ''}${printCard.lang ? ` · ${printCard.lang.toUpperCase()}` : ''}`}
            aria-pressed={isSelected}
            className={`group relative shrink-0 rounded-xl flex flex-col items-center justify-center border transition-all duration-200 px-1.5 py-2 min-w-[52px] md:w-14 cursor-pointer ${
              isSelected
                ? 'border-blue-500 bg-blue-500/15 text-primary dark:text-blue-400 ring-2 ring-blue-500/30 shadow-md brightness-110'
                : `${rarityStyle} hover:border-blue-400/60 hover:bg-blue-500/5 hover:brightness-110 hover:shadow-xs`
            }`}
          >
            <span className="text-[10px] uppercase font-black tracking-tight leading-none">{printCard.set}</span>
            <span className="text-[7px] font-semibold select-none mt-0.5 leading-none opacity-70">
              #{printCard.collector_number || ''}
            </span>
            {printCard.lang ? (
              <span className="mt-0.5 rounded bg-black/10 dark:bg-white/10 px-1 text-[7px] font-black uppercase leading-none tracking-wide">
                {printCard.lang}
              </span>
            ) : null}
            <span
              className={`mt-1 w-1 h-1 rounded-full inline-block transition-opacity ${
                rarity === 'mythic'
                  ? 'bg-orange-500'
                  : rarity === 'rare'
                    ? 'bg-amber-500'
                    : rarity === 'uncommon'
                      ? 'bg-slate-400'
                      : 'bg-gray-400'
              } ${isSelected ? 'opacity-100' : 'opacity-50 group-hover:opacity-80'}`}
            />
            {isSelected && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
