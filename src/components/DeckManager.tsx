import React, { useState, useEffect } from 'react';
import { Card } from '../types/Card';
import { Deck } from '../types/Deck';
import CardGrid from './CardGrid';

interface DeckManagerProps {
  currentDeck: Card[];
  onRemoveFromDeck: (card: Card) => void;
  onClearDeck: () => void;
}

function DeckManager({ currentDeck, onRemoveFromDeck, onClearDeck }: DeckManagerProps) {
  const [savedDecks, setSavedDecks] = useState<Deck[]>([]);
  const [deckName, setDeckName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('small');

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
    alert('Deck salvo com sucesso!');
  };

  const deleteDeck = (deckId: string) => {
    if (confirm('Tem certeza que deseja excluir este deck?')) {
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
        alert('Deck importado com sucesso!');
      } catch (error) {
        alert('Erro ao importar deck. Verifique se o arquivo é válido.');
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
    link.download = 'all_decks.json';
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
    <div className="flex flex-col h-full bg-gray-900">
      <div className="bg-gray-800 p-4 space-y-4">
        <h2 className="text-white text-2xl font-bold">Gerenciador de Decks</h2>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={currentDeck.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Salvar Deck Atual ({currentDeck.length} cartas)
          </button>

          <button
            onClick={onClearDeck}
            disabled={currentDeck.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Limpar Deck Atual
          </button>

          <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            Importar Deck
            <input type="file" accept=".json" onChange={importDeck} className="hidden" />
          </label>

          {savedDecks.length > 0 && (
            <button
              onClick={exportAllDecks}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Exportar Todos os Decks
            </button>
          )}
        </div>

        {currentDeck.length > 0 && (
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
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Lista de Decks Salvos */}
          <div className="lg:col-span-1 bg-gray-800 rounded-lg p-4">
            <h3 className="text-white text-xl font-semibold mb-4">Decks Salvos ({savedDecks.length})</h3>
            <div className="space-y-2">
              {savedDecks.length === 0 ? (
                <p className="text-gray-400 text-sm">Nenhum deck salvo</p>
              ) : (
                savedDecks.map((deck) => (
                  <div
                    key={deck.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedDeck?.id === deck.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={() => loadDeck(deck)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{deck.name}</p>
                        <p className="text-xs opacity-75">{deck.cards.length} cartas</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportDeck(deck);
                          }}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          title="Exportar"
                        >
                          ↓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDeck(deck.id);
                          }}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
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

          {/* Visualização do Deck */}
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
            <h3 className="text-white text-xl font-semibold mb-4">
              {selectedDeck ? `${selectedDeck.name} (${selectedDeck.cards.length} cartas)` : 'Deck Atual'}
            </h3>
            {selectedDeck ? (
              <div className="space-y-2">
                {uniqueCards.map((card) => (
                  <div key={card.id} className="flex items-center gap-2 bg-gray-700 p-2 rounded">
                    <img
                      src={card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small}
                      alt={card.name}
                      className="w-12 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="text-white font-semibold">{card.name}</p>
                      <p className="text-gray-400 text-sm">{card.type_line}</p>
                    </div>
                    <span className="text-white font-bold text-lg px-3 py-1 bg-gray-600 rounded">
                      {cardCounts[card.id]}x
                    </span>
                  </div>
                ))}
              </div>
            ) : currentDeck.length > 0 ? (
              <CardGrid
                cards={currentDeck}
                cardSize={cardSize}
                onAddToDeck={() => {}}
                onRemoveFromDeck={onRemoveFromDeck}
                showRemoveButton={true}
              />
            ) : (
              <p className="text-gray-400">Adicione cartas ao deck atual ou selecione um deck salvo</p>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de Salvar Deck */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-xl font-semibold mb-4">Salvar Deck</h3>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Nome do deck"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={saveDeck}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Salvar
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setDeckName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeckManager;

