import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readStorageStatus, requestPersistence, requestPersistenceOnce } from '../storagePersistence';

/**
 * The Storage API is optional and partially implemented across browsers, so every branch
 * here is a real deployment target: no API at all, `persist` without `persisted`, a
 * throwing implementation. Each is stubbed rather than assumed away.
 */

const ASKED_KEY = 'deckforge_storage_persist_asked';

/** Installs a navigator exposing only the Storage API members passed in. */
const stubStorage = (storage: Partial<StorageManager> | null): void => {
  vi.stubGlobal('navigator', storage ? { storage } : {});
};

describe('storagePersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('readStorageStatus', () => {
    it('reports nulls when there is no navigator at all', async () => {
      vi.stubGlobal('navigator', undefined);

      await expect(readStorageStatus()).resolves.toEqual({ persisted: null, usedBytes: null, quotaBytes: null });
    });

    it('reports nulls when the browser has no Storage API', async () => {
      stubStorage(null);

      await expect(readStorageStatus()).resolves.toEqual({ persisted: null, usedBytes: null, quotaBytes: null });
    });

    it('returns the persisted flag and usage figures', async () => {
      stubStorage({
        persisted: async () => true,
        estimate: async () => ({ usage: 1024, quota: 4096 })
      });

      await expect(readStorageStatus()).resolves.toEqual({ persisted: true, usedBytes: 1024, quotaBytes: 4096 });
    });

    it('reports nulls for the members the browser does not implement', async () => {
      stubStorage({ persist: async () => true });

      await expect(readStorageStatus()).resolves.toEqual({ persisted: null, usedBytes: null, quotaBytes: null });
    });

    it('reports nulls when the estimate omits usage and quota', async () => {
      stubStorage({ persisted: async () => false, estimate: async () => ({}) });

      await expect(readStorageStatus()).resolves.toEqual({ persisted: false, usedBytes: null, quotaBytes: null });
    });

    it('swallows a throwing Storage API and reports nulls', async () => {
      stubStorage({
        persisted: async () => {
          throw new Error('SecurityError');
        }
      });

      await expect(readStorageStatus()).resolves.toEqual({ persisted: null, usedBytes: null, quotaBytes: null });
    });
  });

  describe('requestPersistence', () => {
    it('returns null when the browser cannot grant persistence', async () => {
      stubStorage({ persisted: async () => false });

      await expect(requestPersistence()).resolves.toBeNull();
      expect(window.localStorage.getItem(ASKED_KEY)).toBeNull();
    });

    it('returns null when there is no Storage API', async () => {
      stubStorage(null);

      await expect(requestPersistence()).resolves.toBeNull();
    });

    it('records that the user was asked, whatever the answer', async () => {
      stubStorage({ persist: async () => false });

      await expect(requestPersistence()).resolves.toBe(false);
      expect(window.localStorage.getItem(ASKED_KEY)).toBe('true');
    });

    it('returns the granted flag', async () => {
      stubStorage({ persist: async () => true });

      await expect(requestPersistence()).resolves.toBe(true);
    });

    it('returns null and leaves the asked flag unset when the request throws', async () => {
      stubStorage({
        persist: async () => {
          throw new Error('NotAllowedError');
        }
      });

      await expect(requestPersistence()).resolves.toBeNull();
      expect(window.localStorage.getItem(ASKED_KEY)).toBeNull();
    });
  });

  describe('requestPersistenceOnce', () => {
    it('does nothing when the browser cannot grant persistence', async () => {
      const persisted = vi.fn(async () => false);
      stubStorage({ persisted });

      await requestPersistenceOnce();

      expect(persisted).not.toHaveBeenCalled();
    });

    it('does nothing when the browser cannot report the current state', async () => {
      const persist = vi.fn(async () => true);
      stubStorage({ persist });

      await requestPersistenceOnce();

      expect(persist).not.toHaveBeenCalled();
    });

    it('does not ask a second time', async () => {
      window.localStorage.setItem(ASKED_KEY, 'true');
      const persist = vi.fn(async () => true);
      const persisted = vi.fn(async () => false);
      stubStorage({ persist, persisted });

      await requestPersistenceOnce();

      expect(persisted).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    });

    it('does not ask when storage is already persistent', async () => {
      const persist = vi.fn(async () => true);
      stubStorage({ persist, persisted: async () => true });

      await requestPersistenceOnce();

      expect(persist).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(ASKED_KEY)).toBeNull();
    });

    it('asks once when storage is not yet persistent', async () => {
      const persist = vi.fn(async () => true);
      stubStorage({ persist, persisted: async () => false });

      await requestPersistenceOnce();

      expect(persist).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(ASKED_KEY)).toBe('true');
    });

    it('swallows a throwing state check', async () => {
      const persist = vi.fn(async () => true);
      stubStorage({
        persist,
        persisted: async () => {
          throw new Error('SecurityError');
        }
      });

      await expect(requestPersistenceOnce()).resolves.toBeUndefined();
      expect(persist).not.toHaveBeenCalled();
    });
  });
});
