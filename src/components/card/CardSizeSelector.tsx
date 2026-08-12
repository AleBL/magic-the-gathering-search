import { useTranslation } from 'react-i18next';
import { CardSize } from '../../types';
import { CARD_SIZES } from '../../constants';

interface CardSizeSelectorProps {
  selectedSize: CardSize;
  onSizeChange: (size: CardSize) => void;
}

function CardSizeSelector({ selectedSize, onSizeChange }: CardSizeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-row items-center gap-2 sm:gap-4 w-auto"
      role="radiogroup"
    >
      <span
        className="hidden sm:inline text-gray-700 dark:text-gray-300 text-sm transition-colors duration-300 font-bold whitespace-nowrap"
        aria-hidden="true"
      >
        {t('search.cardSize')}
      </span>
      <div className="flex bg-gray-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1 rounded-xl shadow-inner border border-gray-200/50 dark:border-slate-700 w-auto">
        {CARD_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={selectedSize === size}
            aria-label={t(`search.${size}`)}
            title={t(`search.${size}`)}
            onClick={() => onSizeChange(size)}
            className={`flex-1 sm:flex-none min-h-[44px] sm:min-h-0 text-center px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ease-in-out ${selectedSize === size
                ? 'bg-white dark:bg-slate-600 text-primary dark:text-blue-200 shadow-sm ring-1 ring-black/5 dark:ring-white/10 scale-105'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
          >
            {t(`search.${size}Initial`)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CardSizeSelector;
