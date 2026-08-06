import { lazy, Suspense } from 'react';
import { Card } from '../../types/Card';
import { DeckFormat, DeckRelatedToken } from '../../types/Deck';

const PlaytestSimulator = lazy(() => import('../playtest/PlaytestSimulator'));
const DeckProxyPrint = lazy(() => import('./DeckProxyPrint'));

interface DeckPreviewOverlaysProps {
  cards: Card[];
  isPlaytestOpen: boolean;
  onClosePlaytest: () => void;
  isProxyPrintOpen: boolean;
  onCloseProxyPrint: () => void;
  deckFormat?: DeckFormat;
  deckName?: string;
  deckRelatedTokens?: DeckRelatedToken[];
}

/** Lazy-loaded playtest and proxy-print overlays shared by both DeckPreview branches. */
function DeckPreviewOverlays({
  cards,
  isPlaytestOpen,
  onClosePlaytest,
  isProxyPrintOpen,
  onCloseProxyPrint,
  deckFormat,
  deckName,
  deckRelatedTokens
}: DeckPreviewOverlaysProps) {
  return (
    <>
      <Suspense fallback={null}>
        <PlaytestSimulator
          isOpen={isPlaytestOpen}
          onClose={onClosePlaytest}
          deckCards={cards}
          deckFormat={deckFormat}
          deckRelatedTokens={deckRelatedTokens}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DeckProxyPrint
          isOpen={isProxyPrintOpen}
          onClose={onCloseProxyPrint}
          cards={cards}
          deckName={deckName}
          deckRelatedTokens={deckRelatedTokens}
        />
      </Suspense>
    </>
  );
}

export default DeckPreviewOverlays;
