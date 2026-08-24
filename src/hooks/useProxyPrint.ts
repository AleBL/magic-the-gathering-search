import { useEffect, useMemo, useState } from 'react';
import { Card } from '../types/Card';
import { DeckRelatedToken } from '../types/Deck';
import { DeckZone, PrintZoneFilter } from '../types/enums';
import {
  borderStyleFor,
  cardFacesToPrint,
  chunkFaces,
  CuttingGuide,
  OrientationOption,
  PAPER_DIMENSIONS_MM,
  PageSizeOption,
  PRINT_SPACING_MAP,
  realSizeColumns,
  realSizeRows,
  scaledRows,
  SCREEN_SPACING_MAP,
  selectCardsForPrint,
  SpacingOption
} from '../utils/proxyPrintLayout';
import { useProxyPrintRoutine } from './print/useProxyPrintRoutine';

export { resolveFaceImageUrl, CARDS_PER_ROW_OPTIONS } from '../utils/proxyPrintLayout';
export type { SpacingOption, CuttingGuide, PageSizeOption, OrientationOption } from '../utils/proxyPrintLayout';

interface UseProxyPrintArgs {
  cards: Card[];
  deckRelatedTokens: DeckRelatedToken[];
  defaultZone: DeckZone;
}

/** All state, layout math, and the print routine for the proxy-print modal. */
export function useProxyPrint({ cards, deckRelatedTokens, defaultZone }: UseProxyPrintArgs) {
  const [useRealSize, setUseRealSize] = useState<boolean>(true);
  const [spacing, setSpacing] = useState<SpacingOption>('small');
  const [cuttingGuide, setCuttingGuide] = useState<CuttingGuide>('dotted');
  const [cardsPerRow, setCardsPerRow] = useState<number>(3);
  const [zoneFilter, setZoneFilter] = useState<PrintZoneFilter>(
    (defaultZone as unknown as PrintZoneFilter) || PrintZoneFilter.ALL
  );
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [orientation, setOrientation] = useState<OrientationOption>('portrait');

  const { isPrinting, printRootRef, handlePrint } = useProxyPrintRoutine(pageSize, orientation);

  const tokenCards = useMemo(
    () => deckRelatedTokens.map((relatedToken) => relatedToken.tokenCard),
    [deckRelatedTokens]
  );
  const mainCards = useMemo(() => cards.filter((card) => !card.zone || card.zone === DeckZone.MAIN), [cards]);
  const sideboardCards = useMemo(() => cards.filter((card) => card.zone === DeckZone.SIDEBOARD), [cards]);
  const maybeboardCards = useMemo(() => cards.filter((card) => card.zone === DeckZone.MAYBEBOARD), [cards]);

  const filteredCards = useMemo(
    () =>
      selectCardsForPrint(zoneFilter, {
        all: cards,
        main: mainCards,
        sideboard: sideboardCards,
        maybeboard: maybeboardCards,
        tokens: tokenCards
      }),
    [cards, zoneFilter, tokenCards, mainCards, sideboardCards, maybeboardCards]
  );

  const calculatedColumns = useMemo(
    () => (useRealSize ? realSizeColumns(pageSize, orientation) : cardsPerRow),
    [useRealSize, pageSize, orientation, cardsPerRow]
  );

  const calculatedRows = useMemo(
    () => (useRealSize ? realSizeRows(pageSize, orientation) : scaledRows(pageSize, orientation, spacing, cardsPerRow)),
    [useRealSize, pageSize, orientation, spacing, cardsPerRow]
  );

  const cardsPerPage = useMemo(() => calculatedColumns * calculatedRows, [calculatedColumns, calculatedRows]);

  useEffect(() => {
    if (useRealSize) {
      setCardsPerRow(calculatedColumns);
    }
  }, [useRealSize, calculatedColumns]);

  const borderStyle = useMemo(() => borderStyleFor(cuttingGuide), [cuttingGuide]);
  const facesToPrint = useMemo(() => cardFacesToPrint(filteredCards), [filteredCards]);
  const chunkedCards = useMemo(() => chunkFaces(facesToPrint, cardsPerPage), [facesToPrint, cardsPerPage]);
  const estimatedPages = useMemo(
    () => Math.ceil(facesToPrint.length / cardsPerPage),
    [facesToPrint.length, cardsPerPage]
  );

  return {
    useRealSize,
    setUseRealSize,
    spacing,
    setSpacing,
    cuttingGuide,
    setCuttingGuide,
    cardsPerRow,
    setCardsPerRow,
    zoneFilter,
    setZoneFilter,
    pageSize,
    setPageSize,
    orientation,
    setOrientation,
    isPrinting,
    printRootRef,
    tokenCards,
    mainCards,
    sideboardCards,
    maybeboardCards,
    calculatedColumns,
    calculatedRows,
    cardsPerPage,
    cssGridGapValue: SCREEN_SPACING_MAP[spacing],
    printGridGapValue: PRINT_SPACING_MAP[spacing],
    borderStyle,
    facesToPrint,
    chunkedCards,
    estimatedPages,
    currentPaperWidthMm: PAPER_DIMENSIONS_MM[pageSize].width,
    currentPaperHeightMm: PAPER_DIMENSIONS_MM[pageSize].height,
    handlePrint
  };
}
