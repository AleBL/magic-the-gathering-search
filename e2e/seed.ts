import type { Page } from '@playwright/test';

/**
 * Writes collection entries straight into IndexedDB. Going through the UI would measure
 * the add flow instead, and thousands of clicks is not a viable setup.
 *
 * The database must already exist: raw `indexedDB.open` on a name Dexie has not created
 * yields an empty v1 with no object stores. Open the Collection tab once first.
 */
export async function seedCollection(page: Page, count: number) {
  await page.evaluate(async (total) => {
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open('MagicDecksDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('collection', 'readwrite');
      const store = transaction.objectStore('collection');
      for (let index = 0; index < total; index += 1) {
        const id = `seed-${index}`;
        const rarity = ['common', 'uncommon', 'rare', 'mythic'][index % 4];
        const colors = [['R'], ['U'], ['G'], []][index % 4];
        store.put({
          id,
          // A real collection holds several printings of the same card.
          oracleId: `oracle-${index % 400}`,
          name: `Seeded Card ${String(index).padStart(5, '0')}`,
          set: `s${index % 60}`,
          rarity,
          quantity: (index % 4) + 1,
          wishlist: index % 7 === 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
          card: {
            id,
            oracle_id: `oracle-${index % 400}`,
            name: `Seeded Card ${String(index).padStart(5, '0')}`,
            lang: 'en',
            type_line: ['Creature — Human', 'Instant', 'Land', 'Artifact'][index % 4],
            mana_cost: '{1}{R}',
            cmc: index % 8,
            colors,
            color_identity: colors,
            rarity,
            set: `s${index % 60}`,
            set_name: `Seeded Set ${index % 60}`,
            collector_number: String(index),
            image_uris: {
              small: 'https://cards.scryfall.io/small/stub.jpg',
              normal: 'https://cards.scryfall.io/normal/stub.jpg'
            },
            prices: { usd: '1.50', eur: '1.20' },
            legalities: {}
          }
        });
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }, count);
}

/** CardGrid and VirtualizedCardGrid both render one wrapper per card under a `card-grid-*`. */
export const CARD_SELECTOR = '[class*="card-grid-"] > div.animate-fadeIn';
