import { describe, it, expect, afterEach, vi } from 'vitest';
import { newId } from './id';

/** RFC 4122 v4: the version nibble is fixed at 4 and the variant nibble is 8-b. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Shadows `crypto.randomUUID` with an own property so the helper takes its
 * `getRandomValues` branch, which is what a build served over plain http runs.
 * jsdom exposes `randomUUID` on the prototype, hence the shadow instead of a delete.
 */
function withoutRandomUUID(run: () => void): void {
  Reflect.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    run();
  } finally {
    Reflect.deleteProperty(globalThis.crypto, 'randomUUID');
  }
}

describe('newId', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a v4 uuid', () => {
    expect(newId()).toMatch(UUID_V4);
  });

  it('never repeats across a batch', () => {
    const ids = Array.from({ length: 10000 }, () => newId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The regression the helper exists for: ids used to be `Date.now()`, so two decks
   * saved inside the same millisecond shared a key and `put` kept only the last one.
   * Freezing the clock is what tells a timestamp-derived id apart from a random one.
   */
  it('does not derive identity from the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
    const ids = Array.from({ length: 1000 }, () => newId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe('when randomUUID is unavailable', () => {
    it('falls back to getRandomValues and still returns unique v4 uuids', () => {
      withoutRandomUUID(() => {
        const ids = Array.from({ length: 10000 }, () => newId());
        expect(ids.filter((id) => !UUID_V4.test(id))).toEqual([]);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });

    it('restores the primary path once a secure context is available again', () => {
      withoutRandomUUID(() => undefined);
      expect(typeof crypto.randomUUID).toBe('function');
      expect(newId()).toMatch(UUID_V4);
    });
  });
});
