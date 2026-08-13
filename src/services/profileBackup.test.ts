import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Deck, DeckVersion } from '../types/Deck';
import { CollectionEntry } from '../types/Collection';
import { DeckFormatType } from '../types/enums';
import { makeCard } from '../test/factories';
import { STORAGE_KEYS } from '../constants/storage';

/**
 * The whole point of this feature is the round trip: export, wipe, import, and find the
 * profile as it was. These tests stand a fake Dexie in for IndexedDB so that assertion can
 * run without a database, and so a half-written restore is visible rather than plausible.
 */

const tables = vi.hoisted(() => ({
  decks: new Map<string, Deck>(),
  collection: new Map<string, CollectionEntry>(),
  deckVersions: new Map<string, DeckVersion>()
}));

const fakeTable = <T extends { id: string }>(store: Map<string, T>) => ({
  toArray: async () => [...store.values()],
  clear: async () => store.clear(),
  bulkPut: async (rows: T[]) => rows.forEach((row) => store.set(row.id, row)),
  bulkGet: async (ids: string[]) => ids.map((id) => store.get(id))
});

const transaction = vi.hoisted(() => ({ fail: false }));

vi.mock('../db/database', () => ({
  db: {
    decks: fakeTable(tables.decks),
    collection: fakeTable(tables.collection),
    deckVersions: fakeTable(tables.deckVersions),
    // Dexie rolls back on a throw; the fake restores the snapshot it took going in.
    transaction: async (_mode: string, ..._args: unknown[]) => {
      const work = _args[_args.length - 1] as () => Promise<unknown>;
      const snapshot = {
        decks: new Map(tables.decks),
        collection: new Map(tables.collection),
        deckVersions: new Map(tables.deckVersions)
      };
      try {
        const result = await work();
        if (transaction.fail) throw new Error('write failed');
        return result;
      } catch (error) {
        tables.decks = snapshot.decks;
        tables.collection = snapshot.collection;
        tables.deckVersions = snapshot.deckVersions;
        throw error;
      }
    }
  }
}));

const { BACKUP_FORMAT, createProfileBackup, parseProfileBackup, restoreProfileBackup, serializeProfileBackup } =
  await import('./profileBackup');

const aDeck = (id: string, name = `Deck ${id}`): Deck => ({
  id,
  name,
  format: DeckFormatType.COMMANDER,
  cards: [makeCard()],
  createdAt: '2026-01-01T00:00:00.000Z'
});

const anEntry = (id: string, quantity = 2): CollectionEntry => ({
  id,
  oracleId: `oracle-${id}`,
  name: `Card ${id}`,
  set: 'tst',
  rarity: 'rare',
  quantity,
  wishlist: false,
  card: makeCard({ id }),
  updatedAt: '2026-01-01T00:00:00.000Z'
});

const aVersion = (id: string, deckId: string): DeckVersion => ({
  id,
  deckId,
  name: 'Snapshot',
  format: DeckFormatType.COMMANDER,
  cards: [makeCard()],
  createdAt: '2026-01-01T00:00:00.000Z'
});

const wipe = () => {
  tables.decks.clear();
  tables.collection.clear();
  tables.deckVersions.clear();
};

describe('profile backup', () => {
  beforeEach(() => {
    wipe();
    transaction.fail = false;
    window.localStorage.clear();
  });

  it('carries decks, collection, version history and settings', async () => {
    tables.decks.set('d1', aDeck('d1'));
    tables.collection.set('c1', anEntry('c1'));
    tables.deckVersions.set('v1', aVersion('v1', 'd1'));
    window.localStorage.setItem(STORAGE_KEYS.language, 'pt');

    const backup = await createProfileBackup();

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.decks).toHaveLength(1);
    expect(backup.collection).toHaveLength(1);
    // Version history and settings are exactly what the per-deck JSON export leaves behind.
    expect(backup.deckVersions).toHaveLength(1);
    expect(backup.settings[STORAGE_KEYS.language]).toBe('pt');
  });

  it('survives export, wipe and import', async () => {
    tables.decks.set('d1', aDeck('d1', 'Atraxa'));
    tables.collection.set('c1', anEntry('c1', 3));
    tables.deckVersions.set('v1', aVersion('v1', 'd1'));
    window.localStorage.setItem(STORAGE_KEYS.language, 'pt');

    const file = serializeProfileBackup(await createProfileBackup());

    wipe();
    window.localStorage.clear();
    expect(tables.decks.size).toBe(0);

    await restoreProfileBackup(parseProfileBackup(file)!, 'replace');

    expect([...tables.decks.values()].map((deck) => deck.name)).toEqual(['Atraxa']);
    expect([...tables.collection.values()][0].quantity).toBe(3);
    expect(tables.deckVersions.size).toBe(1);
    expect(window.localStorage.getItem(STORAGE_KEYS.language)).toBe('pt');
  });

  describe('merge', () => {
    it('keeps decks already saved and adds the backup ones', async () => {
      const file = serializeProfileBackup({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        decks: [aDeck('d1', 'From backup')],
        collection: [],
        deckVersions: [],
        settings: {}
      });

      tables.decks.set('mine', aDeck('mine', 'Already here'));
      await restoreProfileBackup(parseProfileBackup(file)!, 'merge');

      expect([...tables.decks.values()].map((deck) => deck.name).sort()).toEqual(['Already here', 'From backup']);
    });

    // A snapshot still pointing at the id it had in the old profile is orphaned history.
    it('repoints version snapshots at the reissued deck ids', async () => {
      const file = serializeProfileBackup({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        decks: [aDeck('old-id')],
        collection: [],
        deckVersions: [aVersion('v1', 'old-id')],
        settings: {}
      });

      await restoreProfileBackup(parseProfileBackup(file)!, 'merge');

      const [deck] = [...tables.decks.values()];
      const [version] = [...tables.deckVersions.values()];
      expect(deck.id).not.toBe('old-id');
      expect(version.deckId).toBe(deck.id);
    });

    // Otherwise restoring the same file twice would double a collection.
    it('takes the higher count for a printing owned on both sides', async () => {
      const file = serializeProfileBackup({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        decks: [],
        collection: [anEntry('c1', 4)],
        deckVersions: [],
        settings: {}
      });

      tables.collection.set('c1', anEntry('c1', 1));
      await restoreProfileBackup(parseProfileBackup(file)!, 'merge');
      expect(tables.collection.get('c1')!.quantity).toBe(4);

      await restoreProfileBackup(parseProfileBackup(file)!, 'merge');
      expect(tables.collection.get('c1')!.quantity).toBe(4);
    });

    it('never lowers a count the user already has', async () => {
      const file = serializeProfileBackup({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        decks: [],
        collection: [anEntry('c1', 1)],
        deckVersions: [],
        settings: {}
      });

      tables.collection.set('c1', anEntry('c1', 9));
      await restoreProfileBackup(parseProfileBackup(file)!, 'merge');
      expect(tables.collection.get('c1')!.quantity).toBe(9);
    });
  });

  it('leaves the profile untouched when the write fails', async () => {
    tables.decks.set('mine', aDeck('mine', 'Already here'));
    transaction.fail = true;

    const backup = parseProfileBackup(
      serializeProfileBackup({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        decks: [aDeck('d1', 'From backup')],
        collection: [],
        deckVersions: [],
        settings: { [STORAGE_KEYS.language]: 'es' }
      })
    )!;

    await expect(restoreProfileBackup(backup, 'replace')).rejects.toThrow();
    expect([...tables.decks.values()].map((deck) => deck.name)).toEqual(['Already here']);
    // Settings are written after the transaction, so a rollback must not leave them behind.
    expect(window.localStorage.getItem(STORAGE_KEYS.language)).toBeNull();
  });

  describe('parsing', () => {
    it.each([
      ['not json', 'nope'],
      ['another app’s json', JSON.stringify({ decks: [] })],
      ['a wrong format tag', JSON.stringify({ format: 'something-else', version: 1, decks: [], collection: [] })],
      [
        'a newer schema this build cannot honour',
        JSON.stringify({ format: BACKUP_FORMAT, version: 99, decks: [], collection: [], deckVersions: [] })
      ],
      [
        'a malformed deck',
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: 1,
          decks: [{ name: 'No cards' }],
          collection: [],
          deckVersions: []
        })
      ]
    ])('refuses %s', (_label, content) => {
      expect(parseProfileBackup(content)).toBeNull();
    });

    it('ignores storage keys the app does not own', async () => {
      const file = serializeProfileBackup({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        decks: [],
        collection: [],
        deckVersions: [],
        settings: { evil: 'value' } as never
      });

      await restoreProfileBackup(parseProfileBackup(file)!, 'merge');
      expect(window.localStorage.getItem('evil')).toBeNull();
    });
  });
});
