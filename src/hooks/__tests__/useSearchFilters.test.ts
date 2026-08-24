import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useSearchFilters } from '../useSearchFilters';
import { EMPTY_SEARCH_FILTERS } from '../../constants';
import { SearchFilters } from '../../types';

/** Drives the hook the way the panel does: real state, so toggles compose across calls. */
function renderFilters(initial: Partial<SearchFilters> = {}) {
  return renderHook(() => {
    const [filters, setFilters] = useState<SearchFilters>({ ...EMPTY_SEARCH_FILTERS, ...initial });
    return { filters, ...useSearchFilters(filters, setFilters) };
  });
}

describe('useSearchFilters', () => {
  describe('colors', () => {
    it('adds and removes a color', () => {
      const { result } = renderFilters();

      act(() => result.current.toggleColor('R'));
      expect(result.current.filters.colors).toEqual(['R']);

      act(() => result.current.toggleColor('U'));
      expect(result.current.filters.colors).toEqual(['R', 'U']);

      act(() => result.current.toggleColor('R'));
      expect(result.current.filters.colors).toEqual(['U']);
    });

    // The rule worth pinning: a card is never both colored and colorless, so combining them
    // would build a query that matches nothing.
    it('replaces every color when colorless is picked', () => {
      const { result } = renderFilters({ colors: ['R', 'U'] });

      act(() => result.current.toggleColor('C'));

      expect(result.current.filters.colors).toEqual(['C']);
    });

    it('drops colorless when a real color is picked', () => {
      const { result } = renderFilters({ colors: ['C'] });

      act(() => result.current.toggleColor('G'));

      expect(result.current.filters.colors).toEqual(['G']);
    });

    it('clears colorless by toggling it off, rather than leaving it stuck', () => {
      const { result } = renderFilters({ colors: ['C'] });

      act(() => result.current.toggleColor('C'));

      expect(result.current.filters.colors).toEqual([]);
    });
  });

  it('toggles types independently of each other', () => {
    const { result } = renderFilters();

    act(() => result.current.toggleType('Creature'));
    act(() => result.current.toggleType('Instant'));
    expect(result.current.filters.types).toEqual(['Creature', 'Instant']);

    act(() => result.current.toggleType('Creature'));
    expect(result.current.filters.types).toEqual(['Instant']);
  });

  it('sets a single field without disturbing the others', () => {
    const { result } = renderFilters({ colors: ['R'], rarity: 'rare' });

    act(() => result.current.setField('text', 'draw a card'));

    expect(result.current.filters.text).toBe('draw a card');
    expect(result.current.filters.colors).toEqual(['R']);
    expect(result.current.filters.rarity).toBe('rare');
  });

  it('clears every field back to empty, including the text filters', () => {
    const { result } = renderFilters({
      colors: ['R'],
      types: ['Creature'],
      rarity: 'mythic',
      cmc: '3',
      text: 'flying',
      excludeText: 'trample',
      keyword: 'flying',
      oracleTag: 'removal',
      power: '>=4',
      toughness: '2'
    });

    act(() => result.current.clearFilters());

    expect(result.current.filters).toEqual(EMPTY_SEARCH_FILTERS);
  });

  it('offers colorless among the colors and an "all" rarity, which the panel relies on', () => {
    const { result } = renderFilters();

    expect(result.current.colors.map((color) => color.code)).toContain('C');
    expect(result.current.rarities[0].value).toBe('');
  });
});
