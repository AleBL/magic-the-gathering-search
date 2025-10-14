import React from 'react';
import CardItem from './CardItem';
import { Card } from '../types/Card';

interface CardGridProps {
  cards: Card[];
  size: 'small' | 'medium' | 'large' | 'xlarge';
  onAddToDeck: (card: Card) => void;
  onRemoveFromDeck?: (card: Card) => void;
  showRemoveButton?: boolean;
}

function CardGrid({ cards, size, onAddToDeck, onRemoveFromDeck, showRemoveButton = false }: CardGridProps) {
  const getGridClass = () => {
    switch (size) {
      case 'small':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2';
      case 'medium':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
      case 'large':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6';
      case 'xlarge':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8';
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
    }
  };

  return (
    <div className={`grid ${getGridClass()}`}>
      {cards.map((card) => (
        <CardItem
          key={card.id}
          card={card}
          size={size}
          onAddToDeck={onAddToDeck}
          onRemoveFromDeck={onRemoveFromDeck}
          showRemoveButton={showRemoveButton}
        />
      ))}
    </div>
  );
}

export default CardGrid;

