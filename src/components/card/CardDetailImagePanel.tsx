import { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSync, FaRedo } from 'react-icons/fa';
import { Card, CardFace } from '../../types/Card';
import { getCardImageUrl } from '../../utils/deckGrouping';
import { CardFaceImages } from '../../utils/cardFaces';
import FlipCard from './FlipCard';
import { CardDetailPrintsSidebar } from './CardDetailPrintsSidebar';
import { CardCollectionControls } from './CardCollectionControls';

interface CardDetailImagePanelProps {
  readonly showPrintsSidebar: boolean;
  readonly hidePrintsSidebar: boolean;
  readonly isPrintsLoading: boolean;
  readonly prints: Card[];
  readonly card: Card;
  readonly onHoverImageUrl: (url: string | null) => void;
  readonly onSelectPrint: (printCard: Card) => void;
  readonly foilRef: RefObject<HTMLDivElement | null>;
  readonly foilEnabled: boolean;
  readonly onFoilMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onFoilLeave: () => void;
  readonly faceImages: CardFaceImages | null;
  readonly hoveredImageUrl: string | null;
  readonly currentFace: CardFace | null | undefined;
  readonly motionEnabled: boolean;
  readonly visibleImageUrl: string;
  readonly isPreloading: boolean;
  readonly isRotated: boolean;
  readonly hasMultipleFaces: boolean;
  readonly showBackFace: boolean;
  readonly onToggleBackFace: () => void;
  readonly canRotate: boolean;
  readonly onToggleRotated: () => void;
  readonly showCollectionControls: boolean;
  readonly isToken: boolean;
}

/** Edition sidebar + card art + flip/rotate/ownership controls, the modal's left column. */
export function CardDetailImagePanel({
  showPrintsSidebar,
  hidePrintsSidebar,
  isPrintsLoading,
  prints,
  card,
  onHoverImageUrl,
  onSelectPrint,
  foilRef,
  foilEnabled,
  onFoilMove,
  onFoilLeave,
  faceImages,
  hoveredImageUrl,
  currentFace,
  motionEnabled,
  visibleImageUrl,
  isPreloading,
  isRotated,
  hasMultipleFaces,
  showBackFace,
  onToggleBackFace,
  canRotate,
  onToggleRotated,
  showCollectionControls,
  isToken
}: CardDetailImagePanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center md:items-start shrink-0 animate-fadeIn md:min-h-0 md:overflow-y-auto md:overscroll-contain custom-scrollbar md:pr-1">
      {showPrintsSidebar && !hidePrintsSidebar && (
        <CardDetailPrintsSidebar
          isLoading={isPrintsLoading}
          prints={prints}
          currentCard={card}
          onHoverImageUrl={onHoverImageUrl}
          onSelectPrint={onSelectPrint}
          getCardFaceImageUrl={getCardImageUrl}
        />
      )}

      <div className="card-detail-image-wrapper flex flex-col items-center gap-3 shrink-0 relative group/image">
        <div
          ref={foilRef}
          className="relative rounded-[4.5%]"
          onMouseMove={foilEnabled ? onFoilMove : undefined}
          onMouseLeave={foilEnabled ? onFoilLeave : undefined}
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
            onClick={onToggleBackFace}
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
            onClick={onToggleRotated}
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

        {showCollectionControls && !isToken ? (
          <div className="w-full max-w-[300px]">
            <CardCollectionControls card={card} variant="panel" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CardDetailImagePanel;
