import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEscapeKey } from './useEscapeKey';

/**
 * The bug this guards: the hook used to key its effect on `onEscape`, so a call site passing
 * an inline arrow re-registered its window listener on every render. Escape is a discrete
 * event, so React flushes state updates inside the dispatch — one dialog's handler could
 * remove another dialog's listener while the same keypress was still travelling to it, and
 * the DOM never invokes a listener removed before the event reaches it.
 */

const pressEscape = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEscapeKey', () => {
  it('registers once across re-renders that change the callback identity', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    // A fresh arrow each render, the way most call sites are written.
    const { rerender } = renderHook(() => useEscapeKey(() => undefined, true));
    const keydownAdds = () => add.mock.calls.filter(([type]) => type === 'keydown').length;
    const keydownRemoves = () => remove.mock.calls.filter(([type]) => type === 'keydown').length;

    expect(keydownAdds()).toBe(1);
    rerender();
    rerender();
    rerender();

    expect(keydownAdds(), 'listener churn across renders is what dropped a live Escape').toBe(1);
    expect(keydownRemoves()).toBe(0);
  });

  it('calls the newest callback, not the one captured at registration', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ fn }: { fn: () => void }) => useEscapeKey(fn, true), {
      initialProps: { fn: first }
    });
    rerender({ fn: second });
    pressEscape();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  // The field failure itself — a re-render pulling a listener out of a live dispatch — needs
  // React's synchronous flush for discrete events, which jsdom does not reproduce. The
  // registration count above is the part of it that is testable here; e2e/keyboard.spec.ts
  // covers the behaviour in a real browser.

  it('does not listen while inactive', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape, false));

    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });
});
