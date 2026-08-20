import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Card, CardFace } from '../../types/Card';
import { DeckRelatedToken } from '../../types/Deck';
import { DeckZone, PrintZoneFilter } from '../../types/enums';
import { makeCard } from '../../test/factories';
import { useProxyPrint } from '../useProxyPrint';

const PRINT_STYLE_ID = 'proxy-print-override';

const faceWithArt = (name: string): CardFace => ({
  name,
  type_line: 'Creature — Human',
  image_uris: { small: `${name}-s`, normal: `${name}-n`, large: `${name}-l`, png: `${name}-p` }
});

// Module-level so every render passes the same references: the hook memoizes on them, and a
// fresh array per render would recompute the whole layout on every keystroke.
const MAIN_CARD = makeCard({ id: 'main-1', name: 'Lightning Bolt' });
const SIDEBOARD_CARD = makeCard({ id: 'side-1', name: 'Duress', zone: DeckZone.SIDEBOARD });
const MAYBEBOARD_CARD = makeCard({ id: 'maybe-1', name: 'Shock', zone: DeckZone.MAYBEBOARD });
const DECK: Card[] = [MAIN_CARD, SIDEBOARD_CARD, MAYBEBOARD_CARD];

const TOKENS: DeckRelatedToken[] = [
  { tokenCard: makeCard({ id: 'token-1', name: 'Goblin' }), generatorCardName: 'Krenko' }
];

const NO_TOKENS: DeckRelatedToken[] = [];

const setup = (defaultZone: DeckZone = DeckZone.MAIN, cards: Card[] = DECK, tokens = TOKENS) =>
  renderHook(() => useProxyPrint({ cards, deckRelatedTokens: tokens, defaultZone }));

// A4 portrait, the default: 200mm of usable width fits 3 cards of 63mm, 287mm of usable
// height fits 3 rows of 88mm.
describe('useProxyPrint layout', () => {
  it('splits the deck by zone, counting an unzoned card as main', () => {
    const { result } = setup();

    expect(result.current.mainCards.map((card) => card.name)).toEqual(['Lightning Bolt']);
    expect(result.current.sideboardCards.map((card) => card.name)).toEqual(['Duress']);
    expect(result.current.maybeboardCards.map((card) => card.name)).toEqual(['Shock']);
    expect(result.current.tokenCards.map((card) => card.name)).toEqual(['Goblin']);
  });

  // The modal is opened from a zone, and printing the whole deck when the user asked for the
  // sideboard is 60 wasted pages.
  it('starts on the zone the modal was opened from', () => {
    const { result } = setup(DeckZone.SIDEBOARD);

    expect(result.current.zoneFilter).toBe(PrintZoneFilter.SIDEBOARD);
    expect(result.current.facesToPrint.map((face) => face.card.name)).toEqual(['Duress']);
  });

  it('prints the deck and its tokens together when no zone narrows it', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.setZoneFilter(PrintZoneFilter.ALL);
    });

    expect(result.current.facesToPrint.map((face) => face.card.name)).toEqual([
      'Lightning Bolt',
      'Duress',
      'Shock',
      'Goblin'
    ]);
  });

  it('combines two zones when the filter names both', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.setZoneFilter(PrintZoneFilter.MAIN_SIDEBOARD);
    });

    expect(result.current.facesToPrint.map((face) => face.card.name)).toEqual(['Lightning Bolt', 'Duress']);
  });

  // Real size means 63x88mm on paper, so the paper decides how many fit across. The settings
  // bar disables the column picker for exactly this reason, and the layout ignores it anyway.
  it('lays out by what the paper fits while real size is on', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.setUseRealSize(false);
      result.current.setCardsPerRow(6);
    });
    expect(result.current.calculatedColumns).toBe(6);

    await act(async () => {
      result.current.setUseRealSize(true);
    });

    expect(result.current.calculatedColumns).toBe(3);
  });

  // Switching real size on also moves the picker to the paper's answer, so switching it back
  // off leaves the preview where it already is rather than jumping to a stale 6.
  it('snaps the chosen column count to the paper when real size goes on', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.setUseRealSize(false);
      result.current.setCardsPerRow(6);
    });
    expect(result.current.cardsPerRow).toBe(6);

    await act(async () => {
      result.current.setUseRealSize(true);
    });
    expect(result.current.cardsPerRow).toBe(3);

    await act(async () => {
      result.current.setUseRealSize(false);
    });
    expect(result.current.cardsPerRow).toBe(3);
    expect(result.current.calculatedColumns).toBe(3);
  });

  it('follows the paper it fits when the page size changes under real size', async () => {
    const { result } = setup();
    expect(result.current.cardsPerRow).toBe(3);

    await act(async () => {
      result.current.setPageSize('a5');
    });

    // 138mm of usable width takes two cards across, not three.
    expect(result.current.cardsPerRow).toBe(2);
    expect(result.current.calculatedColumns).toBe(2);
  });

  it('re-fits the page when the paper is turned on its side', async () => {
    const { result } = setup();
    expect(result.current.cardsPerPage).toBe(9);

    await act(async () => {
      result.current.setOrientation('landscape');
    });

    // 287mm across now, 200mm down: four columns and two rows instead of three and three.
    expect(result.current.calculatedColumns).toBe(4);
    expect(result.current.calculatedRows).toBe(2);
    expect(result.current.cardsPerPage).toBe(8);
    // The paper itself did not change shape, only what is laid out on it.
    expect(result.current.currentPaperWidthMm).toBe(210);
    expect(result.current.currentPaperHeightMm).toBe(297);
  });

  // US Letter is where the two modes genuinely disagree: three life-sized cards fit down the
  // page, but three scaled to share its width come out taller and only two rows fit.
  it('fits one more row at real size than the scaled layout does on letter paper', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.setPageSize('letter');
    });

    expect(result.current.calculatedColumns).toBe(3);
    expect(result.current.calculatedRows).toBe(3);
    expect(result.current.cardsPerPage).toBe(9);

    await act(async () => {
      result.current.setUseRealSize(false);
    });

    expect(result.current.calculatedColumns).toBe(3);
    expect(result.current.calculatedRows).toBe(2);
    expect(result.current.cardsPerPage).toBe(6);
  });

  it('follows the paper the user picked', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.setPageSize('legal');
    });

    expect(result.current.currentPaperWidthMm).toBe(216);
    expect(result.current.currentPaperHeightMm).toBe(356);
  });

  // A transforming card is two proxies: printing only the front leaves the player with a
  // card they cannot turn over.
  it('counts a double-faced card as two proxies and pages by what fits', async () => {
    const doubleFaced = makeCard({
      id: 'dfc-1',
      name: 'Delver of Secrets',
      card_faces: [faceWithArt('Delver of Secrets'), faceWithArt('Insectile Aberration')]
    });
    const cards = [...Array.from({ length: 5 }, (_, index) => makeCard({ id: `c${index}` })), doubleFaced];

    const { result } = setup(DeckZone.MAIN, cards, NO_TOKENS);
    await act(async () => {
      result.current.setPageSize('a5');
    });

    expect(result.current.cardsPerPage).toBe(4);
    expect(result.current.facesToPrint).toHaveLength(7);
    expect(result.current.chunkedCards.map((page) => page.length)).toEqual([4, 3]);
    expect(result.current.estimatedPages).toBe(2);
  });

  // The same gap has to be expressed twice: pixels for the preview on screen, millimetres for
  // the paper, and the two are not convertible by any factor the layout knows.
  it('reports the card gap in the unit each surface needs', async () => {
    const { result } = setup();
    expect(result.current.cssGridGapValue).toBe('6px');
    expect(result.current.printGridGapValue).toBe('2.5mm');

    await act(async () => {
      result.current.setSpacing('large');
    });

    expect(result.current.cssGridGapValue).toBe('14px');
    expect(result.current.printGridGapValue).toBe('6mm');
  });

  it('turns the cutting guide into the border the page draws', async () => {
    const { result } = setup();
    expect(result.current.borderStyle).toBe('1px dashed #aaa');

    await act(async () => {
      result.current.setCuttingGuide('solid');
    });
    expect(result.current.borderStyle).toBe('1px solid #aaa');

    await act(async () => {
      result.current.setCuttingGuide('none');
    });
    expect(result.current.borderStyle).toBe('none');
  });
});

/**
 * The print routine, driven through the same hook the modal uses. Every step of it is
 * invisible until it goes wrong: a missing override pages the whole app, printing a frame
 * too early captures the old layout, and not waiting for images prints blank cards.
 */
describe('useProxyPrint print routine', () => {
  const frames: FrameRequestCallback[] = [];
  const printSpy = vi.fn();

  const styleTag = () => document.getElementById(PRINT_STYLE_ID);

  /** Runs the frame callbacks queued so far, the way the browser would on the next paint. */
  const nextFrame = () => {
    const queued = frames.splice(0, frames.length);
    act(() => queued.forEach((callback) => callback(0)));
  };

  const pendingImage = (): HTMLImageElement => {
    const image = document.createElement('img');
    Object.defineProperty(image, 'complete', { value: false });
    return image;
  };

  const printRootWith = (...images: HTMLImageElement[]): HTMLDivElement => {
    const root = document.createElement('div');
    images.forEach((image) => root.appendChild(image));
    return root;
  };

  beforeEach(() => {
    frames.length = 0;
    printSpy.mockClear();
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('print', printSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    styleTag()?.remove();
  });

  it('overrides the page, prints, and takes the override back down', async () => {
    const { result } = setup();

    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isPrinting).toBe(true);
    // Without this rule the printer pages the whole app layout, scrollbars and all.
    expect(styleTag()?.textContent).toContain('body > *:not(#proxy-print-root)');
    expect(printSpy).not.toHaveBeenCalled();

    nextFrame();
    // One frame only commits the print layout; printing here captures the old one.
    expect(printSpy).not.toHaveBeenCalled();

    nextFrame();
    expect(printSpy).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Leaving the override behind would blank every later print the app makes.
    expect(styleTag()).toBeNull();
    expect(result.current.isPrinting).toBe(false);
  });

  it('asks the printer for the paper the user chose', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.setPageSize('legal');
      result.current.setOrientation('landscape');
    });
    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()?.textContent).toContain('size: legal landscape');
  });

  it('prints straight away when every image is already loaded', async () => {
    const { result } = setup();
    const loaded = document.createElement('img');
    Object.defineProperty(loaded, 'complete', { value: true });
    result.current.printRootRef.current = printRootWith(loaded);

    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()).not.toBeNull();
  });

  // The print dialog freezes the page and does not wait for the network, so an image still
  // in flight is printed as a blank card.
  it('holds the print back until a loading image has settled', async () => {
    const { result } = setup();
    const image = pendingImage();
    result.current.printRootRef.current = printRootWith(image);

    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()).toBeNull();
    expect(result.current.isPrinting).toBe(true);

    await act(async () => {
      image.dispatchEvent(new Event('load'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()).not.toBeNull();
    nextFrame();
    nextFrame();
    expect(printSpy).toHaveBeenCalledOnce();
  });

  // An image that will never load is not a reason to refuse to print the other 59 cards.
  it('counts an image that failed as settled', async () => {
    const { result } = setup();
    const image = pendingImage();
    result.current.printRootRef.current = printRootWith(image);

    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      image.dispatchEvent(new Event('error'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()).not.toBeNull();
  });

  it('waits for every pending image, not only the first to answer', async () => {
    const { result } = setup();
    const [first, second] = [pendingImage(), pendingImage()];
    result.current.printRootRef.current = printRootWith(first, second);

    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      first.dispatchEvent(new Event('load'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()).toBeNull();

    await act(async () => {
      second.dispatchEvent(new Event('load'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()).not.toBeNull();
  });

  // A hung image request would otherwise leave the modal on a spinner with no way out.
  it('stops waiting after eight seconds and prints what it has', async () => {
    const { result } = setup();
    result.current.printRootRef.current = printRootWith(pendingImage());

    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(styleTag()).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(styleTag()).not.toBeNull();
    nextFrame();
    nextFrame();
    expect(printSpy).toHaveBeenCalledOnce();
  });

  it('does not wait on anything when there is no print root yet', async () => {
    const { result } = setup();
    result.current.printRootRef.current = null;

    await act(async () => {
      void result.current.handlePrint();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(styleTag()).not.toBeNull();
  });
});
