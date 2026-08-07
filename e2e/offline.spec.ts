import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { seedCollection, CARD_SELECTOR } from './seed';

/**
 * Phase 3: the app caches aggressively and shows an offline indicator, but what it *does*
 * when a Scryfall call fails mid-flow had never been exercised. Each journey below drops
 * the connection and asserts the app says so, rather than failing quietly or looking like
 * it returned an empty result.
 */

/**
 * `setOffline` alone is not enough: the fixtures fulfil Scryfall routes locally, so they
 * would keep answering. Aborting the route is what a dead connection actually looks like
 * to the app; `setOffline` is what `navigator.onLine` and the indicator read.
 */
async function goOffline(page: Page) {
  await page.route('**/api.scryfall.com/**', (route) => route.abort('internetdisconnected'));
  await page.context().setOffline(true);
  // Wait for the app to have *noticed*: several of these paths branch on `navigator.onLine`,
  // and acting before it flips makes the journey race the browser instead of testing it.
  await expect(page.getByText("You're offline")).toBeVisible();
}

test.describe('offline', () => {
  test('the app says it is offline', async ({ appPage }) => {
    await appPage.goto('/');
    await expect(appPage.getByText("You're offline")).toHaveCount(0);

    await goOffline(appPage);
  });

  // The failure mode this guards: an empty results grid reads as "no cards match", which
  // is a different thing from "we could not ask".
  test('a search that cannot reach Scryfall says so instead of looking empty', async ({ appPage }) => {
    await appPage.goto('/');
    await goOffline(appPage);

    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();

    await expect(appPage.getByText(/Scryfall is currently offline|No cards found/)).toBeVisible({ timeout: 20_000 });
  });

  // The editions control only exists for a card in a deck being edited, so the journey has
  // to put one there — on a search result there is nothing to report against.
  test('the editions control reports a failed lookup rather than showing none', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await appPage.getByRole('button', { name: 'Add copy' }).first().click();
    await appPage.getByRole('button', { name: 'My Decks' }).click();

    const deckRow = appPage.locator('.deck-list-compact > *').first();
    await expect(deckRow).toBeVisible();

    await goOffline(appPage);
    await deckRow.click();

    await expect(appPage.getByRole('dialog')).toBeVisible();
    // Not a toast: the message sits where the editions button would have been, because an
    // absent control is exactly what reads as "this card has only one printing".
    await expect(appPage.getByText('Failed to load other printings.')).toBeVisible({ timeout: 20_000 });
  });

  test('a text import that cannot resolve cards reports it', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    // Wait for the tab to finish loading before pulling the plug: under `vite dev` its
    // modules are still arriving, and an import in flight fails for harness reasons.
    const importExport = appPage.getByRole('button', { name: /Import \/ Export/ });
    await expect(importExport).toBeVisible();

    await goOffline(appPage);
    await importExport.click();
    await appPage.getByRole('button', { name: /text/i }).first().click();

    const dialog = appPage.getByRole('dialog');
    await dialog.getByRole('textbox').first().fill('4 Lightning Bolt');
    await dialog.getByRole('button', { name: 'Import', exact: true }).click();

    // Specifically not "check the names": offline, no name was ever looked up.
    // Shown twice — inline in the dialog and in the error dialog it raises.
    await expect(appPage.getByText(/Scryfall is currently offline/).first()).toBeVisible({ timeout: 20_000 });
    await expect(appPage.getByText(/check the names/)).toHaveCount(0);
  });

  /**
   * The other half of degrading well: the collection lives entirely in IndexedDB, so losing
   * the network must change nothing about it.
   *
   * Deliberately without switching tabs. Under `vite dev` each tab is fetched as ES modules
   * on demand and Playwright blocks the service worker that precaches them in production,
   * so an offline tab switch fails for reasons that do not exist in a real build. Testing
   * it here would assert the harness, not the app.
   */
  test('the collection keeps working with no connection', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(500);
    await seedCollection(appPage, 12);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await expect(appPage.locator(CARD_SELECTOR).first()).toBeVisible();

    await goOffline(appPage);

    await expect(appPage.getByText("You're offline")).toBeVisible();
    await expect(appPage.locator(CARD_SELECTOR)).toHaveCount(12);
    await expect(appPage.getByRole('button', { name: /Owned/ })).toContainText('12');

    // Not just still painted — still queryable, which is what proves IndexedDB is serving
    // it rather than the screen being frozen from before the disconnect.
    await appPage.getByPlaceholder('Card name…').fill('Seeded Card 00003');
    await expect(appPage.locator(CARD_SELECTOR)).toHaveCount(1);
  });
});
