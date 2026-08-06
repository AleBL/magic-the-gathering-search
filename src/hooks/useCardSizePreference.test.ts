import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCardSizePreference } from './useCardSizePreference';
import { STORAGE_KEYS } from '../constants/storage';

describe('useCardSizePreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to small with nothing stored', () => {
    const { result } = renderHook(() => useCardSizePreference());
    expect(result.current[0]).toBe('small');
  });

  it('restores a previously stored size', () => {
    localStorage.setItem(STORAGE_KEYS.cardSize, 'large');
    const { result } = renderHook(() => useCardSizePreference());
    expect(result.current[0]).toBe('large');
  });

  it('ignores a stored value that is not a known size', () => {
    localStorage.setItem(STORAGE_KEYS.cardSize, 'gigantic');
    const { result } = renderHook(() => useCardSizePreference());
    expect(result.current[0]).toBe('small');
  });

  it('persists a change so every screen sharing the hook agrees', () => {
    const { result } = renderHook(() => useCardSizePreference());

    act(() => result.current[1]('xlarge'));

    expect(localStorage.getItem(STORAGE_KEYS.cardSize)).toBe('xlarge');
    const { result: second } = renderHook(() => useCardSizePreference());
    expect(second.current[0]).toBe('xlarge');
  });
});
