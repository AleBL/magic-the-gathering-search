import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Filters {
  colors: string[];
  types: string[];
  rarity: string;
  cmc: string;
}

interface SearchFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}

function SearchFilters({ filters, setFilters }: SearchFiltersProps) {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);

  const colors = [
    { code: 'W', name: t('white'), color: 'bg-yellow-100' },
    { code: 'U', name: t('blue'), color: 'bg-blue-500' },
    { code: 'B', name: t('black'), color: 'bg-gray-900' },
    { code: 'R', name: t('red'), color: 'bg-red-600' },
    { code: 'G', name: t('green'), color: 'bg-green-600' },
  ];

  const types = [
    { code: 'Creature', name: t('creature') },
    { code: 'Instant', name: t('instant') },
    { code: 'Sorcery', name: t('sorcery') },
    { code: 'Enchantment', name: t('enchantment') },
    { code: 'Artifact', name: t('artifact') },
    { code: 'Planeswalker', name: t('planeswalker') },
    { code: 'Land', name: t('land') },
  ];

  const rarities = [
    { value: '', label: t('all') },
    { value: 'common', label: t('common') },
    { value: 'uncommon', label: t('uncommon') },
    { value: 'rare', label: t('rare') },
    { value: 'mythic', label: t('mythic') },
  ];

  const toggleColor = (colorCode: string) => {
    setFilters((prev) => ({
      ...prev,
      colors: prev.colors.includes(colorCode)
        ? prev.colors.filter((c) => c !== colorCode)
        : [...prev.colors, colorCode],
    }));
  };

  const toggleType = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  const clearFilters = () => {
    setFilters({
      colors: [],
      types: [],
      rarity: '',
      cmc: '',
    });
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors duration-300">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="w-full px-4 py-2 text-gray-900 dark:text-white text-left flex items-center justify-between hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-all duration-300"
      >
        <span className="font-semibold">{t('advancedFilters')}</span>
        <span className="text-xl">{showFilters ? '−' : '+'}</span>
      </button>

      {showFilters && (
        <div className="p-4 space-y-4 border-t border-gray-300 dark:border-gray-600 transition-colors duration-300">
          {/* Cores */}
          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-semibold mb-2 transition-colors duration-300">
              {t('colors')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color.code}
                  onClick={() => toggleColor(color.code)}
                  className={`px-3 py-1 rounded transition-all duration-300 ${
                    filters.colors.includes(color.code)
                      ? `${color.color} text-white shadow-md ring-2 ring-blue-500`
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                >
                  {color.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tipos */}
          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-semibold mb-2 transition-colors duration-300">
              {t('types')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {types.map((type) => (
                <button
                  key={type.code}
                  onClick={() => toggleType(type.code)}
                  className={`px-3 py-1 rounded transition-all duration-300 ${
                    filters.types.includes(type.code)
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                >
                  {type.name}
                </button>
              ))}
            </div>
          </div>

          {/* Raridade */}
          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-semibold mb-2 transition-colors duration-300">
              {t('rarity')}
            </label>
            <select
              value={filters.rarity}
              onChange={(e) => setFilters((prev) => ({ ...prev, rarity: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
            >
              {rarities.map((rarity) => (
                <option key={rarity.value} value={rarity.value}>
                  {rarity.label}
                </option>
              ))}
            </select>
          </div>

          {/* CMC */}
          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-semibold mb-2 transition-colors duration-300">
              {t('cmc')}
            </label>
            <input
              type="number"
              value={filters.cmc}
              onChange={(e) => setFilters((prev) => ({ ...prev, cmc: e.target.value }))}
              placeholder={t('cmcPlaceholder')}
              className="w-full px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
            />
          </div>

          {/* Limpar Filtros */}
          <button
            onClick={clearFilters}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            {t('clearFilters')}
          </button>
        </div>
      )}
    </div>
  );
}

export default SearchFilters;

