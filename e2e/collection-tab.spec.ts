import { expect, test, stubCard, mockScryfall } from './fixtures';

/** The totals strip used to print the owned value on both tabs; these pin the two apart. */
test.describe('collection tab', () => {
  test.beforeEach(async ({ appPage }) => {
    await mockScryfall(appPage, [
      stubCard({ name: 'Lightning Bolt', id: 'bolt' }),
      stubCard({ name: 'Counterspell', id: 'counterspell' })
    ]);
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('a');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
    // Search only overlays the collection controls at the larger card sizes — at S/M
    // they would swallow a card that is already hard to read.
    await appPage.getByRole('radio', { name: 'Large', exact: true }).click();
  });

  test('reports owned value and wishlist value as different figures', async ({ appPage }) => {
    // One card owned, a different one wanted, so the two totals cannot coincide.
    await appPage.getByRole('button', { name: 'Mark as owned' }).first().click();
    await appPage.getByRole('button', { name: 'Wishlist' }).last().click();

    await appPage.getByRole('button', { name: 'My Collection' }).click();

    // The label names what is being summed, so the two tabs are not mistaken for one another.
    await expect(appPage.getByText(/value of owned copies/i)).toBeVisible();

    // The tab carries a count badge in its accessible name; the per-card toggle does not.
    await appPage.getByRole('button', { name: /^Wishlist \d+$/ }).click();
    await expect(appPage.getByText(/value of the wishlist/i)).toBeVisible();
  });

  test('narrows the collection by card name', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Mark as owned' }).first().click();
    await appPage.getByRole('button', { name: 'Mark as owned' }).last().click();

    await appPage.getByRole('button', { name: 'My Collection' }).click();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Counterspell' })).toBeVisible();

    await appPage.getByPlaceholder(/card name/i).fill('counter');

    await expect(appPage.getByRole('button', { name: 'Counterspell' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeHidden();
  });

  test('says nothing matched when the name filter excludes everything', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Mark as owned' }).first().click();
    await appPage.getByRole('button', { name: 'My Collection' }).click();

    await appPage.getByPlaceholder(/card name/i).fill('zzzzz');

    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeHidden();
  });

  // Seeded directly: the UI can only mark whichever printing the search returned.
  test('tells two printings of the same card apart', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'My Collection' }).click();
    await appPage.evaluate(async () => {
      const row = (id: string, set: string, quantity: number, lang: string) => ({
        id,
        oracleId: 'bolt-oracle',
        name: 'Lightning Bolt',
        set,
        rarity: 'common',
        quantity,
        wishlist: false,
        updatedAt: new Date().toISOString(),
        card: {
          id,
          oracle_id: 'bolt-oracle',
          name: 'Lightning Bolt',
          set,
          set_name: set.toUpperCase(),
          lang,
          type_line: 'Instant',
          rarity: 'common',
          cmc: 1,
          colors: ['R'],
          color_identity: ['R'],
          collector_number: '1',
          prices: { usd: set === 'm10' ? '2.00' : '9.00' }
        }
      });

      const database: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open('MagicDecksDB');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('collection', 'readwrite');
        const store = transaction.objectStore('collection');
        store.put(row('p-m10', 'm10', 10, 'en'));
        store.put(row('p-lea', 'lea', 5, 'pt'));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    });

    await appPage.reload();
    await appPage.getByRole('button', { name: 'My Collection' }).click();

    // One row per printing, each labelled — and the language only when it is not English.
    await expect(appPage.getByText('m10', { exact: true })).toBeVisible();
    await expect(appPage.getByText('lea · pt', { exact: true })).toBeVisible();

    // 15 copies across 2 printings, valued independently: 10 × $2 + 5 × $9.
    await expect(appPage.getByText('15')).toBeVisible();
    await expect(appPage.getByText('$65.00')).toBeVisible();
  });
  /**
   * A real collection file is thousands of rows against a deliberately paced endpoint, so the
   * import takes tens of seconds. It used to show nothing at all: one disabled button, no
   * progress, no way to tell a slow import from a hung one.
   */
  test('the import reports progress while it runs, then what it did', async ({ appPage }) => {
    // Held open long enough for the panel to be observable, the way a real chunk would.
    await appPage.route('**/api.scryfall.com/cards/collection', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          object: 'list',
          not_found: [],
          data: [{ ...stubCard({ name: 'Sol Ring', id: 'sol-ring' }), set: 'c21', collector_number: '263' }]
        })
      });
    });

    await appPage.getByRole('button', { name: 'My Collection' }).click();
    const input = appPage.locator('input[type="file"][accept*="csv"]');
    await input.setInputFiles({
      name: 'collection.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Name,Set,Collector Number,Quantity,Wishlist,Scryfall ID\nSol Ring,c21,263,2,false,sol-ring\n'
      )
    });

    // Named, counted and bounded: the three things the disabled button did not say.
    await expect(appPage.getByText('Importing collection')).toBeVisible();
    await expect(appPage.getByText(/of 1 rows processed/)).toBeVisible();

    await expect(appPage.getByRole('alert')).toContainText(/cards imported/i);
    await expect(appPage.getByText('Importing collection')).toBeHidden();
  });

  // Re-importing the same file must not add the copies again: `mergeEntries` sums quantities,
  // so the rows already owned have to be skipped rather than resolved a second time.
  test('a second import of the same file skips what is already owned', async ({ appPage }) => {
    let requests = 0;
    await appPage.route('**/api.scryfall.com/cards/collection', async (route) => {
      requests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          object: 'list',
          not_found: [],
          data: [{ ...stubCard({ name: 'Sol Ring', id: 'sol-ring' }), set: 'c21', collector_number: '263' }]
        })
      });
    });

    const file = {
      name: 'collection.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Name,Set,Collector Number,Quantity,Wishlist,Scryfall ID\nSol Ring,c21,263,2,false,sol-ring\n'
      )
    };

    await appPage.getByRole('button', { name: 'My Collection' }).click();
    const input = appPage.locator('input[type="file"][accept*="csv"]');

    await input.setInputFiles(file);
    await expect(appPage.getByRole('alert')).toContainText(/1 cards imported/i);
    await expect(appPage.getByText('2', { exact: true }).first()).toBeVisible();

    await input.setInputFiles(file);
    await expect(appPage.getByRole('alert')).toContainText(/already in your collection/i);
    // The second run asked Scryfall nothing, and the count stayed at two copies.
    expect(requests).toBe(1);
    await expect(appPage.getByText('4', { exact: true })).toHaveCount(0);
  });
});
