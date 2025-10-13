import React, { useState, useEffect } from 'react';
import * as Scry from 'scryfall-sdk';
import CardGrid from './CardGrid';
import SearchFilters from './SearchFilters';
import { Card } from '../types/Card';

interface CardSearchProps {
  onAddToDeck: (card: Card) => void;
}

function CardSearch({ onAddToDeck }: CardSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [filters, setFilters] = useState({
    colors: [] as string[],
    types: [] as string[],
    rarity: '',
    cmc: '',
  });

  const searchCards = async () => {
    if (!searchQuery.trim()) {
      setCards([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Construir query com filtros
      let query = searchQuery;
      
      if (filters.colors.length > 0) {
        query += ` c:${filters.colors.join('')}`;
      }
      
      if (filters.types.length > 0) {
        query += ` t:${filters.types.join(' ')}`;
      }
      
      if (filters.rarity) {
        query += ` r:${filters.rarity}`;
      }
      
      if (filters.cmc) {
        query += ` cmc=${filters.cmc}`;
      }

      const result = await Scry.Cards.search(query).waitForAll();
      setCards(result as Card[]);
    } catch (err) {
      setError('Erro ao buscar cartas. Tente novamente.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        searchCards();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, filters]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 p-4 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cartas..."
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={searchCards}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Buscar
          </button>
        </div>

        <SearchFilters filters={filters} setFilters={setFilters} />

        <div className="flex items-center gap-4">
          <span className="text-white text-sm">Tamanho das cartas:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCardSize('small')}
              className={`px-3 py-1 rounded ${
                cardSize === 'small'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Pequeno
            </button>
            <button
              onClick={() => setCardSize('medium')}
              className={`px-3 py-1 rounded ${
                cardSize === 'medium'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Médio
            </button>
            <button
              onClick={() => setCardSize('large')}
              className={`px-3 py-1 rounded ${
                cardSize === 'large'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Grande
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex justify-center items-center h-full">
            <div className="text-white text-xl">Carregando...</div>
          </div>
        )}

        {error && (
          <div className="flex justify-center items-center h-full">
            <div className="text-red-500 text-xl">{error}</div>
          </div>
        )}

        {!loading && !error && cards.length === 0 && searchQuery && (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-400 text-xl">Nenhuma carta encontrada</div>
          </div>
        )}

        {!loading && !error && cards.length > 0 && (
          <CardGrid cards={cards} cardSize={cardSize} onAddToDeck={onAddToDeck} />
        )}
      </div>
    </div>
  );
}

export default CardSearch;

