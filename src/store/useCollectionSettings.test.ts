import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants/storage';

/**
 * The initial values are read at module load, so each case re-imports the module with
 * localStorage already in the state under test. Private mode is the reason the reads are
 * wrapped at all: `localStorage` can throw on access, and the store still has to build.
 */
const loadStore = async () => {
  vi.resetModules();
  const { useCollectionSettings } = await import('./useCollectionSettings');
  return useCollectionSettings;
};

/** Makes every localStorage read and write throw, as a locked-down browser would. */
const denyStorage = () => {
  const boom = () => {
    throw new Error('SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
};

describe('useCollectionSettings', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  describe('initial currency', () => {
    it('defaults to usd when nothing was stored', async () => {
      const store = await loadStore();
      expect(store.getState().currency).toBe('usd');
    });

    it('restores a stored eur preference', async () => {
      window.localStorage.setItem(STORAGE_KEYS.collectionCurrency, 'eur');
      const store = await loadStore();
      expect(store.getState().currency).toBe('eur');
    });

    it('falls back to usd for an unrecognized stored value', async () => {
      window.localStorage.setItem(STORAGE_KEYS.collectionCurrency, 'brl');
      const store = await loadStore();
      expect(store.getState().currency).toBe('usd');
    });

    it('falls back to usd when localStorage is unreadable', async () => {
      denyStorage();
      const store = await loadStore();
      expect(store.getState().currency).toBe('usd');
    });
  });

  describe('initial deck gap summary', () => {
    it('is on by default', async () => {
      const store = await loadStore();
      expect(store.getState().showDeckGap).toBe(true);
    });

    it('stays on for any stored value other than "false"', async () => {
      window.localStorage.setItem(STORAGE_KEYS.showDeckCollectionGap, 'true');
      const store = await loadStore();
      expect(store.getState().showDeckGap).toBe(true);
    });

    it('is off when it was explicitly turned off', async () => {
      window.localStorage.setItem(STORAGE_KEYS.showDeckCollectionGap, 'false');
      const store = await loadStore();
      expect(store.getState().showDeckGap).toBe(false);
    });

    it('is off when localStorage is unreadable', async () => {
      denyStorage();
      const store = await loadStore();
      expect(store.getState().showDeckGap).toBe(false);
    });
  });

  describe('setters', () => {
    it('persists the chosen currency', async () => {
      const store = await loadStore();

      store.getState().setCurrency('eur');

      expect(store.getState().currency).toBe('eur');
      expect(window.localStorage.getItem(STORAGE_KEYS.collectionCurrency)).toBe('eur');
    });

    it('persists the deck gap toggle as a string', async () => {
      const store = await loadStore();

      store.getState().setShowDeckGap(false);

      expect(store.getState().showDeckGap).toBe(false);
      expect(window.localStorage.getItem(STORAGE_KEYS.showDeckCollectionGap)).toBe('false');
    });

    it('still updates in memory when persistence fails', async () => {
      const store = await loadStore();
      denyStorage();

      store.getState().setCurrency('eur');
      store.getState().setShowDeckGap(false);

      expect(store.getState().currency).toBe('eur');
      expect(store.getState().showDeckGap).toBe(false);
    });
  });
});
