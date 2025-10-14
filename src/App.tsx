import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SwitchDarkMode from './SwitchDarkMode';
import SelectLanguage from './SelectLanguage';
import CardSearch from './components/CardSearch';
import DeckManager from './components/DeckManager';
import { Card } from './types/Card';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'search' | 'deck'>('search');
  const [currentDeck, setCurrentDeck] = useState<Card[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    return savedDarkMode !== null ? savedDarkMode === 'true' : true;
  });

  // Aplicar dark mode ao documento
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const handleAddToDeck = (card: Card) => {
    setCurrentDeck((prev) => [...prev, card]);
  };

  const handleRemoveFromDeck = (cardToRemove: Card) => {
    setCurrentDeck((prev) => {
      const index = prev.findIndex((c) => c.id === cardToRemove.id);
      if (index > -1) {
        const newDeck = [...prev];
        newDeck.splice(index, 1);
        return newDeck;
      }
      return prev;
    });
  };

  const handleClearDeck = () => {
    if (confirm(t('confirmClear'))) {
      setCurrentDeck([]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-gray-900 dark:text-white text-xl font-bold transition-colors duration-300">
              {t('appTitle')}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  activeTab === 'search'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('searchTab')}
              </button>
              <button
                onClick={() => setActiveTab('deck')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 relative ${
                  activeTab === 'deck'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('decksTab')}
                {currentDeck.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {currentDeck.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <SwitchDarkMode isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
            <SelectLanguage />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'search' ? (
          <CardSearch onAddToDeck={handleAddToDeck} />
        ) : (
          <DeckManager
            currentDeck={currentDeck}
            onRemoveFromDeck={handleRemoveFromDeck}
            onClearDeck={handleClearDeck}
          />
        )}
      </div>
    </div>
  );
}

export default App;

