import { describe, expect, it, vi, afterEach } from 'vitest';
import { registerShortcutHandler, ShortcutHandler, ShortcutHandlerOptions } from './keyboardRegistry';

/**
 * What this pins is arbitration, not any single shortcut: which handler hears a key when
 * several are registered, and which ones are kept from hearing it at all. The bugs it
 * guards against are the ones the per-component `window.addEventListener('keydown')` era
 * produced — one Escape closing two surfaces, and app shortcuts firing under a fullscreen
 * mode that covers them.
 */

const cleanups: Array<() => void> = [];

const register = (handle: ShortcutHandler, options: ShortcutHandlerOptions) => {
  const unregister = registerShortcutHandler(handle, options);
  cleanups.push(unregister);
  return unregister;
};

const press = (key = 'Escape', modifiers: Partial<KeyboardEventInit> = {}) => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...modifiers });
  window.dispatchEvent(event);
  return event;
};

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.restoreAllMocks();
});

describe('keyboardRegistry', () => {
  it('delivers the event to a registered handler', () => {
    const handle = vi.fn();
    register(handle, { layer: 'app' });

    press('k', { ctrlKey: true });

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0][0]).toBeInstanceOf(KeyboardEvent);
  });

  it('gives the key to the highest layer first and stops when it is consumed', () => {
    const app = vi.fn(() => true);
    const playtest = vi.fn(() => true);
    const modal = vi.fn(() => true);
    // Registered bottom-up on purpose: the order must come from the layer, not from who
    // mounted first.
    register(app, { layer: 'app' });
    register(playtest, { layer: 'playtest' });
    register(modal, { layer: 'modal' });

    press();

    expect(modal).toHaveBeenCalledTimes(1);
    expect(playtest).not.toHaveBeenCalled();
    expect(app).not.toHaveBeenCalled();
  });

  it('falls through to the layer below for a key the top one does not claim', () => {
    const app = vi.fn(() => true);
    const modal = vi.fn(() => false);
    register(app, { layer: 'app' });
    register(modal, { layer: 'modal' });

    press('k', { ctrlKey: true });

    expect(modal).toHaveBeenCalledTimes(1);
    expect(app, 'Ctrl+K must still reach the app so the palette can toggle shut').toHaveBeenCalledTimes(1);
  });

  it('prefers the newest handler of a layer, so the surface opened last answers Escape', () => {
    const firstDialog = vi.fn(() => true);
    const secondDialog = vi.fn(() => true);
    register(firstDialog, { layer: 'modal' });
    register(secondDialog, { layer: 'modal' });

    press();

    expect(secondDialog).toHaveBeenCalledTimes(1);
    expect(firstDialog, 'one Escape closing two stacked surfaces is the bug this replaces').not.toHaveBeenCalled();
  });

  it('hides lower layers behind a blocking handler, even for keys it ignores', () => {
    const app = vi.fn(() => true);
    const playtest = vi.fn(() => false);
    register(app, { layer: 'app' });
    register(playtest, { layer: 'playtest', blocksLowerLayers: true });

    press('k', { ctrlKey: true });

    expect(playtest).toHaveBeenCalledTimes(1);
    expect(app).not.toHaveBeenCalled();
  });

  it('lets a higher layer through a blocking one, so dialogs still work inside the playtest', () => {
    const playtest = vi.fn(() => false);
    const modal = vi.fn(() => true);
    register(playtest, { layer: 'playtest', blocksLowerLayers: true });
    register(modal, { layer: 'modal' });

    press();

    expect(modal).toHaveBeenCalledTimes(1);
    expect(playtest).not.toHaveBeenCalled();
  });

  it('still runs the rest of the blocking handler own layer', () => {
    const other = vi.fn(() => true);
    const blocking = vi.fn(() => false);
    register(other, { layer: 'playtest' });
    register(blocking, { layer: 'playtest', blocksLowerLayers: true });

    press();

    expect(blocking).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('skips a handler that another one unregistered mid-dispatch', () => {
    const belowSpy = vi.fn(() => true);
    const unregisterBelow = register(belowSpy, { layer: 'app' });
    // Closing a dialog unmounts what is under it while the same keypress is still being
    // dispatched: React flushes the state update from a discrete event synchronously.
    register(
      () => {
        unregisterBelow();
        return false;
      },
      { layer: 'modal' }
    );

    press();

    expect(belowSpy).not.toHaveBeenCalled();
  });

  it('stops listening on the window once the last handler is gone', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const handle = vi.fn(() => true);
    const unregisterFirst = register(handle, { layer: 'app' });
    const unregisterSecond = register(
      vi.fn(() => false),
      { layer: 'modal' }
    );

    unregisterSecond();
    expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0);

    unregisterFirst();
    expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);

    press();
    expect(handle).not.toHaveBeenCalled();
  });

  it('ignores a second unregister call', () => {
    const unregister = register(
      vi.fn(() => true),
      { layer: 'app' }
    );
    const survivor = vi.fn(() => true);
    unregister();
    unregister();
    register(survivor, { layer: 'app' });

    press();

    expect(survivor, 'a double unregister must not drop somebody else from the stack').toHaveBeenCalledTimes(1);
  });
});
