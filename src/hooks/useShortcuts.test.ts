import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShortcuts } from './useShortcuts';

/**
 * The keyboard layer had one silent bug already (see useEscapeKey): a shortcut that quietly
 * stops firing looks like nothing at all. These pin which key reaches which handler, and that
 * the browser's own binding is only suppressed when the app actually handled the key.
 */

const press = (key: string, modifiers: Partial<KeyboardEventInit> = {}) => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...modifiers });
  window.dispatchEvent(event);
  return event;
};

const setUserAgent = (value: string) => Object.defineProperty(navigator, 'userAgent', { value, configurable: true });

const ORIGINAL_UA = navigator.userAgent;

beforeEach(() => setUserAgent('Mozilla/5.0 (X11; Linux x86_64)'));
afterEach(() => setUserAgent(ORIGINAL_UA));

describe('useShortcuts', () => {
  it('calls onEscape for a bare Escape', () => {
    const onEscape = vi.fn();
    renderHook(() => useShortcuts({ onEscape }));

    press('Escape');

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('routes each modifier shortcut to its own handler', () => {
    const handlers = {
      onSearchFocus: vi.fn(),
      onSaveDeck: vi.fn(),
      onPlaytest: vi.fn(),
      onClearDeck: vi.fn()
    };
    renderHook(() => useShortcuts(handlers));

    press('f', { ctrlKey: true });
    press('s', { ctrlKey: true });
    press('p', { ctrlKey: true });
    press('n', { ctrlKey: true, shiftKey: true });

    expect(handlers.onSearchFocus).toHaveBeenCalledTimes(1);
    expect(handlers.onSaveDeck).toHaveBeenCalledTimes(1);
    expect(handlers.onPlaytest).toHaveBeenCalledTimes(1);
    expect(handlers.onClearDeck).toHaveBeenCalledTimes(1);
  });

  it('ignores the letters without their modifier', () => {
    const onSearchFocus = vi.fn();
    const onSaveDeck = vi.fn();
    renderHook(() => useShortcuts({ onSearchFocus, onSaveDeck }));

    press('f');
    press('s');

    expect(onSearchFocus).not.toHaveBeenCalled();
    expect(onSaveDeck).not.toHaveBeenCalled();
  });

  it('does not fire clear-deck without Shift, which would collide with new-window', () => {
    const onClearDeck = vi.fn();
    renderHook(() => useShortcuts({ onClearDeck }));

    press('n', { ctrlKey: true });

    expect(onClearDeck).not.toHaveBeenCalled();
  });

  // Suppressing the browser's own Ctrl+F when nothing handles it would leave the user with
  // no find at all.
  it('only prevents the browser default when the shortcut is handled', () => {
    const { unmount } = renderHook(() => useShortcuts({}));
    expect(press('f', { ctrlKey: true }).defaultPrevented).toBe(false);
    unmount();

    renderHook(() => useShortcuts({ onSearchFocus: vi.fn() }));
    expect(press('f', { ctrlKey: true }).defaultPrevented).toBe(true);
  });

  it('leaves Escape unprevented, so dialogs further up can still act on it', () => {
    renderHook(() => useShortcuts({ onEscape: vi.fn() }));

    expect(press('Escape').defaultPrevented).toBe(false);
  });

  it('uses Cmd on a Mac and Ctrl elsewhere', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    const onMac = vi.fn();
    const { unmount } = renderHook(() => useShortcuts({ onSearchFocus: onMac }));

    press('f', { ctrlKey: true });
    expect(onMac, 'Ctrl should not trigger the shortcut on a Mac').not.toHaveBeenCalled();
    press('f', { metaKey: true });
    expect(onMac).toHaveBeenCalledTimes(1);
    unmount();

    setUserAgent('Mozilla/5.0 (X11; Linux x86_64)');
    const onLinux = vi.fn();
    renderHook(() => useShortcuts({ onSearchFocus: onLinux }));

    press('f', { metaKey: true });
    expect(onLinux, 'Meta should not trigger the shortcut off a Mac').not.toHaveBeenCalled();
    press('f', { ctrlKey: true });
    expect(onLinux).toHaveBeenCalledTimes(1);
  });

  it('is case-insensitive, so Caps Lock does not disable the shortcuts', () => {
    const onSaveDeck = vi.fn();
    renderHook(() => useShortcuts({ onSaveDeck }));

    press('S', { ctrlKey: true });

    expect(onSaveDeck).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useShortcuts({ onEscape }));

    unmount();
    press('Escape');

    expect(onEscape).not.toHaveBeenCalled();
  });
});
