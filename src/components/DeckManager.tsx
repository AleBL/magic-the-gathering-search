import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../types/Card';
import { Deck } from '../types/Deck';
import CardGrid from './CardGrid';

interface DeckManagerProps {
  currentDeck: Card[];
  onRemoveFromDeck: (card: Card) => void;
  onClearDeck: () => void;
}

function DeckManager({ currentDeck, onRemoveFromDeck, onClearDeck }: DeckManagerProps) {
  const { t } = useTranslation();
  const [savedDecks, setSavedDecks] = useState<Deck[]>([]);
  const [deckName, setDeckName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('small');

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = () => {
    const decksJson = localStorage.getItem('mtg_decks');
    if (decksJson) {
      setSavedDecks(JSON.parse(decksJson));
    }
  };

  const saveDeck = () => {
    if (!deckName.trim()) {
      alert('Por favor, digite um nome para o deck');
      return;
    }

    if (currentDeck.length === 0) {
      alert('O deck está vazio');
      return;
    }

    const newDeck: Deck = {
      id: Date.now().toString(),
      name: deckName,
      cards: currentDeck,
      createdAt: new Date().toISOString(),
    };

    const updatedDecks = [...savedDecks, newDeck];
    localStorage.setItem('mtg_decks', JSON.stringify(updatedDecks));
    setSavedDecks(updatedDecks);
    setDeckName('');
    setShowSaveDialog(false);
    alert(t('deckSaved'));
  };

  const deleteDeck = (deckId: string) => {
    if (confirm(t('confirmDelete'))) {
      const updatedDecks = savedDecks.filter((deck) => deck.id !== deckId);
      localStorage.setItem('mtg_decks', JSON.stringify(updatedDecks));
      setSavedDecks(updatedDecks);
      if (selectedDeck?.id === deckId) {
        setSelectedDeck(null);
      }
    }
  };

  const loadDeck = (deck: Deck) => {
    setSelectedDeck(deck);
  };

  const exportDeck = (deck: Deck) => {
    const dataStr = JSON.stringify(deck, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deck.name.replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importDeck = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const deck = JSON.parse(e.target?.result as string) as Deck;
        deck.id = Date.now().toString(); // Novo ID para evitar conflitos
        const updatedDecks = [...savedDecks, deck];
        localStorage.setItem('mtg_decks', JSON.stringify(updatedDecks));
        setSavedDecks(updatedDecks);
        alert(t('deckImported'));
      } catch (error) {
        alert(t('invalidFile'));
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const exportAllDecks = () => {
    const dataStr = JSON.stringify(savedDecks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-decks-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCardCount = (cards: Card[]) => {
    const counts: { [key: string]: number } = {};
    cards.forEach((card) => {
      counts[card.id] = (counts[card.id] || 0) + 1;
    });
    return counts;
  };

  const uniqueCards = selectedDeck
    ? Array.from(new Set(selectedDeck.cards.map((c) => c.id))).map((id) =>
        selectedDeck.cards.find((c) => c.id === id)!
      )
    : [];

  const cardCounts = selectedDeck ? getCardCount(selectedDeck.cards) : {};

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 space-y-4 transition-colors duration-300">
        <h2 className="text-gray-900 dark:text-white text-2xl font-bold transition-colors duration-300">
          {t('deckManager')}
        </h2>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={currentDeck.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {t('saveCurrentDeck')} ({currentDeck.length} {t('cards')})
          </button>

          <button
            onClick={onClearDeck}
            disabled={currentDeck.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-300 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {t('clearCurrentDeck')}
          </button>

          <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg">
            {t('importDeck')}
            <input type="file" accept=".json" onChange={importDeck} className="hidden" />
          </label>

          {savedDecks.length > 0 && (
            <button
              onClick={exportAllDecks}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              {t('exportAllDecks')}
            </button>
          )}
        </div>

        {currentDeck.length > 0 && (
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
        )}
      </div>

      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 transition-colors duration-300">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Lista de Decks Salvos */}
          <div className="lg:col-span-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-4 transition-colors duration-300">
            <h3 className="text-gray-900 dark:text-white text-xl font-semibold mb-4 transition-colors duration-300">
              {t('savedDecks')} ({savedDecks.length})
            </h3>
            <div className="space-y-2">
              {savedDecks.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-sm transition-colors duration-300">
                  {t('noSavedDecks')}
                </p>
              ) : (
                savedDecks.map((deck) => (
                  <div
                    key={deck.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                      selectedDeck?.id === deck.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => loadDeck(deck)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{deck.name}</p>
                        <p className="text-xs opacity-75">
                          {deck.cards.length} {t('cards')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportDeck(deck);
                          }}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-all duration-300"
                          title="Exportar"
                        >
                          ↓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDeck(deck.id);
                          }}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-all duration-300"
                          title="Excluir"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Deck Atual */}
          <div className="lg:col-span-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-4 transition-colors duration-300">
            <h3 className="text-gray-900 dark:text-white text-xl font-semibold mb-4 transition-colors duration-300">
              {t('currentDeck')}
            </h3>
            {currentDeck.length === 0 && !selectedDeck ? (
              <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">
                {t('addCardsMessage')}
              </p>
            ) : (
              <CardGrid
                cards={selectedDeck ? uniqueCards : currentDeck}
                size={cardSize}
                onAddToDeck={() => {}}
                onRemoveFromDeck={onRemoveFromDeck}
                showRemoveButton={!selectedDeck}
              />
            )}
          </div>
        </div>
      </div>

      {/* Dialog para salvar deck */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl transition-colors duration-300">
            <h3 className="text-gray-900 dark:text-white text-xl font-bold mb-4 transition-colors duration-300">
              {t('saveDeck')}
            </h3>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder={t('deckNamePlaceholder')}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 transition-all duration-300"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={saveDeck}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                {t('save')}
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setDeckName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeckManager;

