import { Card } from '../types/Card';
import { PrintZoneFilter } from '../types/enums';
import { getCardImageUrl } from './deckGrouping';

export type SpacingOption = 'none' | 'small' | 'large';
export type CuttingGuide = 'none' | 'solid' | 'dotted';
export type PageSizeOption = 'a4' | 'a5' | 'letter' | 'legal';
export type OrientationOption = 'portrait' | 'landscape';

export interface PrintableFace {
  card: Card;
  faceIndex: number;
  id: string;
}

export const CARDS_PER_ROW_OPTIONS = [2, 3, 4, 6, 8] as const;

// A real Magic card is 63x88mm, and 5mm of margin on each side is what a printer can be
// relied on to reach: proxies cut from a page that ignores either come out the wrong size.
const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;
const PAGE_MARGINS_MM = 10;

const SPACING_MM: Record<SpacingOption, number> = { none: 0, small: 2.5, large: 6 };

export const SCREEN_SPACING_MAP: Record<SpacingOption, string> = {
  none: '0px',
  small: '6px',
  large: '14px'
};

export const PRINT_SPACING_MAP: Record<SpacingOption, string> = {
  none: `${SPACING_MM.none}mm`,
  small: `${SPACING_MM.small}mm`,
  large: `${SPACING_MM.large}mm`
};

export const CSS_PAGE_SIZE_MAP: Record<PageSizeOption, string> = {
  a4: 'A4',
  a5: 'A5',
  letter: 'letter',
  legal: 'legal'
};

export const PAPER_DIMENSIONS_MM: Record<PageSizeOption, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 }
};

const usableWidthMm = (pageSize: PageSizeOption, orientation: OrientationOption): number => {
  const paper = PAPER_DIMENSIONS_MM[pageSize];
  return (orientation === 'portrait' ? paper.width : paper.height) - PAGE_MARGINS_MM;
};

const usableHeightMm = (pageSize: PageSizeOption, orientation: OrientationOption): number => {
  const paper = PAPER_DIMENSIONS_MM[pageSize];
  return (orientation === 'portrait' ? paper.height : paper.width) - PAGE_MARGINS_MM;
};

/** How many life-sized cards fit across the page. */
export function realSizeColumns(pageSize: PageSizeOption, orientation: OrientationOption): number {
  return Math.max(1, Math.floor(usableWidthMm(pageSize, orientation) / CARD_WIDTH_MM));
}

export function realSizeRows(pageSize: PageSizeOption, orientation: OrientationOption): number {
  return Math.max(1, Math.floor(usableHeightMm(pageSize, orientation) / CARD_HEIGHT_MM));
}

/** Rows that fit once the requested columns have scaled the cards down to share the width. */
export function scaledRows(
  pageSize: PageSizeOption,
  orientation: OrientationOption,
  spacing: SpacingOption,
  cardsPerRow: number
): number {
  const gap = SPACING_MM[spacing];
  const cardWidth = (usableWidthMm(pageSize, orientation) - gap * (cardsPerRow - 1)) / cardsPerRow;
  const cardHeight = cardWidth * (CARD_HEIGHT_MM / CARD_WIDTH_MM);
  // The 0.05 absorbs the rounding of millimetre arithmetic, which otherwise drops a row that
  // fits by a hair and leaves an obviously empty band at the bottom of every page.
  return Math.max(1, Math.floor((usableHeightMm(pageSize, orientation) + gap) / (cardHeight + gap) + 0.05));
}

export function borderStyleFor(cuttingGuide: CuttingGuide): string {
  if (cuttingGuide === 'none') return 'none';
  if (cuttingGuide === 'solid') return '1px solid #aaa';
  return '1px dashed #aaa';
}

/** Resolves the printable image URL for a specific card face, falling back to the deck grouping helper. */
export function resolveFaceImageUrl(card: Card, faceIndex: number): string {
  const imageUris =
    faceIndex === 0 ? (card.image_uris ?? card.card_faces?.[0]?.image_uris) : card.card_faces?.[faceIndex]?.image_uris;
  const baseUrl = imageUris ? imageUris.normal || imageUris.large || '' : '';
  return faceIndex === 0 && card.selectedPrintImageUri ? card.selectedPrintImageUri : baseUrl || getCardImageUrl(card);
}

/** One entry per printable side: a double-faced card is two proxies, not one. */
export function cardFacesToPrint(cards: Card[]): PrintableFace[] {
  const faces: PrintableFace[] = [];
  cards.forEach((card) => {
    faces.push({ card, faceIndex: 0, id: `${card.id}-front` });
    if (card.card_faces && card.card_faces.length > 1 && card.card_faces[1].image_uris) {
      faces.push({ card, faceIndex: 1, id: `${card.id}-back` });
    }
  });
  return faces;
}

export function chunkFaces(faces: PrintableFace[], perPage: number): PrintableFace[][] {
  const pages: PrintableFace[][] = [];
  for (let index = 0; index < faces.length; index += perPage) {
    pages.push(faces.slice(index, index + perPage));
  }
  return pages;
}

export interface PrintableZones {
  all: Card[];
  main: Card[];
  sideboard: Card[];
  maybeboard: Card[];
  tokens: Card[];
}

export function selectCardsForPrint(zoneFilter: PrintZoneFilter, zones: PrintableZones): Card[] {
  switch (zoneFilter) {
    case PrintZoneFilter.MAIN:
      return zones.main;
    case PrintZoneFilter.SIDEBOARD:
      return zones.sideboard;
    case PrintZoneFilter.MAYBEBOARD:
      return zones.maybeboard;
    case PrintZoneFilter.TOKENS:
      return zones.tokens;
    case PrintZoneFilter.MAIN_TOKENS:
      return [...zones.main, ...zones.tokens];
    case PrintZoneFilter.MAIN_SIDEBOARD:
      return [...zones.main, ...zones.sideboard];
    case PrintZoneFilter.MAIN_MAYBEBOARD:
      return [...zones.main, ...zones.maybeboard];
    case PrintZoneFilter.SIDEBOARD_MAYBEBOARD:
      return [...zones.sideboard, ...zones.maybeboard];
    case PrintZoneFilter.MAIN_SIDEBOARD_MAYBEBOARD:
      return [...zones.main, ...zones.sideboard, ...zones.maybeboard];
    default:
      return [...zones.all, ...zones.tokens];
  }
}
