import { test, expect } from './fixtures';
import type { Page, Route } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Measurement, not a test: what importing a real, large collection costs, what the user is
 * left with when Scryfall stops answering half way, and what running the import again does
 * after that. Run it with `yarn test:e2e:bench`.
 *
 * The file comes from `yarn collection:csv`: 10k real printings, so the identifiers resolve
 * the way they do in production instead of exercising the miss path. The *responses* are
 * stubbed on purpose. The behaviour under measurement is the client's pacing and recovery,
 * and measuring it by firing uncapped POSTs at Scryfall would be committing the very thing
 * RR-18 is about.
 */

const CSV = join(process.cwd(), process.env.COLLECTION_CSV ?? 'collection-large.csv');
const CHUNK_SIZE = 75;

interface CollectionRequest {
  identifiers: Array<{ id?: string; name?: string; set?: string; collector_number?: string }>;
}

/**
 * Answers `POST /cards/collection` with one card per identifier, counting requests.
 * `rateLimitFromChunk` is mutable so one journey can fail, then be allowed to finish.
 */
function stubCollectionEndpoint(page: Page) {
  const state = {
    requests: 0,
    identifiers: 0,
    firstRequestAt: 0,
    lastRequestAt: 0,
    rateLimitFromChunk: 0 as number,
    reset() {
      state.requests = 0;
      state.identifiers = 0;
      state.firstRequestAt = 0;
      state.lastRequestAt = 0;
    }
  };

  page.route('**/api.scryfall.com/cards/collection', async (route: Route) => {
    state.requests += 1;
    state.lastRequestAt = Date.now();
    if (state.firstRequestAt === 0) state.firstRequestAt = state.lastRequestAt;

    if (state.rateLimitFromChunk > 0 && state.requests >= state.rateLimitFromChunk) {
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

/** Sum of every owned copy: what tells a resumed import apart from a duplicated one. */
async function countStoredCopies(page: Page) {
  return page.evaluate(async () => {
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open('MagicDecksDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<number>((resolve, reject) => {
      const store = database.transaction('collection', 'readonly').objectStore('collection');
      const request = store.getAll();
      request.onsuccess = () =>
        resolve((request.result as Array<{ quantity: number }>).reduce((sum, entry) => sum + entry.quantity, 0));
      request.onerror = () => reject(request.error);
    });
  });
}

/** Opens the collection tab and hands back the (hidden) CSV input. */
async function openImport(page: Page) {
  await page.getByRole('button', { name: 'Collection' }).click();
  await expect(page.getByRole('button', { name: 'Import CSV' })).toBeVisible();
  return page.locator('input[type="file"][accept*="csv"]');
}

test.describe('collection CSV import at scale', () => {
  test.skip(!existsSync(CSV), `missing ${CSV}. Run: yarn collection:csv --rows 10000`);

  test('a 10k-row import, all chunks answered', async ({ appPage }) => {
    test.setTimeout(600_000);

    const stub = stubCollectionEndpoint(appPage);
    await appPage.goto('/');
    const input = await openImport(appPage);

    const startedAt = Date.now();
    await input.setInputFiles(CSV);

    // The progress panel is the thing that was missing: a 10k import is tens of seconds long.
    await expect(appPage.getByText(/rows processed/i)).toBeVisible({ timeout: 30_000 });
    await expect(appPage.getByRole('alert')).toContainText(/cards imported/i, { timeout: 570_000 });
    const totalMs = Date.now() - startedAt;

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
          requestsPerSecond: +(stub.requests / ((stub.lastRequestAt - stub.firstRequestAt) / 1000)).toFixed(1),
          totalMs,
          storedEntries: await countStoredEntries(appPage),
          storedCopies: await countStoredCopies(appPage)
        },
        null,
        2
      )
    );
  });

  /**
   * The two halves of RR-18's fix, measured in one journey: a rate limit part way through
   * keeps what it had, and importing the same file again resolves only the rest.
   */
  test('rate limited at chunk 5, then resumed by importing the same file', async ({ appPage }) => {
    test.setTimeout(600_000);

    const stub = stubCollectionEndpoint(appPage);
    stub.rateLimitFromChunk = 5;

    await appPage.goto('/');
    const input = await openImport(appPage);

    const failedAt = Date.now();
    await input.setInputFiles(CSV);
    await expect(appPage.getByRole('alert')).toContainText(/could not be reached/i, { timeout: 570_000 });

    const partial = {
      scryfallRequests: stub.requests,
      identifiersSent: stub.identifiers,
      ms: Date.now() - failedAt,
      storedEntries: await countStoredEntries(appPage),
      storedCopies: await countStoredCopies(appPage)
    };

    // Now let it through and run the exact same file again.
    stub.rateLimitFromChunk = 0;
    stub.reset();
    await appPage.reload();
    const resumeInput = await openImport(appPage);

    const resumedAt = Date.now();
    await resumeInput.setInputFiles(CSV);
    await expect(appPage.getByRole('alert')).toContainText(/cards imported/i, { timeout: 570_000 });

    const resume = {
      scryfallRequests: stub.requests,
      identifiersSent: stub.identifiers,
      ms: Date.now() - resumedAt,
      storedEntries: await countStoredEntries(appPage),
      storedCopies: await countStoredCopies(appPage)
    };

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: 'rate limited at chunk 5, then resumed',
          partial,
          resume,
          note: 'identifiersSent on the resume excludes what the first run had already stored; storedCopies must not double'
        },
        null,
        2
      )
    );
  });
});
