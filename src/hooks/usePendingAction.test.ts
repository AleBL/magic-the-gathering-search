import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { dispatchPendingAction, usePendingAction } from './usePendingAction';
import { useDeckStore } from '../store/useDeckStore';

const pending = () => useDeckStore.getState().pendingAction;

describe('usePendingAction', () => {
  beforeEach(() => {
    useDeckStore.setState({ pendingAction: null });
  });

  it('runs the handler for the dispatched command and clears the channel', () => {
    const onClear = vi.fn();
    renderHook(() => usePendingAction({ 'clear-deck': onClear }));

    act(() => dispatchPendingAction('clear-deck'));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(pending()).toBeNull();
  });

  it('ignores commands it has no handler for', () => {
    const onClear = vi.fn();
    renderHook(() => usePendingAction({ 'clear-deck': onClear }));

    act(() => dispatchPendingAction('playtest-deck'));

    expect(onClear).not.toHaveBeenCalled();
  });

  // The channel is shared: each command is owned by exactly one mounted component.
  // Clearing a command nobody here handles would swallow it before its owner ran.
  it('leaves an unhandled command on the channel for its owner', () => {
    renderHook(() => usePendingAction({ 'clear-deck': vi.fn() }));

    act(() => dispatchPendingAction('focus-search'));

    expect(pending()).toBe('focus-search');
  });

  it('runs only the handler that matches, when several are registered', () => {
    const onPlaytest = vi.fn();
    const onProxies = vi.fn();
    renderHook(() => usePendingAction({ 'playtest-deck': onPlaytest, 'print-proxies': onProxies }));

    act(() => dispatchPendingAction('print-proxies'));

    expect(onPlaytest).not.toHaveBeenCalled();
    expect(onProxies).toHaveBeenCalledTimes(1);
  });

  // Handlers are read through a ref, so this pins the reason that is safe: the
  // handler that runs must be the latest one, not the one from the first render.
  it('runs the handler from the most recent render', () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = renderHook(({ handler }) => usePendingAction({ 'clear-deck': handler }), {
      initialProps: { handler: stale }
    });

    rerender({ handler: fresh });
    act(() => dispatchPendingAction('clear-deck'));

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('runs the handler once per dispatch, not once per re-render', () => {
    const onClear = vi.fn();
    const { rerender } = renderHook(() => usePendingAction({ 'clear-deck': onClear }));

    act(() => dispatchPendingAction('clear-deck'));
    rerender();
    rerender();

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe the dispatcher to the store', () => {
    // dispatchPendingAction is a plain function, callable outside a component.
    expect(() => dispatchPendingAction('save-deck')).not.toThrow();
    expect(pending()).toBe('save-deck');
  });
});
