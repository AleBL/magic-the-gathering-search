import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSync, FaRedo } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { useCardPrints } from '../../hooks/useCardPrints';
import { useCardRelatedTokensForCard } from '../../hooks/useCardRelatedTokens';
import { getCardImageUrl } from '../../utils/deckGrouping';
import { DeckRelatedToken } from '../../types/Deck';
import { useDismissTransition } from '../../hooks/useDismissTransition';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { useVisualEffects } from '../../hooks/useVisualEffects';
import { getCardFaceImages } from '../../utils/cardFaces';
import FlipCard from './FlipCard';

interface CardDetailModalProps {
  card: Card;
  imageUrl: string;
  onAddToDeck?: (card: Card) => void;
  onAddTokenToDeck?: (token: Card) => void;
  onClose: () => void;
  onSelectPrint?: (updatedCard: Card) => void;
  isToken?: boolean;
  isDeckCard?: boolean;
  deckCards?: Card[];
  onRemoveFromDeck?: (card: Card) => void;
  isEditMode?: boolean;
  hidePrintsSidebar?: boolean;
  hidePriceAndLegality?: boolean;
  deckRelatedTokens?: DeckRelatedToken[];
  defaultShowPrints?: boolean;
  zIndex?: number;
  /** Shows the own/wishlist collection panel (search results & collection view). */
  showCollectionControls?: boolean;
}

import { CardDetailActions } from './CardDetailActions';
import { CardDetailData } from './CardDetailData';
import { CardDetailEditControls } from './CardDetailEditControls';
import { CardDetailPrintsSidebar } from './CardDetailPrintsSidebar';
import { CardDetailRelatedTokens } from './CardDetailRelatedTokens';
import { CardCollectionControls } from './CardCollectionControls';

/** Scryfall layouts whose faces are printed on one physical side (never flip). */
const SAME_SIDE_LAYOUTS = new Set(['split', 'aftermath', 'flip', 'adventure']);

function CardDetailModal({
  card: initialCard,
  imageUrl,
  onAddToDeck,
  onAddTokenToDeck,
  onClose,
  onSelectPrint,
  isToken = false,
  isDeckCard = false,
  deckCards = [],
  onRemoveFromDeck,
  isEditMode = false,
  hidePrintsSidebar = false,
  hidePriceAndLegality = false,
  deckRelatedTokens = [],
  defaultShowPrints,
  zIndex = 250,
  showCollectionControls = false
}: CardDetailModalProps) {
  const { t } = useTranslation();
  const { motionEnabled } = useVisualEffects();
  const [card, setCard] = useState<Card>(initialCard);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(imageUrl);
  const [isRotated, setIsRotated] = useState(false);
  const { prints, isLoading: isPrintsLoading, error: printsError } = useCardPrints(card, undefined, isToken);
  const [hoveredImageUrl, setHoveredImageUrl] = useState<string | null>(null);
  const [showPrintsSidebar, setShowPrintsSidebar] = useState(
    defaultShowPrints !== undefined ? defaultShowPrints : !isDeckCard && !hidePrintsSidebar
  );

  // Sync card state when the parent hands us a *different* card. Keyed on the id and
  // not on `initialCard` itself on purpose: parents rebuild that object on every
  // render, and depending on it would discard the locally selected printing
  // (`card`) mid-interaction.
  useEffect(() => {
    setCard(initialCard);
    setCurrentImageUrl(imageUrl);
    setIsRotated(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCard.id, imageUrl]);

  const copiesCount = useMemo(() => {
    if (!isDeckCard) return 0;
    return deckCards.filter((c) => c.name === initialCard.name).length;
  }, [deckCards, initialCard.name, isDeckCard]);

  const hasArtChanged = useMemo(() => {
    // Compare the *selected* printing on both sides. Using card.id alone left the
    // button visible after applying (the committed card keeps the original id but
    // carries the new print in selectedPrintId), so it looked like a second click
    // was needed.
    const currentPrintId = card.selectedPrintId || card.id;
    const appliedPrintId = initialCard.selectedPrintId || initialCard.id;
    return currentPrintId !== appliedPrintId;
  }, [card.selectedPrintId, card.id, initialCard.id, initialCard.selectedPrintId]);

  // Token lightbox
  const [selectedToken, setSelectedToken] = useState<Card | null>(null);

  const { tokens: relatedTokens } = useCardRelatedTokensForCard(isToken ? null : card);

  const hasMultipleFaces = !!card.card_faces && card.card_faces.length > 1;
  // Layouts whose faces share a single physical image — they must never flip,
  // regardless of whether a given printing happens to ship per-face images.
  // Driven by `layout` (not image presence) so switching art can't misclassify
  // a split card as double-faced.
  const isSameSideLayout = !!card.layout && SAME_SIDE_LAYOUTS.has(card.layout);
  const faceImages = useMemo(() => (isSameSideLayout ? null : getCardFaceImages(card)), [card, isSameSideLayout]);
  const [showBackFace, setShowBackFace] = useState(false);
  // Split / aftermath / flip cards have several faces but a single physical
  // image — they must not flip, and their text lives only in the faces.
  const isSameSideMultiFace = hasMultipleFaces && (isSameSideLayout || !faceImages);
  const canRotate = isSameSideMultiFace && (card.layout === 'split' || card.layout === 'aftermath');

  // Holographic foil sheen that tracks the cursor on rare & mythic cards.
  // CSS custom props are written straight to the DOM node so the pointer move
  // never triggers a React re-render of the modal.
  const foilRef = useRef<HTMLDivElement>(null);
  const isFoil = ['rare', 'mythic'].includes((card.rarity || '').toLowerCase());
  const foilEnabled = isFoil && motionEnabled;

  const handleFoilMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = foilRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--holo-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--holo-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    el.style.setProperty('--holo-opacity', '0.5');
  };

  const handleFoilLeave = () => {
    foilRef.current?.style.setProperty('--holo-opacity', '0');
  };

  // Only genuine double-faced cards adopt a single face; split cards show all.
  const currentFace = faceImages && hasMultipleFaces ? card.card_faces?.[showBackFace ? 1 : 0] : null;

  const recursiveCard = useMemo(() => {
    if (!selectedToken) return null;
    const matchingDeckToken = deckRelatedTokens?.find((t) => t.tokenCard.name === selectedToken.name);
    if (matchingDeckToken) {
      return {
        ...selectedToken,
        id: matchingDeckToken.tokenCard.id
      };
    }
    return selectedToken;
  }, [selectedToken, deckRelatedTokens]);

  const isRecursiveDeckCard = useMemo(() => {
    if (!selectedToken) return false;
    return !!deckRelatedTokens?.some((t) => t.tokenCard.name === selectedToken.name);
  }, [selectedToken, deckRelatedTokens]);

  const displayImageUrl = useMemo(() => {
    if (hoveredImageUrl) return hoveredImageUrl;
    if (hasMultipleFaces) {
      const face = card.card_faces?.[showBackFace ? 1 : 0];
      return face?.image_uris?.normal || face?.image_uris?.large || currentImageUrl;
    }
    return currentImageUrl;
  }, [card, showBackFace, hasMultipleFaces, currentImageUrl, hoveredImageUrl]);

  const [visibleImageUrl, setVisibleImageUrl] = useState<string>(displayImageUrl);
  const [isPreloading, setIsPreloading] = useState(false);

  useEffect(() => {
    if (visibleImageUrl === displayImageUrl) {
      setIsPreloading(false);
      return;
    }

    setIsPreloading(true);
    let isMounted = true;
    const img = new Image();

    const show = () => {
      if (!isMounted) return;
      setVisibleImageUrl(displayImageUrl);
      setIsPreloading(false);
    };

    // Handlers before `src`: a cached image can finish loading during the assignment, and a
    // handler attached afterwards never runs, leaving the previous art on screen.
    img.onload = show;
    img.onerror = show;
    img.src = displayImageUrl;
    if (img.complete) show();

    return () => {
      isMounted = false;
    };
  }, [displayImageUrl, visibleImageUrl]);

  const handleSelectPrint = (printCard: Card) => {
    const imgUrl = getCardImageUrl(printCard);
    const updatedCard: Card = {
      ...printCard,
      // `layout` is intrinsic to the card, not the printing — keep the current
      // one if a print omits it, so split cards stay split after an art swap.
      layout: printCard.layout ?? card.layout,
      selectedPrintId: printCard.id,
      selectedPrintImageUri: imgUrl
    };
    setCard(updatedCard);
    setCurrentImageUrl(imgUrl);
  };

  const handleConfirmArtChange = () => {
    // The entry becomes the printing that was chosen: `id` is the new print, while
    // `instanceId` (carried over from initialCard) keeps this one copy addressable. Holding
    // the old id here is what used to make every copy change art together.
    const confirmedCard: Card = {
      ...initialCard,
      id: card.id,
      image_uris: card.image_uris, // new print art
      card_faces: card.card_faces, // new print faces if any
      set: card.set,
      set_name: card.set_name,
      collector_number: card.collector_number,
      // Carry the printing's language so the deck shows the chosen localized
      // name/type/text (not just the new art).
      printed_name: card.printed_name,
      printed_type_line: card.printed_type_line,
      printed_text: card.printed_text,
      lang: card.lang,
      selectedPrintId: card.id, // the new print id
      selectedPrintImageUri: currentImageUrl // the resolved image URL
    };
    onSelectPrint?.(confirmedCard);
  };

  const handleIncrementCopies = () => {
    onAddToDeck?.(initialCard);
  };

  const handleDecrementCopies = () => {
    onRemoveFromDeck?.(initialCard);
  };

  const { isClosing, requestClose } = useDismissTransition(onClose);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(requestClose);
  const { onTouchStart, onTouchMove, onTouchEnd, panelStyle } = useSwipeToClose<HTMLDivElement>(requestClose);

  return createPortal(
    <>
      {/* Main modal */}
      {/* Backdrop click is a mouse-only convenience; Escape and the close button provide the keyboard-equivalent action. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className={`modal-overlay modal-overlay-sheet z-[var(--z-overlay)] ${isClosing ? 'motion-overlay-closing' : ''}`}
        style={{ zIndex }}
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
      >
        <div
          ref={dialogRef}
          className={`modal-container modal-container-large modal-sheet-panel relative flex flex-col overflow-hidden ${isClosing ? 'motion-dialog-closing' : 'animate-dialogEnter'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-card-title"
          style={panelStyle}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Grab handle: purely a visual affordance now — drag-to-close works
              from anywhere on the sheet (see useSwipeToClose), not just here. */}
          <div className="sm:hidden -mt-6 -mx-6 flex justify-center pt-2.5 pb-1" aria-hidden="true">
            <div className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-slate-700" />
          </div>
          {/* Desktop only: the phone sheet has a drag handle and closes on a tap outside. */}
          <button
            type="button"
            onClick={requestClose}
            className="absolute top-3 right-3 z-10 hidden sm:block text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60"
            aria-label={t('common.close')}
          >
            <FaTimes className="text-base" />
          </button>
          {/* One scroller on phones, two lanes from md up: reading a long rules text used to
              scroll the card art and the edition list along with it. Each side gets its own
              scroller so the image stays put while the text moves. */}
          <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-y-auto md:overflow-hidden custom-scrollbar pr-2 pb-2">
            {/* ── Left: edition sidebar + card image ── */}
            <div className="flex flex-col md:flex-row gap-4 items-center md:items-start shrink-0 animate-fadeIn md:min-h-0 md:overflow-y-auto md:overscroll-contain custom-scrollbar md:pr-1">
              {showPrintsSidebar && !hidePrintsSidebar && (
                <CardDetailPrintsSidebar
                  isLoading={isPrintsLoading}
                  prints={prints}
                  currentCard={card}
                  onHoverImageUrl={setHoveredImageUrl}
                  onSelectPrint={handleSelectPrint}
                  getCardFaceImageUrl={getCardImageUrl}
                />
              )}

              {/* Card image */}
              <div className="card-detail-image-wrapper flex flex-col items-center gap-3 shrink-0 relative group/image">
                <div
                  ref={foilRef}
                  className="relative rounded-[4.5%]"
                  onMouseMove={foilEnabled ? handleFoilMove : undefined}
                  onMouseLeave={foilEnabled ? handleFoilLeave : undefined}
                >
                  {faceImages && !hoveredImageUrl ? (
                    <FlipCard
                      frontSrc={faceImages.front}
                      backSrc={faceImages.back}
                      isFlipped={showBackFace}
                      alt={currentFace ? currentFace.name : card.name}
                      animated={motionEnabled}
                      imgClassName="card-detail-image"
                      loading="eager"
                    />
                  ) : (
                    <img
                      src={visibleImageUrl}
                      alt={currentFace ? currentFace.name : card.name}
                      style={isRotated ? { transform: 'rotate(90deg)' } : undefined}
                      className={`card-detail-image transition-all duration-300 ${
                        isPreloading ? 'opacity-70 scale-[0.98] brightness-90' : 'opacity-100 scale-100'
                      }`}
                    />
                  )}
                  {foilEnabled && <div className="holo-foil" aria-hidden="true" />}
                </div>
                {faceImages && hasMultipleFaces && (
                  <button
                    type="button"
                    onClick={() => setShowBackFace((prev) => !prev)}
                    className="absolute top-4 left-4 z-20 p-3 rounded-full
                      bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20
                      text-white shadow-xl
                      transition-all duration-300 transform hover:scale-110 active:scale-95
                      flex items-center justify-center opacity-80 hover:opacity-100"
                    title={t('cardDetails.flipAction')}
                  >
                    <FaSync
                      className={`text-xl transition-transform duration-500 ${showBackFace ? '-rotate-180' : 'rotate-0'}`}
                    />
                  </button>
                )}
                {canRotate && (
                  <button
                    type="button"
                    onClick={() => setIsRotated((prev) => !prev)}
                    className="absolute top-4 left-4 z-20 p-3 rounded-full
                      bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20
                      text-white shadow-xl
                      transition-all duration-300 transform hover:scale-110 active:scale-95
                      flex items-center justify-center opacity-80 hover:opacity-100"
                    title={t('cardDetails.rotateAction')}
                    aria-pressed={isRotated}
                  >
                    <FaRedo className="text-xl" />
                  </button>
                )}

                {/* Ownership actions sit under the art rather than in the text column: on wide
                    screens that space was empty, and the controls belong next to the card they
                    act on. On phones the columns stack, so they land between art and text —
                    still directly below the card. */}
                {showCollectionControls && !isToken ? (
                  <div className="w-full max-w-[300px]">
                    <CardCollectionControls card={card} variant="panel" />
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Right: card info ── */}
            <div className="card-detail-info md:min-h-0 md:overflow-y-auto md:overscroll-contain custom-scrollbar md:pr-1">
              <CardDetailData
                card={card}
                currentFace={currentFace}
                hidePriceAndLegality={hidePriceAndLegality}
                isToken={isToken}
                allFaces={isSameSideMultiFace ? card.card_faces : null}
              />

              {/* Related tokens section */}
              <CardDetailRelatedTokens relatedTokens={relatedTokens} onCardClick={setSelectedToken} />

              {/* Edit and Copy controls for Deck Cards */}
              <div className="w-full mt-auto">
                <CardDetailEditControls
                  isDeckCard={isDeckCard}
                  isEditMode={isEditMode}
                  isToken={isToken}
                  hidePrintsSidebar={hidePrintsSidebar}
                  copiesCount={copiesCount}
                  hasArtChanged={hasArtChanged}
                  prints={prints}
                  printsError={printsError}
                  showPrintsSidebar={showPrintsSidebar}
                  setShowPrintsSidebar={setShowPrintsSidebar}
                  handleDecrementCopies={handleDecrementCopies}
                  handleIncrementCopies={handleIncrementCopies}
                  handleConfirmArtChange={handleConfirmArtChange}
                />

                {/* Action buttons (e.g., Add to Deck) */}
                <CardDetailActions
                  card={card}
                  isDeckCard={isDeckCard}
                  isToken={isToken}
                  onAddCardToDeck={
                    (isToken && onAddTokenToDeck) || onAddToDeck
                      ? () => {
                          if (isToken && onAddTokenToDeck) {
                            onAddTokenToDeck(card);
                          } else if (onAddToDeck) {
                            onAddToDeck(card);
                          }
                          requestClose();
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token details modal */}
      {selectedToken && (
        <CardDetailModal
          card={recursiveCard || selectedToken}
          imageUrl={getCardImageUrl(selectedToken)}
          onAddToDeck={isToken ? onAddTokenToDeck || onAddToDeck : onAddToDeck}
          onAddTokenToDeck={onAddTokenToDeck}
          onClose={() => setSelectedToken(null)}
          isToken={true}
          isDeckCard={isRecursiveDeckCard}
          hidePrintsSidebar={true}
          hidePriceAndLegality={hidePriceAndLegality}
          deckRelatedTokens={deckRelatedTokens}
          onRemoveFromDeck={onRemoveFromDeck}
          isEditMode={isEditMode}
          deckCards={isToken ? deckRelatedTokens?.map((t) => t.tokenCard) || [] : deckCards}
          zIndex={zIndex + 10}
        />
      )}
    </>,
    document.body
  );
}

export default CardDetailModal;
