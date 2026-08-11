import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildDecklistLines,
  buildManaCurve,
  buildColorCounts,
  buildTypeCounts,
  pickHeroCard,
  renderDeckImage
} from './deckImage';
import { Card } from '../types/Card';

const c = (name: string, extra: Partial<Card> = {}): Card => ({ name, ...extra }) as Card;

describe('buildDecklistLines', () => {
  it('groups copies by name and counts them', () => {
    expect(buildDecklistLines([c('Bolt'), c('Bolt'), c('Forest')])).toEqual([
      { name: 'Bolt', count: 2 },
      { name: 'Forest', count: 1 }
    ]);
  });

  it('returns an empty list for no cards', () => {
    expect(buildDecklistLines([])).toEqual([]);
  });
});

describe('buildManaCurve', () => {
  it('buckets by cmc and groups everything from 7 upwards', () => {
    const curve = buildManaCurve([
      c('A', { cmc: 0, type_line: 'Artifact' }),
      c('B', { cmc: 3, type_line: 'Creature' }),
      c('C', { cmc: 9, type_line: 'Creature' })
    ]);
    expect(curve[0]).toBe(1);
    expect(curve[3]).toBe(1);
    expect(curve[7]).toBe(1);
  });

  it('excludes lands from the curve', () => {
    expect(buildManaCurve([c('Forest', { cmc: 0, type_line: 'Basic Land — Forest' })])[0]).toBe(0);
  });
});

describe('buildColorCounts', () => {
  it('counts copies per colour identity', () => {
    const counts = buildColorCounts([c('A', { color_identity: ['U', 'B'] }), c('B', { color_identity: ['U'] })]);
    expect(counts.U).toBe(2);
    expect(counts.B).toBe(1);
    expect(counts.G).toBe(0);
  });
});

describe('buildTypeCounts', () => {
  it('counts primary types, highest first', () => {
    const counts = buildTypeCounts([
      c('A', { type_line: 'Creature — Elf' }),
      c('B', { type_line: 'Creature — Bear' }),
      c('C', { type_line: 'Instant' })
    ]);
    expect(counts[0]).toEqual({ key: 'Creature', count: 2 });
    expect(counts[1]).toEqual({ key: 'Instant', count: 1 });
  });
});

describe('pickHeroCard', () => {
  it('prefers the commander', () => {
    const commander = c('Codie', { isCommander: true });
    expect(pickHeroCard([c('Bolt'), commander])).toBe(commander);
  });

  it('falls back to a card with key art', () => {
    const withArt = c('Bolt', { image_uris: { small: '', normal: '', large: '', png: '', art_crop: 'x' } });
    expect(pickHeroCard([c('Plains'), withArt])).toBe(withArt);
  });
});

/**
 * `renderDeckImage` is pure Canvas work, so jsdom needs a stand-in context. The point is not
 * to assert pixels — it is that the render walks its branches (hero art present or missing,
 * an image that fails to load, an empty deck) and still produces a blob instead of throwing.
 */
describe('renderDeckImage', () => {
  const calls: { text: string[]; fillRect: number; drawImage: number } = { text: [], fillRect: 0, drawImage: 0 };
  const originalCreateElement = document.createElement;

  function stubCanvas(options: { context?: boolean; blob?: boolean } = {}) {
    calls.text = [];
    calls.fillRect = 0;
    calls.drawImage = 0;

    const ctx = {
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(() => {
        calls.fillRect += 1;
      }),
      drawImage: vi.fn(() => {
        calls.drawImage += 1;
      }),
      fillText: vi.fn((text: string) => {
        calls.text.push(text);
      }),
      measureText: vi.fn(() => ({ width: 80 })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      font: '',
      globalAlpha: 1,
      textAlign: 'left'
    };

    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      // Only canvas is faked; everything else keeps jsdom's real element.
      if (tag !== 'canvas') return (originalCreateElement as (t: string) => HTMLElement).call(document, tag);
      return {
        width: 0,
        height: 0,
        getContext: () => (options.context === false ? null : ctx),
        toBlob: (cb: (blob: Blob | null) => void) =>
          cb(options.blob === false ? null : new Blob(['x'], { type: 'image/png' }))
      };
    }) as typeof document.createElement);

    return ctx;
  }

  /** Image never fires onload/onerror unless a test says so. */
  function stubImage(outcome: 'load' | 'error') {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      width = 400;
      height = 300;
      set src(_value: string) {
        queueMicrotask(() => (outcome === 'load' ? this.onload?.() : this.onerror?.()));
      }
    }
    vi.stubGlobal('Image', FakeImage);
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const deckOf = (cards: Card[]) => ({
    id: 'd1',
    name: 'My Test Deck',
    format: 'modern' as const,
    cards,
    createdAt: '2026-01-01T00:00:00.000Z'
  });

  it('draws the hero art when it loads', async () => {
    stubCanvas();
    stubImage('load');
    const hero = c('Hero', { image_uris: { small: '', normal: '', large: '', png: '', art_crop: 'art' } });

    const blob = await renderDeckImage(deckOf([hero, c('Bolt'), c('Bolt')]));

    expect(blob.type).toBe('image/png');
    expect(calls.drawImage, 'the hero art was never drawn').toBeGreaterThan(0);
    expect(calls.text.join(' ')).toContain('My Test Deck');
  });

  it('still renders when the art fails to load', async () => {
    stubCanvas();
    stubImage('error');
    const hero = c('Hero', { image_uris: { small: '', normal: '', large: '', png: '', art_crop: 'art' } });

    const blob = await renderDeckImage(deckOf([hero]));

    expect(blob.type).toBe('image/png');
    expect(calls.drawImage, 'a failed image should not be drawn').toBe(0);
  });

  it('renders a deck with no art at all', async () => {
    stubCanvas();
    const blob = await renderDeckImage(deckOf([c('Plains', { type_line: 'Basic Land — Plains' })]));

    expect(blob.type).toBe('image/png');
    expect(calls.drawImage).toBe(0);
  });

  it('renders an empty deck without throwing', async () => {
    stubCanvas();
    const blob = await renderDeckImage(deckOf([]));

    expect(blob.type).toBe('image/png');
    expect(calls.fillRect, 'nothing was painted').toBeGreaterThan(0);
  });

  it('reports a missing 2D context instead of failing silently', async () => {
    stubCanvas({ context: false });

    await expect(renderDeckImage(deckOf([c('Bolt')]))).rejects.toThrow(/Canvas 2D context/);
  });

  it('rejects when the canvas yields no blob', async () => {
    stubCanvas({ blob: false });

    await expect(renderDeckImage(deckOf([c('Bolt')]))).rejects.toThrow(/Failed to render/);
  });
});
