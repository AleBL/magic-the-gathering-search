import { memo, useMemo } from 'react';
import CardItem from './CardItem';
import { DeckZone } from '../../types/enums';
import { Card } from '../../types/Card';
import { CardSize } from '../../types';
import { DeckFormat } from '../../types/Deck';
import { groupCardsByUnique } from '../../utils/deckGrouping';

interface CardGridProps {
  cards: Card[];
  size: CardSize;
  onAddToDeck?: (card: Card) => void;
  onAddTokenToDeck?: (token: Card) => void;
  onRemoveFromDeck?: (card: Card) => void;
  showRemoveButton?: boolean;
  activeFormat?: DeckFormat;
  isDeckCard?: boolean;
  deckCards?: Card[];
  onSelectPrint?: (updatedCard: Card) => void;
  isToken?: boolean;
  isEditMode?: boolean;
  onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
  stackDuplicates?: boolean;
  showCollectionControls?: boolean;
  showPrintingBadge?: boolean;
  isAddDraggable?: boolean;
}

const GRID_CLASSES: Record<CardSize, string> = {
  small: 'card-grid-small',
  medium: 'card-grid-medium',
  large: 'card-grid-large',
  xlarge: 'card-grid-xlarge'
};

function CardGrid({
  cards,
  size,
  onAddToDeck,
  onAddTokenToDeck,
  onRemoveFromDeck,
  showRemoveButton = false,
  activeFormat,
  isDeckCard,
  deckCards,
  onSelectPrint,
  isToken,
  isEditMode,
  onUpdateCardZone,
  stackDuplicates = false,
  showCollectionControls = false,
  showPrintingBadge = false,
  isAddDraggable = false
}: CardGridProps) {
  const entries = useMemo(
    () =>
      stackDuplicates
        ? groupCardsByUnique(cards).map(({ name, count, card }) => ({ key: name, count, card }))
        : cards.map((card, index) => ({ key: `${card.id}-${index}`, count: 1, card })),
    [cards, stackDuplicates]
  );

  return (
    <div className={GRID_CLASSES[size]}>
      {entries.map(({ key, count, card }) => (
        <div
          key={key}
          className={`animate-fadeIn ${count > 1 ? 'card-grid-stack-wrapper' : ''}`}
          data-stack-depth={count > 2 ? '3' : count > 1 ? '2' : '1'}
        >
          {count > 2 ? <div className="card-grid-stack-shadow card-grid-stack-shadow-two" /> : null}
          {count > 1 ? <div className="card-grid-stack-shadow card-grid-stack-shadow-one" /> : null}
          <div className={count > 1 ? 'card-grid-stack-top' : undefined}>
            <CardItem
              card={card}
              size={size}
              onAddToDeck={onAddToDeck}
              onAddTokenToDeck={onAddTokenToDeck}
              onRemoveFromDeck={onRemoveFromDeck}
              showRemoveButton={showRemoveButton}
              activeFormat={activeFormat}
              isDeckCard={isDeckCard}
              deckCards={deckCards}
              onSelectPrint={onSelectPrint}
              isToken={isToken}
              isEditMode={isEditMode}
              onUpdateCardZone={onUpdateCardZone}
              showCollectionControls={showCollectionControls}
              showPrintingBadge={showPrintingBadge}
              isAddDraggable={isAddDraggable}
            />
            {count > 1 ? <span className="deck-stack-count-badge">{count}x</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(CardGrid);
