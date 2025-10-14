import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Scry from 'scryfall-sdk';
import CardGrid from './CardGrid';
import SearchFilters from './SearchFilters';
import { Card } from '../types/Card';

interface CardSearchProps {
  onAddToDeck: (card: Card) => void;
}

function CardSearch({ onAddToDeck }: CardSearchProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
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
      setError(t('error'));
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 space-y-4 transition-colors duration-300">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
          />
          <button
            onClick={searchCards}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            {t('searchButton')}
          </button>
        </div>

        <SearchFilters filters={filters} setFilters={setFilters} />

        <div className="flex items-center gap-4">
          <span className="text-gray-700 dark:text-white text-sm transition-colors duration-300">
            {t('cardSize')}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCardSize('small')}
              className={`px-3 py-1 rounded transition-all duration-300 ${
                cardSize === 'small'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('small')}
            </button>
            <button
              onClick={() => setCardSize('medium')}
              className={`px-3 py-1 rounded transition-all duration-300 ${
                cardSize === 'medium'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('medium')}
            </button>
            <button
              onClick={() => setCardSize('large')}
              className={`px-3 py-1 rounded transition-all duration-300 ${
                cardSize === 'large'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('large')}
            </button>
            <button
              onClick={() => setCardSize('xlarge')}
              className={`px-3 py-1 rounded transition-all duration-300 ${
                cardSize === 'xlarge'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t('extraLarge')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-white dark:bg-gray-900 transition-colors duration-300">
        {loading && (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-900 dark:text-white text-xl transition-colors duration-300">
              {t('loading')}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center items-center h-full">
            <div className="text-red-500 text-xl">{error}</div>
          </div>
        )}

        {!loading && !error && cards.length === 0 && searchQuery && (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 dark:text-gray-400 text-xl transition-colors duration-300">
              {t('noResults')}
            </div>
          </div>
        )}

        {!loading && !error && cards.length > 0 && (
          <CardGrid cards={cards} size={cardSize} onAddToDeck={onAddToDeck} />
        )}
      </div>
    </div>
  );
}

export default CardSearch;

