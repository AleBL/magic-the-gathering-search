import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnimatedList } from '../useAnimatedList';

/**
 * The behaviour worth pinning: a removed row is held as `isLeaving` for the exit animation
 * and only then dropped. Getting the hold wrong is what makes a list flicker; getting the
 * bail-out wrong re-renders on every parent render, since `items` is a fresh array each time.
 */

interface Row {
  id: string;
  label: string;
}

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id, label: id.toUpperCase() }));
const getKey = (row: Row) => row.id;
const keysOf = (entries: { key: string }[]) => entries.map((entry) => entry.key);

let matchMediaValue = false;

beforeEach(() => {
  vi.useFakeTimers();
  // usePrefersReducedMotion reads matchMedia; jsdom does not implement it.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matchMediaValue,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  matchMediaValue = false;
});

describe('useAnimatedList', () => {
  it('starts with the items it was given', () => {
    const { result } = renderHook(() => useAnimatedList(rows('a', 'b'), getKey));

    expect(keysOf(result.current)).toEqual(['a', 'b']);
    expect(result.current.every((entry) => !entry.isLeaving)).toBe(true);
  });

  it('appends a new item without marking anything as leaving', () => {
    const { result, rerender } = renderHook(({ items }: { items: Row[] }) => useAnimatedList(items, getKey), {
      initialProps: { items: rows('a') }
    });

    rerender({ items: rows('a', 'b') });

    expect(keysOf(result.current)).toEqual(['a', 'b']);
    expect(result.current.every((entry) => !entry.isLeaving)).toBe(true);
  });

  it('holds a removed item as leaving, then drops it once the exit time passes', () => {
    const { result, rerender } = renderHook(({ items }: { items: Row[] }) => useAnimatedList(items, getKey, 200), {
      initialProps: { items: rows('a', 'b') }
    });

    rerender({ items: rows('a') });

    expect(keysOf(result.current)).toEqual(['a', 'b']);
    expect(result.current.find((entry) => entry.key === 'b')?.isLeaving).toBe(true);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(keysOf(result.current), 'dropped before the animation finished').toEqual(['a', 'b']);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(keysOf(result.current)).toEqual(['a']);
  });

  it('drops a removed item immediately when the user prefers reduced motion', () => {
    matchMediaValue = true;

    const { result, rerender } = renderHook(({ items }: { items: Row[] }) => useAnimatedList(items, getKey), {
      initialProps: { items: rows('a', 'b') }
    });

    rerender({ items: rows('a') });

    expect(keysOf(result.current)).toEqual(['a']);
  });

  // The loop this guards: an inline getKey used to retrigger the sync effect after its own
  // setEntries, forever. A parent re-render hands over a fresh array holding the same items,
  // and that must not produce new entries. Items are compared by reference, so this is about
  // the array being new — not about equal contents.
  it('keeps the same entry objects when a fresh array holds the same items', () => {
    const items = rows('a', 'b');
    const { result, rerender } = renderHook(
      ({ items: list }: { items: Row[] }) => useAnimatedList(list, (row) => row.id),
      {
        initialProps: { items }
      }
    );

    const before = result.current;
    rerender({ items: [...items] });

    expect(result.current[0]).toBe(before[0]);
    expect(result.current[1]).toBe(before[1]);
  });

  it('surfaces an updated item rather than the stale one it replaced', () => {
    const { result, rerender } = renderHook(({ items }: { items: Row[] }) => useAnimatedList(items, getKey), {
      initialProps: { items: rows('a') }
    });

    rerender({ items: [{ id: 'a', label: 'CHANGED' }] });

    expect(result.current[0].item.label).toBe('CHANGED');
    expect(result.current[0].isLeaving).toBe(false);
  });

  it('revives an item that comes back before its exit finished', () => {
    const { result, rerender } = renderHook(({ items }: { items: Row[] }) => useAnimatedList(items, getKey, 200), {
      initialProps: { items: rows('a', 'b') }
    });

    rerender({ items: rows('a') });
    expect(result.current.find((entry) => entry.key === 'b')?.isLeaving).toBe(true);

    rerender({ items: rows('a', 'b') });

    expect(result.current.find((entry) => entry.key === 'b')?.isLeaving).toBe(false);
  });

  it('clears pending exit timers on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { rerender, unmount } = renderHook(({ items }: { items: Row[] }) => useAnimatedList(items, getKey, 200), {
      initialProps: { items: rows('a', 'b') }
    });

    rerender({ items: rows('a') });
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
