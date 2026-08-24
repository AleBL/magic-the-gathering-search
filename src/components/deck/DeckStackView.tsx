import { useMemo, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFistRaised, FaMagic, FaBolt, FaTint, FaPalette } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { CardSize } from '../../types';
import { DeckZone } from '../../types/enums';
import { DeckFormat } from '../../types/Deck';
import { DeckCardGrouped, GroupedCards, groupCardsByUnique, getCardImageUrl } from '../../utils/deckGrouping';
import { isBacklineSupportCard, isFrontlineCard, isLandCard, isSpellCard } from '../../utils/cardTypePredicates';
import CardDetailModal from '../card/CardDetailModal';
import { DeckStackPlaymatCard } from './DeckStackPlaymatCard';

interface DeckStackViewProps {
  groups: GroupedCards[];
  cardSize: CardSize;
  isRemovable: boolean;
  onHoverEnter: (card: Card, e: React.MouseEvent) => void;
  onHoverMove: (e: React.MouseEvent) => void;
  onHoverLeave: () => void;
  onRemoveFromDeck: (card: Card) => void;
  onAddToDeck: (card: Card) => void;
  onAddTokenToDeck?: (token: Card) => void;
  activeFormat?: DeckFormat;
  onUpdateCard?: (updatedCard: Card) => void;
  isTokenZone?: boolean;
  onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
}

interface PlaymatSection {
  sectionId: 'frontline' | 'backline' | 'spells' | 'lands';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  cards: Card[];
  groupedCards: DeckCardGrouped[];
  accentClassName: string;
}

const CARD_DIMENSIONS_BY_SIZE: Record<CardSize, { width: string; height: string }> = {
  small: { width: '140px', height: '196px' },
  medium: { width: '180px', height: '251px' },
  large: { width: '220px', height: '307px' },
  xlarge: { width: '260px', height: '363px' }
};

const DeckStackView = memo(function DeckStackView({
  groups,
  cardSize,
  isRemovable,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onRemoveFromDeck,
  onAddToDeck,
  onAddTokenToDeck,
  activeFormat,
  onUpdateCard,
  isTokenZone = false,
  onUpdateCardZone
}: DeckStackViewProps) {
  const { t } = useTranslation();
  const [selectedModalCard, setSelectedModalCard] = useState<Card | null>(null);

  const allCardsInDeck = useMemo(() => groups.flatMap((groupedCards) => groupedCards.cards), [groups]);
  const cardDimensions = CARD_DIMENSIONS_BY_SIZE[cardSize];

  const handleUpdateCard = (updatedCard: Card) => {
    setSelectedModalCard(updatedCard);
    onUpdateCard?.(updatedCard);
  };

  const frontlineCards = useMemo(() => allCardsInDeck.filter(isFrontlineCard), [allCardsInDeck]);
  const backlineCards = useMemo(() => allCardsInDeck.filter(isBacklineSupportCard), [allCardsInDeck]);
  const spellCards = useMemo(() => allCardsInDeck.filter(isSpellCard), [allCardsInDeck]);
  const landCards = useMemo(() => allCardsInDeck.filter(isLandCard), [allCardsInDeck]);

  const playmatSections: PlaymatSection[] = useMemo(
    () => [
      {
        sectionId: 'frontline',
        icon: FaFistRaised,
        title: t('strategy.frontline'),
        subtitle: `${t('search.creature')} & ${t('search.planeswalker')}`,
        cards: frontlineCards,
        groupedCards: groupCardsByUnique(frontlineCards),
        accentClassName: 'deck-stack-zone-frontline'
      },
      {
        sectionId: 'backline',
        icon: FaMagic,
        title: t('strategy.backline'),
        subtitle: `${t('search.artifact')} & ${t('search.enchantment')}`,
        cards: backlineCards,
        groupedCards: groupCardsByUnique(backlineCards),
        accentClassName: 'deck-stack-zone-backline'
      },
      {
        sectionId: 'spells',
        icon: FaBolt,
        title: t('common.spells'),
        subtitle: `${t('search.instant')} & ${t('search.sorcery')}`,
        cards: spellCards,
        groupedCards: groupCardsByUnique(spellCards),
        accentClassName: 'deck-stack-zone-spells'
      },
      {
        sectionId: 'lands',
        icon: FaTint,
        title: t('strategy.resourceLands'),
        subtitle: t('search.land'),
        cards: landCards,
        groupedCards: groupCardsByUnique(landCards),
        accentClassName: 'deck-stack-zone-lands'
      }
    ],
    [t, frontlineCards, backlineCards, spellCards, landCards]
  );

  const renderPlaymatCard = (item: { name: string; count: number; card: Card }) => (
    <DeckStackPlaymatCard
      key={item.card.id}
      item={item}
      cardDimensions={cardDimensions}
      isRemovable={isRemovable}
      activeFormat={activeFormat}
      onSelectCard={setSelectedModalCard}
      onHoverEnter={onHoverEnter}
      onHoverMove={onHoverMove}
      onHoverLeave={onHoverLeave}
      onAddToDeck={onAddToDeck}
      onRemoveFromDeck={onRemoveFromDeck}
      onUpdateCardZone={onUpdateCardZone}
    />
  );

  if (isTokenZone) {
    return (
      <div className="deck-stack-container">
        <section className="space-y-3">
          <h4 className="deck-stack-zone-title deck-stack-zone-frontline animate-fadeIn">
            <FaPalette className="shrink-0 text-xs text-indigo-400 animate-pulse" />
            <span>{t('tokens.relatedTokens')}</span>
            <span className="deck-stack-zone-count">{allCardsInDeck.length}</span>
          </h4>

          {allCardsInDeck.length === 0 ? (
            <p className="deck-stack-empty-zone">{t('strategy.emptyZone')}</p>
          ) : (
            <div className="deck-stack-cards-row">
              {groupCardsByUnique(allCardsInDeck).map((groupedCard) => renderPlaymatCard(groupedCard))}
            </div>
          )}
        </section>

        {selectedModalCard ? (
          <CardDetailModal
            card={selectedModalCard}
            imageUrl={getCardImageUrl(selectedModalCard)}
            onAddToDeck={isRemovable ? onAddToDeck : undefined}
            onAddTokenToDeck={onAddTokenToDeck}
            onClose={() => setSelectedModalCard(null)}
            onSelectPrint={handleUpdateCard}
            isToken={true}
            isDeckCard={true}
            deckCards={allCardsInDeck}
            onRemoveFromDeck={onRemoveFromDeck}
            isEditMode={isRemovable}
            deckRelatedTokens={allCardsInDeck.map((c) => ({
              tokenCard: c,
              generatorCardName: ''
            }))}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="deck-stack-container">
      {playmatSections.map((section) => {
        const SectionIcon = section.icon;

        return (
          <section key={section.sectionId} className="space-y-3">
            <h4 className={`deck-stack-zone-title ${section.accentClassName}`}>
              <SectionIcon className="shrink-0 text-xs" />
              <span>
                {section.title} ({section.subtitle})
              </span>
              <span className="deck-stack-zone-count">{section.cards.length}</span>
            </h4>

            {section.groupedCards.length === 0 ? (
              <p className="deck-stack-empty-zone">{t('strategy.emptyZone')}</p>
            ) : (
              <div className="deck-stack-cards-row">
                {section.groupedCards.map((groupedCard) => renderPlaymatCard(groupedCard))}
              </div>
            )}
          </section>
        );
      })}

      {selectedModalCard ? (
        <CardDetailModal
          card={selectedModalCard}
          imageUrl={getCardImageUrl(selectedModalCard)}
          onAddToDeck={isRemovable ? onAddToDeck : undefined}
          onAddTokenToDeck={onAddTokenToDeck}
          onClose={() => setSelectedModalCard(null)}
          onSelectPrint={handleUpdateCard}
          isToken={isTokenZone}
          isDeckCard={true}
          deckCards={allCardsInDeck}
          onRemoveFromDeck={onRemoveFromDeck}
          isEditMode={isRemovable}
        />
      ) : null}
    </div>
  );
});

export default DeckStackView;
