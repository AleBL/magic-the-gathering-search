import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSync } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { CardSize } from '../../types';
import { DeckFormat } from '../../types/Deck';
import { DeckZone } from '../../types/enums';
import CardDetailModal from './CardDetailModal';
import FlipCard from './FlipCard';
import { CardCollectionControls } from './CardCollectionControls';
import { CardItemStatusBadges } from './CardItemStatusBadges';
import { CardItemHoverControls } from './CardItemHoverControls';
import { getCardFaceImages } from '../../utils/cardFaces';
import { useVisualEffects } from '../../hooks/useVisualEffects';
import { cardFormatStatus } from '../../utils/deckValidator';
import { getGlowColor, getCardItemImageUrl } from './cardItemImage';

interface CardItemProps {
  card: Card;
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
  onUpdateCardZone?: (cardId: string, zone: DeckZone) => void;
  isEditMode?: boolean;
  /** Shows the own/wishlist overlay controls (search results & collection view). */
  showCollectionControls?: boolean;
  /** Set code, plus language when not English — two printings differ only by art otherwise. */
  showPrintingBadge?: boolean;
  /** Lets a (non-deck) search result be dragged into the deck editor. Emits the
   *  full card as JSON under a custom MIME so it never collides with the
   *  zone-move drag (which carries only the deck card id via `text/plain`). */
  isAddDraggable?: boolean;
}

/** Custom drag MIME for adding a searched card to the deck by drag-and-drop. */
export const ADD_CARD_DRAG_TYPE = 'application/x-mtg-add-card';

function CardItem({
  card,
  size,
  onAddToDeck,
  onAddTokenToDeck,
  onRemoveFromDeck,
  showRemoveButton = false,
  activeFormat,
  isDeckCard = false,
  deckCards = [],
  onSelectPrint,
  isToken = false,
  isEditMode = false,
  onUpdateCardZone,
  showCollectionControls = false,
  showPrintingBadge = false,
  isAddDraggable = false
}: CardItemProps) {
  const { t } = useTranslation();
  const { motionEnabled } = useVisualEffects();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const faceImages = useMemo(() => getCardFaceImages(card), [card]);
  const canFlip = faceImages !== null;

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateY = (x / rect.width - 0.5) * 18;
    const rotateX = (y / rect.height - 0.5) * -18;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setRotate({ x: rotateX, y: rotateY });
    setGlare({ x: glareX, y: glareY, opacity: 0.15 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  const imageUrl = useMemo(() => getCardItemImageUrl(card, size), [card, size]);

  // Shared with the deck list and the stack view: a rule that invalidates a deck has to mark
  // the card everywhere the card is drawn, not in whichever surface remembered to check.
  const formatStatus = useMemo(() => cardFormatStatus(card, activeFormat), [card, activeFormat]);
  const isBanned = formatStatus === 'banned';
  const isRestricted = formatStatus === 'restricted';
  const isInvalid = formatStatus === 'invalid';

  const isDraggable = isDeckCard && isEditMode && !isToken;
  // A search result can be dragged to add it, but only when it isn't already a
  // draggable deck card (whose drag means "move between zones").
  const canAddDrag = isAddDraggable && !isDraggable;

  const imageClassName = `card-image-content transition-all duration-300 ${
    isToken && card.isActive === false
      ? 'opacity-40 grayscale-[40%] brightness-[75%] shadow-[0_0_10px_rgba(30,41,59,0.3)] rounded-[4.5%]'
      : isBanned
        ? 'opacity-50 grayscale-[40%] brightness-[75%] border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] rounded-[4.5%]'
        : isRestricted
          ? 'border-2 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] rounded-[4.5%]'
          : 'rounded-[4.5%]'
  }`;

  const imageStyle = {
    boxShadow:
      glare.opacity > 0
        ? `0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 0 20px 2px ${getGlowColor(card.rarity)}`
        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  };

  return (
    <div
      className={`card-item-wrapper group relative ${isBanned ? 'border-red-500/50' : ''} ${isToken && card.isActive === false ? 'opacity-75' : ''} ${isDraggable || canAddDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={isDraggable || canAddDrag}
      onDragStart={
        isDraggable
          ? (e) => {
              e.dataTransfer.setData('text/plain', card.id);
              e.dataTransfer.effectAllowed = 'move';
              (e.currentTarget as HTMLElement).style.opacity = '0.5';
            }
          : canAddDrag
            ? (e) => {
                e.dataTransfer.setData(ADD_CARD_DRAG_TYPE, JSON.stringify(card));
                e.dataTransfer.effectAllowed = 'copy';
                (e.currentTarget as HTMLElement).style.opacity = '0.5';
              }
            : undefined
      }
      onDragEnd={
        isDraggable || canAddDrag
          ? (e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }
          : undefined
      }
    >
      <CardItemStatusBadges
        isCommander={Boolean(card.isCommander)}
        isBanned={isBanned}
        isRestricted={isRestricted}
        isInvalid={isInvalid}
        isInactiveToken={isToken && card.isActive === false}
      />

      <button
        type="button"
        onClick={() => setIsDetailOpen(true)}
        className={`card-image-button animate-fadeIn relative group-hover:z-20`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(800px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) ${glare.opacity > 0 ? 'scale3d(1.04, 1.04, 1.04)' : 'scale3d(1, 1, 1)'}`,
          transition: glare.opacity === 0 ? 'transform 0.4s ease-out' : 'transform 0.1s ease-out',
          transformStyle: 'preserve-3d'
        }}
        aria-label={card.name}
      >
        {canFlip && faceImages ? (
          <FlipCard
            frontSrc={faceImages.front}
            backSrc={faceImages.back}
            isFlipped={isFlipped}
            alt={card.name}
            animated={motionEnabled}
            imgClassName={imageClassName}
            imgStyle={imageStyle}
          />
        ) : (
          <img src={imageUrl} alt={card.name} className={imageClassName} style={imageStyle} loading="lazy" />
        )}
        {/* 3D Glare Overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-lg mix-blend-overlay transition-opacity duration-300 z-10"
          style={{
            opacity: glare.opacity,
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%)`
          }}
        />
      </button>

      {/* Flip button for double-faced cards */}
      {canFlip && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsFlipped((prev) => !prev);
          }}
          className={`flip-toggle-btn absolute bottom-2 left-2 z-30 w-9 h-9 sm:w-7 sm:h-7 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 ${isFlipped ? 'is-flipped' : ''}`}
          title={t('cardDetails.flipAction')}
          aria-label={t('cardDetails.flipAction')}
          aria-pressed={isFlipped}
        >
          <FaSync className="text-xs" />
        </button>
      )}

      {showCollectionControls && !isToken && (
        <CardCollectionControls card={card} variant="overlay" revealOnHover={size === 'small' || size === 'medium'} />
      )}

      {showPrintingBadge && card.set ? (
        <span className="absolute bottom-2 right-2 z-30 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {card.set}
          {card.lang && card.lang !== 'en' ? ` · ${card.lang}` : ''}
        </span>
      ) : null}

      <CardItemHoverControls
        card={card}
        showRemoveButton={showRemoveButton}
        onAddToDeck={onAddToDeck}
        onRemoveFromDeck={onRemoveFromDeck}
        onUpdateCardZone={onUpdateCardZone}
      />

      {isDetailOpen && (
        <CardDetailModal
          card={card}
          imageUrl={imageUrl}
          onAddToDeck={onAddToDeck}
          onAddTokenToDeck={onAddTokenToDeck}
          onClose={() => setIsDetailOpen(false)}
          onSelectPrint={onSelectPrint}
          isToken={isToken}
          isDeckCard={isDeckCard}
          deckCards={deckCards}
          onRemoveFromDeck={onRemoveFromDeck}
          isEditMode={isEditMode}
          showCollectionControls={showCollectionControls}
          deckRelatedTokens={isToken ? deckCards.map((c) => ({ tokenCard: c, generatorCardName: '' })) : undefined}
        />
      )}
    </div>
  );
}

export default memo(CardItem);
