import { useEffect, useState } from 'react';
import { Card } from '../../types/Card';
import { getCardImageUrl } from '../../utils/deckGrouping';

// A Magic card is 5:7, so the height follows from the width alone.
const CARD_ASPECT = 7 / 5;
const BASE_WIDTH = 260;
const LARGE_WIDTH = 320;
const VIEWPORT_MARGIN = 40;

const widthForViewport = (): number => {
  const fitsTall = window.innerHeight >= LARGE_WIDTH * CARD_ASPECT + VIEWPORT_MARGIN * 2;
  const fitsWide = window.innerWidth >= LARGE_WIDTH * 2 + VIEWPORT_MARGIN * 2;

  return fitsTall && fitsWide ? LARGE_WIDTH : BASE_WIDTH;
};

interface DeckFloatingPreviewProps {
  card: Card;
  mousePos: { x: number; y: number };
}

function DeckFloatingPreview({ card, mousePos }: DeckFloatingPreviewProps) {
  const [width, setWidth] = useState(widthForViewport);

  useEffect(() => {
    const measure = () => setWidth(widthForViewport());
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const imageUrl = getCardImageUrl(card);
  if (!imageUrl) return null;

  const height = width * CARD_ASPECT;

  let left = mousePos.x + 20;
  let top = mousePos.y - height / 2;

  if (left + width > window.innerWidth) left = mousePos.x - width - 20;
  if (left < 0) left = 10;
  if (top + height > window.innerHeight) top = window.innerHeight - height - 20;
  if (top < 10) top = 10;

  return (
    <div className="floating-card-preview" style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}>
      <img src={imageUrl} alt={card.name} className="floating-card-image" />
    </div>
  );
}

export default DeckFloatingPreview;
