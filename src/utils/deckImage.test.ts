import { describe, it, expect } from 'vitest';
import { buildDecklistLines, buildManaCurve, buildColorCounts, buildTypeCounts, pickHeroCard } from './deckImage';
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
