import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../types/Card';
import { CardSize } from '../../types';
import { DeckFormat } from '../../types/Deck';
import { DeckZone } from '../../types/enums';
import { GroupedCards, DeckCardGrouped, groupCardsByUnique, getCardImageUrl } from '../../utils/deckGrouping';
import { deckEntryId } from '../../utils/deckEntry';
import CardGrid from '../card/CardGrid';
import CardDetailModal from '../card/CardDetailModal';
import DeckCommandersHeader from './DeckCommandersHeader';
import { DeckCardListItem } from './DeckCardListItem';
import { useAnimatedList } from '../../hooks/useAnimatedList';

interface AnimatedDeckCardGroupProps {
  cards: Card[];
  activeFormat?: DeckFormat;
  isRemovable: boolean;
  isTokenZone: boolean;
  onToggleCommander: (card: Card) => void;
  onUpdateCard: (card: Card) => void;
  onAddToDeck: (card: Card) => void;
  onRemoveFromDeck: (card: Card) => void;
  onSelectCard: (card: Card) => void;
  onHoverEnter: (card: Card, e: React.MouseEvent) => void;
  onHoverMove: (e: React.MouseEvent) => void;
  onHoverLeave: () => void;
}

/** Stable key extractor — an inline arrow here would change identity every render. */
const getGroupedCardKey = (entry: DeckCardGrouped) => entry.key;

/**
 * A dedicated component (not inlined in the groups.map below) because
 * useAnimatedList must run once per rendered group — calling a hook inside
 * a variable-length .map() would break the Rules of Hooks.
 */
function AnimatedDeckCardGroup({ cards, ...itemProps }: AnimatedDeckCardGroupProps) {
  const uniqueCards = useMemo(() => groupCardsByUnique(cards), [cards]);
  const animatedCards = useAnimatedList(uniqueCards, getGroupedCardKey, 200);

  return (
    <div className="deck-list-compact">
      {animatedCards.map(({ key, item: { count, card }, isLeaving }) => (
        <DeckCardListItem key={key} card={card} count={count} isLeaving={isLeaving} {...itemProps} />
      ))}
    </div>
  );
}

interface DeckCardListProps {
  groups: GroupedCards[];
  commanders: Card[];
  cardSize: CardSize;
  viewMode: 'list' | 'grid';
  isRemovable: boolean;
  activeFormat?: DeckFormat;
  onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
  onAddToDeck: (card: Card) => void;
  onAddTokenToDeck?: (token: Card) => void;
  onRemoveFromDeck: (card: Card) => void;
  onToggleCommander: (card: Card) => void;
  onHoverEnter: (card: Card, e: React.MouseEvent) => void;
  onHoverMove: (e: React.MouseEvent) => void;
  onHoverLeave: () => void;
  onUpdateCard?: (updatedCard: Card) => void;
  isTokenZone?: boolean;
}

const TRANSLATABLE_TITLES = [
  'creature',
  'planeswalker',
  'instant',
  'sorcery',
  'enchantment',
  'artifact',
  'land',
  'other',
  'white',
  'blue',
  'black',
  'red',
  'green',
  'colorless',
  'multicolored'
];

const DeckCardList = memo(function DeckCardList({
  groups,
  commanders,
  cardSize,
  viewMode,
  isRemovable,
  isTokenZone = false,
  activeFormat,
  onUpdateCardZone,
  onAddToDeck,
  onAddTokenToDeck,
  onRemoveFromDeck,
  onToggleCommander,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onUpdateCard
}: DeckCardListProps) {
  const { t } = useTranslation();
  const [selectedModalCard, setSelectedModalCard] = useState<Card | null>(null);
  const [showPrintsOnOpen, setShowPrintsOnOpen] = useState(false);

  // Sync selectedModalCard when groups change (e.g. after art update). Matched by entry,
  // not printing: after an art change other copies may now share the new printing id.
  useEffect(() => {
    if (!selectedModalCard) return;
    const allCards = groups.flatMap((g) => g.cards);
    const target = deckEntryId(selectedModalCard);
    const updated = allCards.find((c) => deckEntryId(c) === target);
    if (updated && updated !== selectedModalCard) {
      setSelectedModalCard(updated);
    }
  }, [groups, selectedModalCard]);

  // Wrap onUpdateCard to also update the modal card state immediately
  const handleUpdateCard = useCallback(
    (updatedCard: Card) => {
      setSelectedModalCard(updatedCard);
      onUpdateCard?.(updatedCard);
    },
    [onUpdateCard]
  );

  const handleUpdateCardPrint = useCallback((card: Card) => {
    setShowPrintsOnOpen(true);
    setSelectedModalCard(card);
  }, []);

  const handleSelectCardModal = useCallback((card: Card) => {
    setShowPrintsOnOpen(false);
    setSelectedModalCard(card);
  }, []);

  const commandersHeader = (
    <DeckCommandersHeader
      commanders={commanders}
      cardSize={cardSize}
      viewMode={viewMode}
      isRemovable={isRemovable}
      onHoverEnter={onHoverEnter}
      onHoverMove={onHoverMove}
      onHoverLeave={onHoverLeave}
      onToggleCommander={onToggleCommander}
      onAddToDeck={onAddToDeck}
      onRemoveFromDeck={onRemoveFromDeck}
      onCardSelect={setSelectedModalCard}
      onUpdateCard={handleUpdateCard}
    />
  );

  if (viewMode === 'grid') {
    if (groups.length === 1 && groups[0].title === '') {
      return (
        <div className="space-y-6">
          {!isTokenZone && commandersHeader}
          <CardGrid
            cards={groups[0].cards}
            size={cardSize}
            onAddToDeck={isRemovable && !isTokenZone ? onAddToDeck : undefined}
            onAddTokenToDeck={onAddTokenToDeck}
            onRemoveFromDeck={isRemovable ? onRemoveFromDeck : undefined}
            showRemoveButton={isRemovable}
            isDeckCard={true}
            deckCards={groups[0].cards}
            onSelectPrint={handleUpdateCard}
            isToken={isTokenZone}
            isEditMode={isRemovable}
            onUpdateCardZone={onUpdateCardZone}
            stackDuplicates={true}
          />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {!isTokenZone && commandersHeader}
        <div className="space-y-6">
          {groups.map((group) => {
            const title = TRANSLATABLE_TITLES.includes(group.title) ? t(`search.${group.title}`) : group.title;
            return (
              <div key={group.title} className="space-y-2">
                <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-1 flex justify-between items-center">
                  <span>{title}</span>
                  <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                    {group.cards.length}
                  </span>
                </h4>
                <CardGrid
                  cards={group.cards}
                  size={cardSize}
                  onAddToDeck={isRemovable && !isTokenZone ? onAddToDeck : undefined}
                  onAddTokenToDeck={onAddTokenToDeck}
                  onRemoveFromDeck={isRemovable ? onRemoveFromDeck : undefined}
                  showRemoveButton={isRemovable}
                  isDeckCard={true}
                  deckCards={groups.flatMap((g) => g.cards)}
                  onSelectPrint={handleUpdateCard}
                  isToken={isTokenZone}
                  isEditMode={isRemovable}
                  onUpdateCardZone={onUpdateCardZone}
                  stackDuplicates={true}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {!isTokenZone && commandersHeader}
      <div className="space-y-6">
        {groups.map((group) => {
          const title = TRANSLATABLE_TITLES.includes(group.title) ? t(`search.${group.title}`) : group.title;

          return (
            <div key={group.title} className="space-y-2">
              {title && (
                <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-1 flex justify-between items-center select-none">
                  <span>{title}</span>
                  <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                    {group.cards.length}
                  </span>
                </h4>
              )}
              <AnimatedDeckCardGroup
                cards={group.cards}
                activeFormat={activeFormat}
                isRemovable={isRemovable}
                isTokenZone={isTokenZone}
                onToggleCommander={onToggleCommander}
                onUpdateCard={handleUpdateCardPrint}
                onAddToDeck={onAddToDeck}
                onRemoveFromDeck={onRemoveFromDeck}
                onSelectCard={handleSelectCardModal}
                onHoverEnter={onHoverEnter}
                onHoverMove={onHoverMove}
                onHoverLeave={onHoverLeave}
              />
            </div>
          );
        })}
      </div>

      {selectedModalCard && (
        <CardDetailModal
          card={selectedModalCard}
          imageUrl={getCardImageUrl(selectedModalCard)}
          onAddToDeck={isRemovable ? onAddToDeck : undefined}
          onAddTokenToDeck={onAddTokenToDeck}
          onClose={() => setSelectedModalCard(null)}
          onSelectPrint={handleUpdateCard}
          isToken={isTokenZone}
          isDeckCard={true}
          deckCards={groups.flatMap((g) => g.cards)}
          onRemoveFromDeck={onRemoveFromDeck}
          isEditMode={isRemovable}
          defaultShowPrints={showPrintsOnOpen}
          deckRelatedTokens={
            isTokenZone
              ? groups.flatMap((g) => g.cards).map((c) => ({ tokenCard: c, generatorCardName: '' }))
              : undefined
          }
        />
      )}
    </div>
  );
});

export default DeckCardList;
