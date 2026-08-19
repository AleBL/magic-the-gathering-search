import { describe, expect, it } from 'vitest';
import { makeCard } from '../../test/factories';

const faceImage = (url: string) => ({ small: url, normal: url, large: url, png: url });
import { PrintZoneFilter } from '../../types/enums';
import {
  borderStyleFor,
  cardFacesToPrint,
  chunkFaces,
  PrintableFace,
  realSizeColumns,
  realSizeRows,
  scaledRows,
  selectCardsForPrint
} from '../proxyPrintLayout';

describe('realSizeColumns', () => {
  it('fits three 63mm cards across an A4 portrait page', () => {
    expect(realSizeColumns('a4', 'portrait')).toBe(3);
  });

  it('fits more across the same page in landscape', () => {
    expect(realSizeColumns('a4', 'landscape')).toBe(4);
  });

  it('never reports fewer than one column, however narrow the page', () => {
    expect(realSizeColumns('a5', 'portrait')).toBeGreaterThanOrEqual(1);
  });
});

describe('realSizeRows', () => {
  it('fits three 88mm cards down an A4 portrait page', () => {
    expect(realSizeRows('a4', 'portrait')).toBe(3);
  });

  it('fits fewer rows on the shorter side in landscape', () => {
    expect(realSizeRows('a4', 'landscape')).toBe(2);
  });
});

describe('scaledRows', () => {
  it('fits more rows as the cards are scaled down', () => {
    expect(scaledRows('a4', 'portrait', 'none', 3)).toBeLessThan(scaledRows('a4', 'portrait', 'none', 6));
  });

  it('never fits more rows with wider spacing than with none', () => {
    expect(scaledRows('a4', 'portrait', 'large', 4)).toBeLessThanOrEqual(scaledRows('a4', 'portrait', 'none', 4));
  });

  it('always leaves room for at least one row', () => {
    expect(scaledRows('a5', 'portrait', 'large', 2)).toBeGreaterThanOrEqual(1);
  });
});

describe('borderStyleFor', () => {
  it('maps each cutting guide to its CSS border', () => {
    expect(borderStyleFor('none')).toBe('none');
    expect(borderStyleFor('solid')).toBe('1px solid #aaa');
    expect(borderStyleFor('dotted')).toBe('1px dashed #aaa');
  });
});

describe('cardFacesToPrint', () => {
  it('prints one side of a single-faced card', () => {
    const faces = cardFacesToPrint([makeCard({ id: 'bolt' })]);

    expect(faces).toEqual([{ card: expect.anything(), faceIndex: 0, id: 'bolt-front' }]);
  });

  it('prints both sides of a double-faced card', () => {
    const card = makeCard({
      id: 'delver',
      card_faces: [
        { name: 'Front', type_line: 'Creature', image_uris: faceImage('front.png') },
        { name: 'Back', type_line: 'Creature', image_uris: faceImage('back.png') }
      ]
    });

    expect(cardFacesToPrint([card]).map((face) => face.id)).toEqual(['delver-front', 'delver-back']);
  });

  it('skips a back face that has no image to print', () => {
    const card = makeCard({
      id: 'split',
      card_faces: [
        { name: 'Front', type_line: 'Instant', image_uris: faceImage('front.png') },
        { name: 'Back', type_line: 'Instant' }
      ]
    });

    expect(cardFacesToPrint([card]).map((face) => face.id)).toEqual(['split-front']);
  });
});

describe('chunkFaces', () => {
  const faces = Array.from({ length: 7 }, (_, i) => ({ faceIndex: 0, id: `f-${i}` }) as PrintableFace);

  it('splits the faces into pages of the given size', () => {
    expect(chunkFaces(faces, 3).map((page) => page.length)).toEqual([3, 3, 1]);
  });

  it('returns no pages at all for an empty deck', () => {
    expect(chunkFaces([], 9)).toEqual([]);
  });
});

describe('selectCardsForPrint', () => {
  const zones = {
    all: [makeCard({ id: 'main-1' }), makeCard({ id: 'side-1' })],
    main: [makeCard({ id: 'main-1' })],
    sideboard: [makeCard({ id: 'side-1' })],
    maybeboard: [makeCard({ id: 'maybe-1' })],
    tokens: [makeCard({ id: 'token-1' })]
  };
  const ids = (filter: PrintZoneFilter) => selectCardsForPrint(filter, zones).map((card) => card.id);

  it('prints a single zone on its own', () => {
    expect(ids(PrintZoneFilter.MAIN)).toEqual(['main-1']);
    expect(ids(PrintZoneFilter.SIDEBOARD)).toEqual(['side-1']);
    expect(ids(PrintZoneFilter.MAYBEBOARD)).toEqual(['maybe-1']);
    expect(ids(PrintZoneFilter.TOKENS)).toEqual(['token-1']);
  });

  it('combines the zones a compound filter names, in order', () => {
    expect(ids(PrintZoneFilter.MAIN_TOKENS)).toEqual(['main-1', 'token-1']);
    expect(ids(PrintZoneFilter.MAIN_SIDEBOARD_MAYBEBOARD)).toEqual(['main-1', 'side-1', 'maybe-1']);
  });

  it('prints the whole deck plus its tokens by default', () => {
    expect(ids(PrintZoneFilter.ALL)).toEqual(['main-1', 'side-1', 'token-1']);
  });
});
