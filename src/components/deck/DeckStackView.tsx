import { CSSProperties, useMemo, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaFistRaised,
  FaMagic,
  FaBolt,
  FaTint,
  FaBan,
  FaExclamationTriangle,
  FaPalette,
  FaPlus,
  FaMinus,
  FaTimesCircle
} from 'react-icons/fa';
import { Card } from '../../types/Card';
import { CardSize } from '../../types';
import { DeckZone } from '../../types/enums';
import { DeckFormat } from '../../types/Deck';
import { DeckCardGrouped, GroupedCards, groupCardsByUnique, getCardImageUrl } from '../../utils/deckGrouping';
import { isBacklineSupportCard, isFrontlineCard, isLandCard, isSpellCard } from '../../utils/cardTypePredicates';
import CardDetailModal from '../card/CardDetailModal';
import { cardFormatStatus } from '../../utils/deckValidator';

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

  function getCardLegalityStatus(card: Card): { isBanned: boolean; isRestricted: boolean; isInvalid: boolean } {
    const status = cardFormatStatus(card, activeFormat);
    return {
      isBanned: status === 'banned',
      isRestricted: status === 'restricted',
      isInvalid: status === 'invalid'
    };
  }

  const renderPlaymatCard = (item: { name: string; count: number; card: Card }) => {
    const { count, card } = item;
    const imageUrl = getCardImageUrl(card);
    const { isBanned, isRestricted, isInvalid } = getCardLegalityStatus(card);
    const dynamicCardStyle = {
      '--stack-card-width': cardDimensions.width,
      '--stack-card-height': cardDimensions.height
    } as CSSProperties;

    return (
      <div
        key={card.id}
        className="deck-stack-card-wrapper group"
        data-stack-depth={count > 2 ? '3' : count > 1 ? '2' : '1'}
        style={dynamicCardStyle}
      >
        {count > 1 ? (
          <div
            className={`deck-stack-shadow deck-stack-shadow-level-one ${
              isBanned
                ? 'bg-red-950/60 border border-red-900/60'
                : isRestricted
                  ? 'bg-amber-100/60 dark:bg-amber-950/60 border border-amber-300/60 dark:border-amber-900/60'
                  : 'bg-gray-300 dark:bg-slate-950 border border-gray-400/80 dark:border-slate-800/80'
            }`}
          />
        ) : null}

        {count > 2 ? (
          <div
            className={`deck-stack-shadow deck-stack-shadow-level-two ${
              isBanned
                ? 'bg-red-950/40 border border-red-900/40'
                : isRestricted
                  ? 'bg-amber-100/40 dark:bg-amber-950/40 border border-amber-300/40 dark:border-amber-900/40'
                  : 'bg-gray-200 dark:bg-slate-950 border border-gray-300/80 dark:border-slate-800/80'
            }`}
          />
        ) : null}

        <div
          role="button"
          tabIndex={0}
          aria-label={card.printed_name || card.name}
          className={`deck-stack-main-card ${
            isBanned
              ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
              : isRestricted
                ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                : 'border-gray-300 dark:border-slate-800/50 hover:border-blue-500/80'
          }`}
          data-has-stack={count > 1 ? 'true' : 'false'}
          onClick={() => setSelectedModalCard(card)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedModalCard(card);
            }
          }}
          onMouseEnter={(e) => onHoverEnter(card, e)}
          onMouseMove={onHoverMove}
          onMouseLeave={onHoverLeave}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={card.name}
              className={`w-full h-full object-cover pointer-events-none select-none transition-all duration-300 ${
                isBanned ? 'opacity-50 grayscale-[40%] brightness-[75%]' : ''
              }`}
            />
          ) : (
            <div
              className={`p-2.5 text-left h-full flex flex-col justify-between ${isBanned ? 'bg-red-100 dark:bg-red-950/20' : 'bg-gray-100 dark:bg-slate-850'}`}
            >
              <span
                className={`text-[10px] font-extrabold block leading-tight truncate-2-lines ${isBanned ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
              >
                {card.printed_name || card.name}
              </span>
              <span className="text-[9px] text-yellow-500 font-mono font-bold">{card.mana_cost}</span>
            </div>
          )}

          {count > 1 ? <span className="deck-stack-count-badge">{count}x</span> : null}

          {isBanned ? (
            <div className="deck-stack-status-badge deck-stack-status-badge-banned animate-pulse">
              <FaBan className="text-white text-[8px] shrink-0" />
              <span>{t('cardDetails.banned').toUpperCase()}</span>
            </div>
          ) : null}

          {isRestricted ? (
            <div className="deck-stack-status-badge deck-stack-status-badge-restricted">
              <FaExclamationTriangle className="text-white text-[8px] shrink-0" />
              <span>{t('cardDetails.restricted').toUpperCase()}</span>
            </div>
          ) : null}

          {isInvalid ? (
            <div
              className="deck-stack-status-badge bg-violet-600/90 border border-violet-500"
              title={t('cardDetails.invalidInFormatHint')}
            >
              <FaTimesCircle className="text-white text-[8px] shrink-0" />
              <span>{t('cardDetails.invalidInFormat').toUpperCase()}</span>
            </div>
          ) : null}

          {isRemovable ? (
            <div className="absolute top-1.5 right-1.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 items-end">
              <div className="flex gap-1.5 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToDeck(card);
                  }}
                  className="w-6 h-6 rounded-full bg-success/90 text-white flex items-center justify-center text-xs font-extrabold hover:bg-green-500 hover:scale-110 transition-all pointer-events-auto"
                  title={t('cardDetails.addCopy')}
                >
                  <FaPlus className="text-[10px]" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromDeck(card);
                  }}
                  className="w-6 h-6 rounded-full bg-danger/90 text-white flex items-center justify-center text-xs font-extrabold hover:bg-red-500 hover:scale-110 transition-all pointer-events-auto"
                  title={t('cardDetails.removeCopy')}
                >
                  <FaMinus className="text-[10px]" />
                </button>
              </div>

              {onUpdateCardZone && card.zone ? (
                <div className="flex gap-1 bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg pointer-events-auto mt-1 flex-col items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateCardZone(card.id, DeckZone.MAIN);
                    }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                      card.zone === DeckZone.MAIN
                        ? 'bg-primary text-white ring-1 ring-white/50'
                        : 'bg-slate-700/80 text-gray-300 hover:bg-blue-500 hover:text-white'
                    }`}
                    title={t('deck.printFilters.main')}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateCardZone(card.id, DeckZone.SIDEBOARD);
                    }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                      card.zone === DeckZone.SIDEBOARD
                        ? 'bg-purple-600 text-white ring-1 ring-white/50'
                        : 'bg-slate-700/80 text-gray-300 hover:bg-purple-500 hover:text-white'
                    }`}
                    title={t('deck.printFilters.sideboard')}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateCardZone(card.id, DeckZone.MAYBEBOARD);
                    }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                      card.zone === DeckZone.MAYBEBOARD
                        ? 'bg-warning text-white ring-1 ring-white/50'
                        : 'bg-slate-700/80 text-gray-300 hover:bg-amber-500 hover:text-white'
                    }`}
                    title={t('deck.printFilters.maybeboard')}
                  >
                    ?
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

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
