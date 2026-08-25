import { Card } from '../../types/Card';
import { DeckFormat, DeckRelatedToken } from '../../types/Deck';
import { CardSize } from '../../types';
import { DeckZone } from '../../types/enums';
import { GroupedCards } from '../../utils/deckGrouping';
import { ViewMode } from '../../hooks/useDeckPreviewState';
import DeckZoneTabs from './DeckZoneTabs';
import DeckTokensTab from './DeckTokensTab';
import DeckStackView from './DeckStackView';
import DeckCardList from './DeckCardList';

interface DeckPreviewZoneCardsProps {
  readonly zoneCounts: { main: number; sideboard: number; maybeboard: number; tokens: number };
  readonly activeZone: DeckZone;
  readonly onZoneChange: (zone: DeckZone) => void;
  readonly onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
  readonly activeCards: Card[];
  readonly deckRelatedTokens?: DeckRelatedToken[];
  readonly selectedDeckRelatedTokens?: DeckRelatedToken[];
  readonly onTokensLoaded: (tokens: DeckRelatedToken[]) => void;
  readonly onTokenClick: (card: Card | null) => void;
  readonly isRemovable: boolean;
  readonly viewMode: ViewMode;
  readonly groupedCards: GroupedCards[];
  readonly cardSize: CardSize;
  readonly deckFormat?: DeckFormat;
  readonly commanders: Card[];
  readonly onHoverEnter: (card: Card, e: React.MouseEvent) => void;
  readonly onHoverMove: (e: React.MouseEvent) => void;
  readonly onHoverLeave: () => void;
  readonly onRemoveFromDeckTokenAware: (card: Card) => void;
  readonly onAddToDeckTokenAware: (card: Card) => void;
  readonly onAddTokenToDeck: (card: Card) => void;
  readonly onUpdateCardTokenAware?: (card: Card) => void;
  readonly onToggleCommander: (card: Card) => void;
}

/** Zone tabs plus the active zone's cards, as a stack or a list. */
export function DeckPreviewZoneCards({
  zoneCounts,
  activeZone,
  onZoneChange,
  onUpdateCardZone,
  activeCards,
  deckRelatedTokens,
  selectedDeckRelatedTokens,
  onTokensLoaded,
  onTokenClick,
  isRemovable,
  viewMode,
  groupedCards,
  cardSize,
  deckFormat,
  commanders,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onRemoveFromDeckTokenAware,
  onAddToDeckTokenAware,
  onAddTokenToDeck,
  onUpdateCardTokenAware,
  onToggleCommander
}: DeckPreviewZoneCardsProps) {
  const isTokenZone = activeZone === 'tokens';

  return (
    <>
      <div className="deck-zone-row">
        <DeckZoneTabs
          mainCount={zoneCounts.main}
          sideCount={zoneCounts.sideboard}
          maybeCount={zoneCounts.maybeboard}
          tokensCount={zoneCounts.tokens}
          activeZone={activeZone}
          onZoneChange={onZoneChange}
          onUpdateCardZone={onUpdateCardZone}
        />
      </div>
      {isTokenZone ? (
        <DeckTokensTab
          cards={activeCards}
          cachedTokens={deckRelatedTokens || selectedDeckRelatedTokens}
          onTokensLoaded={onTokensLoaded}
          onTokenClick={onTokenClick}
          onlyHeader={true}
          isEditMode={isRemovable}
        />
      ) : null}
      {viewMode === 'stack' ? (
        <DeckStackView
          groups={groupedCards}
          cardSize={cardSize}
          isRemovable={isRemovable}
          activeFormat={deckFormat}
          onHoverEnter={onHoverEnter}
          onHoverMove={onHoverMove}
          onHoverLeave={onHoverLeave}
          onRemoveFromDeck={onRemoveFromDeckTokenAware}
          onAddToDeck={onAddToDeckTokenAware}
          onAddTokenToDeck={onAddTokenToDeck}
          onUpdateCard={onUpdateCardTokenAware}
          isTokenZone={isTokenZone}
          onUpdateCardZone={onUpdateCardZone}
        />
      ) : (
        <DeckCardList
          groups={groupedCards}
          commanders={commanders}
          cardSize={cardSize}
          viewMode={viewMode}
          isRemovable={isRemovable}
          isTokenZone={isTokenZone}
          activeFormat={deckFormat}
          onUpdateCardZone={onUpdateCardZone}
          onAddToDeck={onAddToDeckTokenAware}
          onAddTokenToDeck={onAddTokenToDeck}
          onRemoveFromDeck={onRemoveFromDeckTokenAware}
          onToggleCommander={onToggleCommander}
          onHoverEnter={onHoverEnter}
          onHoverMove={onHoverMove}
          onHoverLeave={onHoverLeave}
          onUpdateCard={onUpdateCardTokenAware}
        />
      )}
    </>
  );
}
