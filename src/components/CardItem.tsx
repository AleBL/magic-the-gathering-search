import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../types/Card';

interface CardItemProps {
  card: Card;
  size: 'small' | 'medium' | 'large' | 'xlarge';
  onAddToDeck: (card: Card) => void;
  onRemoveFromDeck?: (card: Card) => void;
  showRemoveButton?: boolean;
}

function CardItem({ card, size, onAddToDeck, onRemoveFromDeck, showRemoveButton = false }: CardItemProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  const getImageUrl = () => {
    if (card.image_uris) {
      return size === 'small' ? card.image_uris.small : card.image_uris.normal;
    }
    if (card.card_faces && card.card_faces[0].image_uris) {
      return size === 'small' ? card.card_faces[0].image_uris.small : card.card_faces[0].image_uris.normal;
    }
    return '';
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'aspect-[5/7]'; // Proporção correta de cartas Magic
      case 'medium':
        return 'aspect-[5/7]';
      case 'large':
        return 'aspect-[5/7]';
      case 'xlarge':
        return 'aspect-[5/7]';
      default:
        return 'aspect-[5/7]';
    }
  };

  return (
    <div className="relative group">
      <div className={`${getSizeClass()} rounded-lg overflow-hidden shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer bg-gray-200 dark:bg-gray-800`}>
        <img
          src={getImageUrl()}
          alt={card.name}
          className="w-full h-full object-contain"
          onClick={() => setShowDetails(true)}
          loading="lazy"
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-90 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-b-lg">
        <p className="text-white text-xs truncate font-medium">{card.name}</p>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => onAddToDeck(card)}
            className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            {t('addToDeck')}
          </button>
          {showRemoveButton && onRemoveFromDeck && (
            <button
              onClick={() => onRemoveFromDeck(card)}
              className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              {t('remove')}
            </button>
          )}
        </div>
      </div>

      {showDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
          onClick={() => setShowDetails(false)}
        >
          <div 
            className="max-w-4xl max-h-[90vh] overflow-auto bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl transition-colors duration-300" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 flex justify-center">
                <img
                  src={card.image_uris?.large || card.image_uris?.normal || getImageUrl()}
                  alt={card.name}
                  className="rounded-lg max-h-[600px] object-contain"
                />
              </div>
              <div className="flex-1 text-gray-900 dark:text-white space-y-3 transition-colors duration-300">
                <h2 className="text-2xl font-bold">{card.name}</h2>
                <p className="text-gray-700 dark:text-gray-300 transition-colors duration-300">{card.type_line}</p>
                {card.mana_cost && (
                  <p className="text-yellow-600 dark:text-yellow-400 transition-colors duration-300">
                    Custo: {card.mana_cost}
                  </p>
                )}
                {card.oracle_text && (
                  <div>
                    <h3 className="font-semibold mb-1">Texto:</h3>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line transition-colors duration-300">
                      {card.oracle_text}
                    </p>
                  </div>
                )}
                {card.power && card.toughness && (
                  <p className="text-green-600 dark:text-green-400 transition-colors duration-300">
                    Poder/Resistência: {card.power}/{card.toughness}
                  </p>
                )}
                <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">
                  Raridade: {card.rarity}
                </p>
                <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">
                  Coleção: {card.set_name}
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      onAddToDeck(card);
                      setShowDetails(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    Adicionar ao Deck
                  </button>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 transition-all duration-300 shadow-md hover:shadow-lg"
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

