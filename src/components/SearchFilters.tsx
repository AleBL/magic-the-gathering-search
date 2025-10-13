import React, { useState } from 'react';

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
  const [showFilters, setShowFilters] = useState(false);

  const colors = [
    { code: 'W', name: 'Branco', color: 'bg-yellow-100' },
    { code: 'U', name: 'Azul', color: 'bg-blue-500' },
    { code: 'B', name: 'Preto', color: 'bg-gray-900' },
    { code: 'R', name: 'Vermelho', color: 'bg-red-600' },
    { code: 'G', name: 'Verde', color: 'bg-green-600' },
  ];

  const types = [
    'Creature',
    'Instant',
    'Sorcery',
    'Enchantment',
    'Artifact',
    'Planeswalker',
    'Land',
  ];

  const rarities = [
    { value: '', label: 'Todas' },
    { value: 'common', label: 'Comum' },
    { value: 'uncommon', label: 'Incomum' },
    { value: 'rare', label: 'Rara' },
    { value: 'mythic', label: 'Mítica' },
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
    <div className="bg-gray-700 rounded-lg">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="w-full px-4 py-2 text-white text-left flex items-center justify-between hover:bg-gray-600 rounded-lg transition-colors"
      >
        <span className="font-semibold">Filtros Avançados</span>
        <span className="text-xl">{showFilters ? '−' : '+'}</span>
      </button>

      {showFilters && (
        <div className="p-4 space-y-4 border-t border-gray-600">
          {/* Filtro de Cores */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">Cores:</label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color.code}
                  onClick={() => toggleColor(color.code)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.colors.includes(color.code)
                      ? `${color.color} text-white ring-2 ring-white`
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {color.name}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro de Tipos */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">Tipos:</label>
            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.types.includes(type)
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro de Raridade */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">Raridade:</label>
            <select
              value={filters.rarity}
              onChange={(e) => setFilters((prev) => ({ ...prev, rarity: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {rarities.map((rarity) => (
                <option key={rarity.value} value={rarity.value}>
                  {rarity.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de CMC (Custo de Mana Convertido) */}
          <div>
            <label className="block text-white text-sm font-semibold mb-2">
              Custo de Mana Convertido (CMC):
            </label>
            <input
              type="number"
              value={filters.cmc}
              onChange={(e) => setFilters((prev) => ({ ...prev, cmc: e.target.value }))}
              placeholder="Ex: 3"
              min="0"
              className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Botão Limpar Filtros */}
          <button
            onClick={clearFilters}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Limpar Filtros
          </button>
        </div>
      )}
    </div>
  );
}

export default SearchFilters;

