import { useTranslation } from 'react-i18next';
import { OwnershipFilter } from '../../hooks/useCollectionOwnership';

interface CollectionFilterSelectorProps {
  value: OwnershipFilter;
  onChange: (value: OwnershipFilter) => void;
}

const OPTIONS: { value: OwnershipFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'search.ownershipAll' },
  { value: 'owned', labelKey: 'search.ownershipOwned' },
  { value: 'missing', labelKey: 'search.ownershipMissing' }
];

/**
 * Narrows search results to cards the player already owns, or to the ones they still
 * need. A radiogroup rather than three buttons: the options are mutually exclusive, and
 * that is what a screen reader should hear.
 */
function CollectionFilterSelector({ value, onChange }: CollectionFilterSelectorProps) {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t('search.ownership')}
      className="flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-slate-800/70 p-1"
    >
      {OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-600 text-primary dark:text-blue-200 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

export default CollectionFilterSelector;
