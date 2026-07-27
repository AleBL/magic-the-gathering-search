import { Dispatch, SetStateAction } from 'react';
import { SearchFilters as SearchFiltersType } from '../../types';
import { useSearchFilters } from '../../hooks/useSearchFilters';
import { MANA_COLOR_GRADIENTS, MANA_COLOR_IS_LIGHT, MANA_COLOR_ROW_ACTIVE } from '../../constants/manaColors';

interface CardFilterBarProps {
  filters: SearchFiltersType;
  setFilters: Dispatch<SetStateAction<SearchFiltersType>>;
  /**
   * Full-text, two-column layout for the mobile filters sheet: colors on the
   * left and types on the right, each stacked vertically with their complete
   * localized name — neither a swatch letter nor a hover title works on
   * touch, and a horizontal scroll strip hides most types off-screen with no
   * hint that there's more to swipe to.
   */
  mobileLayout?: boolean;
}

export default function CardFilterBar({ filters, setFilters, mobileLayout = false }: CardFilterBarProps) {
  const { colors, types, toggleColor, toggleType } = useSearchFilters(filters, setFilters);

  // Mana color classes (desktop swatch)
  const getManaColorClass = (code: string, isActive: boolean) => {
    const base =
      'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer transition-all duration-300 transform';

    if (!isActive)
      return `${base} bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm hover:scale-110`;

    return `${base} ${MANA_COLOR_GRADIENTS[code] ?? ''}`;
  };

  if (mobileLayout) {
    return (
      <div className="flex flex-row gap-3 py-2 w-full items-start">
        {/* Colors — left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {colors.map((color: { code: string; name: string }) => {
            const isActive = filters.colors.includes(color.code);
            const isLight = MANA_COLOR_IS_LIGHT[color.code];
            return (
              <button
                key={color.code}
                type="button"
                onClick={() => toggleColor(color.code)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 w-full min-h-11 px-2.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border border-transparent ${
                  isActive
                    ? MANA_COLOR_ROW_ACTIVE[color.code]
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-black ${
                    isActive ? (isLight ? 'bg-black/10' : 'bg-white/25') : (MANA_COLOR_GRADIENTS[color.code] ?? '')
                  }`}
                >
                  {color.code}
                </span>
                <span className="truncate">{color.name}</span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-gray-200 dark:bg-slate-700" />

        {/* Types — right column */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {types.map((type: { code: string; name: string }) => {
            const isActive = filters.types.includes(type.code);
            return (
              <button
                key={type.code}
                type="button"
                onClick={() => toggleType(type.code)}
                aria-pressed={isActive}
                className={`flex items-center w-full min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer truncate ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-blue-500/25'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {type.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 py-2 sm:py-4 w-full">
      {/* Colors */}
      <div className="flex items-center gap-2">
        {colors.map((color: { code: string; name: string }) => (
          <button
            key={color.code}
            type="button"
            onClick={() => toggleColor(color.code)}
            className={getManaColorClass(color.code, filters.colors.includes(color.code))}
            title={color.name}
            aria-pressed={filters.colors.includes(color.code)}
          >
            {color.code}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

      {/* Types — wrap onto multiple rows so every type stays visible instead of
          hiding behind an awkward horizontal scroll (especially in the narrow
          deck-editor pane). */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {types.map((type: { code: string; name: string }) => {
          const isActive = filters.types.includes(type.code);
          return (
            <button
              key={type.code}
              onClick={() => toggleType(type.code)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-primary border-transparent text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 shadow-sm hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {type.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
