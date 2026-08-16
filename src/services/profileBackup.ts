import { db } from '../db/database';
import { STORAGE_KEYS, StorageKey } from '../constants/storage';
import { Deck, DeckVersion } from '../types/Deck';
import { CollectionEntry } from '../types/Collection';
import { newId } from '../utils/id';

/**
 * Whole-profile backup. The app has no backend: decks, collection and version history
 * exist in one IndexedDB on one machine, and the per-deck JSON / collection CSV exports
 * are partial — neither carries settings or version history.
 *
 * The envelope is versioned so a future schema can migrate an older file instead of
 * rejecting it.
 */

export const BACKUP_FORMAT = 'mtg-deckforge-backup';
export const BACKUP_VERSION = 1;

export interface ProfileBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  decks: Deck[];
  collection: CollectionEntry[];
  deckVersions: DeckVersion[];
  settings: Partial<Record<StorageKey, string>>;
}

/** `merge` never lowers a count or deletes anything; `replace` swaps the profile wholesale. */
export type RestoreMode = 'merge' | 'replace';

export interface RestoreSummary {
  decks: number;
  collection: number;
  deckVersions: number;
  settings: number;
}

function readSettings(): Partial<Record<StorageKey, string>> {
  const settings: Partial<Record<StorageKey, string>> = {};
  for (const key of Object.values(STORAGE_KEYS)) {
    const value = window.localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  return settings;
}

export async function createProfileBackup(): Promise<ProfileBackup> {
  const [decks, collection, deckVersions] = await Promise.all([
    db.decks.toArray(),
    db.collection.toArray(),
    db.deckVersions.toArray()
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    decks,
    collection,
    deckVersions,
    settings: readSettings()
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns null rather than a partial backup: restoring half a profile over a live one is
 * the failure this whole feature exists to prevent.
 */
export function parseProfileBackup(content: string): ProfileBackup | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.format !== BACKUP_FORMAT) return null;
  // Newer files may carry fields this build cannot honour; refuse rather than drop them.
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) return null;
  if (!Array.isArray(parsed.decks) || !Array.isArray(parsed.collection) || !Array.isArray(parsed.deckVersions)) {
    return null;
  }

  const decks = parsed.decks as Deck[];
  if (decks.some((deck) => !isRecord(deck) || typeof deck.name !== 'string' || !Array.isArray(deck.cards))) return null;

  const collection = parsed.collection as CollectionEntry[];
  if (collection.some((entry) => !isRecord(entry) || typeof entry.id !== 'string')) return null;

  return {
    format: BACKUP_FORMAT,
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    decks,
    collection,
    deckVersions: parsed.deckVersions as DeckVersion[],
    settings: isRecord(parsed.settings) ? (parsed.settings as Partial<Record<StorageKey, string>>) : {}
  };
}

export function serializeProfileBackup(backup: ProfileBackup): string {
  return JSON.stringify(backup, null, 2);
}

function applySettings(settings: Partial<Record<StorageKey, string>>): number {
  const owned = new Set<string>(Object.values(STORAGE_KEYS));
  let applied = 0;
  for (const [key, value] of Object.entries(settings)) {
    // Only keys this build owns: a backup is not a channel for writing arbitrary storage.
    if (!owned.has(key) || typeof value !== 'string') continue;
    window.localStorage.setItem(key, value);
    applied += 1;
  }
  return applied;
}

/**
 * Restores in a single Dexie transaction across all three tables, so a failure part-way
 * rolls the whole thing back instead of leaving a half-written profile.
 *
 * `merge` reissues deck ids so nothing already saved is overwritten, remaps version
 * snapshots onto the new ids, and takes the higher quantity for a printing already owned —
 * which makes restoring the same file twice a no-op instead of doubling a collection.
 */
export async function restoreProfileBackup(backup: ProfileBackup, mode: RestoreMode): Promise<RestoreSummary> {
  const summary = await db.transaction('rw', db.decks, db.collection, db.deckVersions, async () => {
    if (mode === 'replace') {
      await Promise.all([db.decks.clear(), db.collection.clear(), db.deckVersions.clear()]);
      await Promise.all([
        db.decks.bulkPut(backup.decks),
        db.collection.bulkPut(backup.collection),
        db.deckVersions.bulkPut(backup.deckVersions)
      ]);
      return {
        decks: backup.decks.length,
        collection: backup.collection.length,
        deckVersions: backup.deckVersions.length,
        settings: 0
      };
    }

    // `Date.now() + index` reissued ids in the same numeric space legacy decks were created
    // in, so restoring could land on the id of a deck saved in that same millisecond and
    // overwrite it on `put` — the merge mode exists precisely to never do that.
    const deckIdByOldId = new Map<string, string>();
    const decks = backup.decks.map((deck) => {
      const id = newId();
      deckIdByOldId.set(deck.id, id);
      return { ...deck, id };
    });

    // A snapshot pointing at the id it had in the old profile would be orphaned history.
    const deckVersions = backup.deckVersions.map((version) => ({
      ...version,
      id: newId(),
      deckId: deckIdByOldId.get(version.deckId) ?? version.deckId
    }));

    const existing = await db.collection.bulkGet(backup.collection.map((entry) => entry.id));
    const collection = backup.collection.map((entry, index) => {
      const current = existing[index];
      if (!current) return entry;
      return {
        ...current,
        quantity: Math.max(current.quantity, entry.quantity),
        wishlist: current.wishlist || entry.wishlist
      };
    });

    await Promise.all([
      db.decks.bulkPut(decks),
      db.collection.bulkPut(collection),
      db.deckVersions.bulkPut(deckVersions)
    ]);

    return {
      decks: decks.length,
      collection: collection.length,
      deckVersions: deckVersions.length,
      settings: 0
    };
  });

  // Outside the transaction: localStorage is not part of it, and a failed Dexie write
  // must not leave settings from a backup that was rolled back.
  return { ...summary, settings: applySettings(backup.settings) };
}
