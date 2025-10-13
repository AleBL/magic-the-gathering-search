import React, { useState } from 'react';
import { Card } from '../types/Card';

interface CardItemProps {
  card: Card;
  cardSize: 'small' | 'medium' | 'large';
  onAddToDeck: (card: Card) => void;
  onRemoveFromDeck?: (card: Card) => void;
  showRemoveButton?: boolean;
}

function CardItem({ card, cardSize, onAddToDeck, onRemoveFromDeck, showRemoveButton = false }: CardItemProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getImageUrl = () => {
    if (card.image_uris) {
      return cardSize === 'small' ? card.image_uris.small : card.image_uris.normal;
    }
    if (card.card_faces && card.card_faces[0].image_uris) {
      return cardSize === 'small' ? card.card_faces[0].image_uris.small : card.card_faces[0].image_uris.normal;
    }
    return '';
  };

  const getSizeClass = () => {
    switch (cardSize) {
      case 'small':
        return 'h-32';
      case 'medium':
        return 'h-48';
      case 'large':
        return 'h-64';
      default:
        return 'h-48';
    }
  };

  return (
    <div className="relative group">
      <div className={`${getSizeClass()} rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105 cursor-pointer`}>
        <img
          src={getImageUrl()}
          alt={card.name}
          className="w-full h-full object-cover"
          onClick={() => setShowDetails(true)}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-xs truncate">{card.name}</p>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => onAddToDeck(card)}
            className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
          >
            + Deck
          </button>
          {showRemoveButton && onRemoveFromDeck && (
            <button
              onClick={() => onRemoveFromDeck(card)}
              className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {showDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetails(false)}
        >
          <div className="max-w-2xl max-h-full overflow-auto bg-gray-800 rounded-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0">
                <img
                  src={card.image_uris?.large || card.image_uris?.normal || getImageUrl()}
                  alt={card.name}
                  className="rounded-lg max-h-96"
                />
              </div>
              <div className="flex-1 text-white space-y-3">
                <h2 className="text-2xl font-bold">{card.name}</h2>
                <p className="text-gray-300">{card.type_line}</p>
                {card.mana_cost && <p className="text-yellow-400">Custo: {card.mana_cost}</p>}
                {card.oracle_text && (
                  <div>
                    <h3 className="font-semibold mb-1">Texto:</h3>
                    <p className="text-gray-300 whitespace-pre-line">{card.oracle_text}</p>
                  </div>
                )}
                {card.power && card.toughness && (
                  <p className="text-green-400">Poder/Resistência: {card.power}/{card.toughness}</p>
                )}
                <p className="text-gray-400">Raridade: {card.rarity}</p>
                <p className="text-gray-400">Coleção: {card.set_name}</p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      onAddToDeck(card);
                      setShowDetails(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Adicionar ao Deck
                  </button>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CardItem;

