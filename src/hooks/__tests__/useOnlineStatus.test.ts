import { describe, expect, it, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useOnlineStatus from '../useOnlineStatus';

const setNavigatorOnLine = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
};

describe('useOnlineStatus', () => {
  afterEach(() => {
    setNavigatorOnLine(true);
  });

  it('reflects the initial navigator.onLine value', () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('flips to false on the offline event and back to true on online', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current).toBe(false);

    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(true);
  });
});
