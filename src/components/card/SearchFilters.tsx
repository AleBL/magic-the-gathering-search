import { useState, Dispatch, SetStateAction, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaFilter, FaTimes, FaUndo } from 'react-icons/fa';
import { SearchFilters as SearchFiltersType } from '../../types';
import { KEYWORD_OPTIONS, ORACLE_TAG_OPTIONS, toLabelKey } from '../../constants/searchOptions';
import { hasActiveFilters as hasAnyFilter } from '../../utils/searchQuery';
import { useSearchFilters } from '../../hooks/useSearchFilters';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePendingAction } from '../../hooks/usePendingAction';
import BottomSheet from '../ui/BottomSheet';

interface SearchFiltersProps {
  filters: SearchFiltersType;
  setFilters: Dispatch<SetStateAction<SearchFiltersType>>;
  /**
   * Extra controls rendered inside the mobile bottom sheet only. Below `sm`
   * the search screen hides its whole filter row (the navbar page menu opens
   * this sheet instead), so the controls that live in that row — color/type
   * quick filters, card size — are re-homed here to stay reachable.
   */
  mobileExtras?: ReactNode;
  /** Extra controls for the advanced panel, shared by the desktop dropdown and the sheet. */
  extraFilters?: ReactNode;
}

// Pairs with Tailwind's `sm` breakpoint used by the dropdown markup below.
const MOBILE_QUERY = '(max-width: 639px)';

const FIELD_CLASS =
  'w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:font-normal placeholder:text-gray-400 shadow-inner dark:shadow-none hover:bg-gray-100 dark:hover:bg-slate-800';

function SearchFilters({ filters, setFilters, mobileExtras, extraFilters }: SearchFiltersProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTextFields, setShowTextFields] = useState(true);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { rarities, clearFilters, setRarity, setCmc, setField } = useSearchFilters(filters, setFilters);
  useEscapeKey(() => setIsExpanded(false), isExpanded && !isMobile);

  // The navbar's mobile page menu asks us to open via the shared pendingAction
  // channel (same mechanism keyboard shortcuts use).
  usePendingAction({
    'open-search-filters': () => setIsExpanded(true)
  });

  // Derived from the query builder, so a field added there cannot be forgotten here.
  const hasActiveFilters = hasAnyFilter(filters);

  const fieldLabel = (htmlFor: string, label: string) => (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
    >
      {label}
    </label>
  );

  // Two columns only in the desktop dropdown, which is wide enough for them; the mobile
  // sheet stays a single column.
  const renderTextFields = (wide: boolean) => (
    <div className={wide ? 'grid grid-cols-2 gap-x-5 gap-y-4 items-start' : 'space-y-4'}>
      <div>
        {fieldLabel('filter-text', t('search.containsText'))}
        <input
          id="filter-text"
          type="text"
          value={filters.text}
          onChange={(e) => setField('text', e.target.value)}
          placeholder={t('search.containsTextPlaceholder')}
          className={FIELD_CLASS}
        />
        <p className="mt-1 text-[10px] leading-snug text-gray-400 dark:text-slate-500">
          {t('search.textLanguageHint')}
        </p>
      </div>

      <div>
        {fieldLabel('filter-exclude-text', t('search.excludesText'))}
        <input
          id="filter-exclude-text"
          type="text"
          value={filters.excludeText}
          onChange={(e) => setField('excludeText', e.target.value)}
          placeholder={t('search.excludesTextPlaceholder')}
          className={FIELD_CLASS}
        />
      </div>

      <div>
        {fieldLabel('filter-keyword', t('search.keyword'))}
        <select
          id="filter-keyword"
          value={filters.keyword}
          onChange={(e) => setField('keyword', e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">{t('search.any')}</option>
          {KEYWORD_OPTIONS.map((keyword) => (
            <option key={keyword} value={keyword}>
              {t(`search.keywords.${toLabelKey(keyword)}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        {fieldLabel('filter-oracle-tag', t('search.oracleTag'))}
        <select
          id="filter-oracle-tag"
          value={filters.oracleTag}
          onChange={(e) => setField('oracleTag', e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">{t('search.any')}</option>
          {ORACLE_TAG_OPTIONS.map((tag) => (
            <option key={tag} value={tag}>
              {t(`search.oracleTags.${toLabelKey(tag)}`)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] leading-snug text-gray-400 dark:text-slate-500">{t('search.oracleTagHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          {fieldLabel('filter-power', t('search.power'))}
          <input
            id="filter-power"
            type="text"
            inputMode="text"
            value={filters.power}
            onChange={(e) => setField('power', e.target.value)}
            placeholder={t('search.statPlaceholder')}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          {fieldLabel('filter-toughness', t('search.toughness'))}
          <input
            id="filter-toughness"
            type="text"
            inputMode="text"
            value={filters.toughness}
            onChange={(e) => setField('toughness', e.target.value)}
            placeholder={t('search.statPlaceholder')}
            className={FIELD_CLASS}
          />
        </div>
      </div>
    </div>
  );

  const renderFilterFields = (wide: boolean) => (
    <>
      {extraFilters ? <div className="pb-4 border-b border-gray-100 dark:border-slate-800">{extraFilters}</div> : null}
      <div className={wide ? 'grid grid-cols-2 gap-x-5 gap-y-4 items-start' : 'space-y-4'}>
        <div>
          <label
            htmlFor="filter-rarity"
            className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
          >
            {t('search.rarity')}
          </label>
          <select
            id="filter-rarity"
            value={filters.rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer shadow-inner dark:shadow-none hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            {rarities.map((rarity) => (
              <option key={rarity.value} value={rarity.value}>
                {rarity.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-cmc"
            className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
          >
            {t('search.cmc')}
          </label>
          <input
            id="filter-cmc"
            type="number"
            min="0"
            value={filters.cmc}
            onChange={(e) => setCmc(e.target.value)}
            placeholder={t('search.cmcPlaceholder')}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:font-normal placeholder:text-gray-400 shadow-inner dark:shadow-none hover:bg-gray-100 dark:hover:bg-slate-800"
          />
        </div>
      </div>

      {/* Behind a disclosure: seven more controls open in a sheet that is already dense on
          a phone, and most searches never need them. */}
      <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowTextFields((prev) => !prev)}
          aria-expanded={showTextFields}
          className="w-full flex items-center justify-between gap-2 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider py-1 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <span>{t('search.textAndStats')}</span>
          <FaChevronDown className={`text-[9px] transition-transform ${showTextFields ? 'rotate-180' : ''}`} />
        </button>
        {showTextFields ? <div className="pt-3">{renderTextFields(wide)}</div> : null}
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
        <button
          onClick={() => {
            clearFilters();
            setIsExpanded(false);
          }}
          disabled={!hasActiveFilters}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-red-50 dark:bg-slate-800/80 dark:hover:bg-red-500/10 text-gray-600 hover:text-danger dark:text-gray-300 dark:hover:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 text-xs font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaUndo className={hasActiveFilters ? 'animate-spin-slow once' : ''} />
          {t('search.clearFilters')}
        </button>
      </div>
    </>
  );

  return (
    <div className="relative inline-block text-left z-20">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 font-extrabold text-xs cursor-pointer border shadow-sm active:scale-95 ${
          isExpanded || hasActiveFilters
            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 ring-2 ring-blue-500/20 shadow-blue-500/10'
            : 'bg-white dark:bg-slate-800/80 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700/80 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 backdrop-blur-sm'
        }`}
        title={t('search.advancedFilters')}
      >
        <FaFilter
          className={`text-xs shrink-0 transition-colors duration-300 ${hasActiveFilters ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}
        />
        <span>{t('search.advancedFilters')}</span>
        {hasActiveFilters ? (
          <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-0 right-0 -mt-0.5 -mr-0.5 animate-pulse"></span>
        ) : null}
      </button>

      {isExpanded && !isMobile ? (
        <>
          {/* Backdrop click is a mouse-only convenience; Escape provides the keyboard-equivalent action. */}
          <div className="fixed inset-0 z-30" onClick={() => setIsExpanded(false)} aria-hidden="true" />
          {/* Bounded by the space left below the trigger, not by a fixed height: a flat cap
              made tall screens scroll for no reason, and `100dvh` alone ignored that the
              panel starts ~20rem down the page and would run off the bottom. */}
          <div className="absolute left-0 mt-2 w-[34rem] max-h-[max(18rem,calc(100dvh-20rem))] overflow-y-auto overscroll-contain rounded-2xl shadow-2xl bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border border-gray-200/80 dark:border-slate-700/80 p-5 z-40 space-y-5 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider block">
                {t('search.advancedFilters')}
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                aria-label={t('common.close')}
              >
                <FaTimes />
              </button>
            </div>
            {renderFilterFields(true)}
          </div>
        </>
      ) : null}

      {/* Bottom sheet below sm: the anchored dropdown is cramped inside the
          sticky search header on phones. */}
      <BottomSheet
        isOpen={isExpanded && isMobile}
        onClose={() => setIsExpanded(false)}
        labelledBy="search-filters-sheet-title"
        className="search-filters-sheet space-y-5"
      >
        <div className="flex items-center justify-between">
          <span
            id="search-filters-sheet-title"
            className="text-[11px] font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider block"
          >
            {t('search.advancedFilters')}
          </span>
          <button
            onClick={() => setIsExpanded(false)}
            // `-mr-2` is deliberately absent: it pushed the button 8px past the sheet's right
            // edge, which is the horizontal scroll. The other three keep the 44px tap target
            // from changing the row's layout.
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer p-2 -my-2 -ml-2"
            aria-label={t('common.close')}
          >
            <FaTimes />
          </button>
        </div>
        {mobileExtras}
        {renderFilterFields(false)}
      </BottomSheet>
    </div>
  );
}

export default SearchFilters;
