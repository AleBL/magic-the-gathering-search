import { test, expect } from './fixtures';
import type { Page, Route } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Measurement, not a test: what importing a real, large collection costs, and what the user
 * is left with when Scryfall stops answering half way. Run it with `yarn test:e2e:bench`.
 *
 * The file comes from `node scripts/generate-collection-csv.mjs`: 10k real printings, so the
 * identifiers resolve the way they do in production instead of exercising the miss path.
 * The *responses* are stubbed on purpose. The behaviour under measurement is the client's
 * fan-out, and measuring it by firing 134 uncapped POSTs at Scryfall would be committing the
 * very thing RR-18 is about.
 */

const CSV = join(process.cwd(), process.env.COLLECTION_CSV ?? 'collection-large.csv');
const CHUNK_SIZE = 75;

interface CollectionRequest {
  identifiers: Array<{ id?: string; name?: string; set?: string; collector_number?: string }>;
}

/**
 * Answers `POST /cards/collection` with one card per identifier, counting the requests and
 * optionally failing from a given chunk onwards. Every row in the generated CSV carries a
 * Scryfall id, so resolution goes through `byId` exactly as it does with the real endpoint.
 */
function stubCollectionEndpoint(page: Page, options: { rateLimitFromChunk?: number } = {}) {
  const state = { requests: 0, identifiers: 0, firstRequestAt: 0, lastRequestAt: 0 };

  page.route('**/api.scryfall.com/cards/collection', async (route: Route) => {
    state.requests += 1;
    state.lastRequestAt = Date.now();
    if (state.firstRequestAt === 0) state.firstRequestAt = state.lastRequestAt;

    if (options.rateLimitFromChunk && state.requests >= options.rateLimitFromChunk) {
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ object: 'error' }) });
      return;
    }

    const body = route.request().postDataJSON() as CollectionRequest;
    state.identifiers += body.identifiers.length;

    const data = body.identifiers.map((identifier, index) => ({
      object: 'card',
      id: identifier.id ?? `stub-${state.requests}-${index}`,
      oracle_id: `oracle-${identifier.id ?? index}`,
      name: identifier.name ?? `Card ${identifier.id?.slice(0, 8) ?? index}`,
      lang: 'en',
      set: identifier.set ?? 'tst',
      set_name: 'Test Set',
      collector_number: identifier.collector_number ?? String(index),
      type_line: 'Creature — Human',
      mana_cost: '{1}{R}',
      cmc: 2,
      colors: ['R'],
      color_identity: ['R'],
      rarity: 'common',
      image_uris: { small: 'https://cards.scryfall.io/small/stub.jpg' },
      prices: { usd: '1.00', eur: '1.00' },
      legalities: {}
    }));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ object: 'list', not_found: [], data })
    });
  });

  return state;
}

/** Entries actually persisted, which is the only honest answer to "did the import work". */
async function countStoredEntries(page: Page) {
  return page.evaluate(async () => {
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open('MagicDecksDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<number>((resolve, reject) => {
      const store = database.transaction('collection', 'readonly').objectStore('collection');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

/** Opens the collection tab and hands back the (hidden) CSV input. */
async function openImport(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Collection' }).click();
  // Dexie has to have created the database before anything can be counted in it.
  await expect(page.getByRole('button', { name: 'Import CSV' })).toBeVisible();
  return page.locator('input[type="file"][accept*="csv"]');
}

test.describe('collection CSV import at scale', () => {
  test.skip(!existsSync(CSV), `missing ${CSV}. Run: node scripts/generate-collection-csv.mjs --rows 10000`);

  test('a 10k-row import, all chunks answered', async ({ appPage }) => {
    test.setTimeout(600_000);

    const stub = stubCollectionEndpoint(appPage);
    const input = await openImport(appPage);

    const startedAt = Date.now();
    await input.setInputFiles(CSV);

    // The toast naming a count is the app's own statement that the import finished.
    await expect(appPage.getByRole('alert')).toContainText(/cards imported/i, { timeout: 570_000 });
    const totalMs = Date.now() - startedAt;

    const stored = await countStoredEntries(appPage);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: 'happy path',
          csv: CSV,
          chunkSize: CHUNK_SIZE,
          scryfallRequests: stub.requests,
          identifiersSent: stub.identifiers,
          requestWindowMs: stub.lastRequestAt - stub.firstRequestAt,
          totalMs,
          storedEntries: stored
        },
        null,
        2
      )
    );
  });

  // The failure mode RR-18 describes: the resolve loop has no retry, so one 429 rejects the
  // whole promise and every chunk already paid for is thrown away.
  test('a 10k-row import that is rate limited at chunk 5', async ({ appPage }) => {
    test.setTimeout(600_000);

    const stub = stubCollectionEndpoint(appPage, { rateLimitFromChunk: 5 });
    const input = await openImport(appPage);

    const startedAt = Date.now();
    await input.setInputFiles(CSV);

    await expect(appPage.getByRole('alert')).toContainText(/too many requests/i, { timeout: 570_000 });
    const totalMs = Date.now() - startedAt;

    const stored = await countStoredEntries(appPage);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: 'rate limited at chunk 5',
          scryfallRequests: stub.requests,
          identifiersSent: stub.identifiers,
          totalMs,
          storedEntries: stored,
          note: 'entries resolved before the 429 are discarded: the import is all-or-nothing'
        },
        null,
        2
      )
    );
  });
});
