import { logger } from '../utils/logger';

// IndexedDB is best-effort storage by default: under disk pressure the browser may discard
// the whole origin without asking. `navigator.storage.persist()` is the documented way out,
// and nothing grants it automatically.

const ASKED_KEY = 'deckforge_storage_persist_asked';

export interface StorageStatus {
  /** null when the browser does not implement the Storage API. */
  persisted: boolean | null;
  usedBytes: number | null;
  quotaBytes: number | null;
}

const storageApi = (): StorageManager | null =>
  typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null;

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage = storageApi();
  if (!storage) return { persisted: null, usedBytes: null, quotaBytes: null };

  try {
    const persisted = storage.persisted ? await storage.persisted() : null;
    const estimate = storage.estimate ? await storage.estimate() : null;
    return {
      persisted,
      usedBytes: estimate?.usage ?? null,
      quotaBytes: estimate?.quota ?? null
    };
  } catch (error) {
    logger.error('Failed to read storage status:', error);
    return { persisted: null, usedBytes: null, quotaBytes: null };
  }
}

export async function requestPersistence(): Promise<boolean | null> {
  const storage = storageApi();
  if (!storage?.persist) return null;

  try {
    const granted = await storage.persist();
    window.localStorage.setItem(ASKED_KEY, 'true');
    return granted;
  } catch (error) {
    logger.error('Failed to request persistent storage:', error);
    return null;
  }
}

// Once only: Firefox shows a permission prompt here, so asking on every save would nag.
// Chrome decides silently from engagement, and asking again buys nothing there either.
export async function requestPersistenceOnce(): Promise<void> {
  const storage = storageApi();
  if (!storage?.persist || !storage.persisted) return;
  if (window.localStorage.getItem(ASKED_KEY) === 'true') return;

  try {
    if (await storage.persisted()) return;
    await requestPersistence();
  } catch (error) {
    logger.error('Failed to request persistent storage:', error);
  }
}
