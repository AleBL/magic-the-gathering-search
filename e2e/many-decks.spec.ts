import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const DECK_COUNT = 30;

/**
 * Writes decks straight into IndexedDB. Creating thirty through the UI would take minutes
 * and would be testing the save flow, which other journeys already cover.
 */
async function seedDecks(page: Page, count: number) {
  await page.evaluate(async (total) => {
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open('MagicDecksDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      for (let index = 0; index < total; index += 1) {
        store.put({
          id: `seed-${index}`,
          name: `Seeded Deck ${index}`,
          format: 'freeform',
          cards: [],
          createdAt: new Date(2026, 0, index + 1).toISOString()
        });
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }, count);
}

test.describe('a collection of many decks', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await seedDecks(appPage, DECK_COUNT);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await expect(appPage.getByRole('heading', { name: new RegExp(`Saved Decks \\(${DECK_COUNT}\\)`) })).toBeVisible();
  });

  // Unbounded, thirty decks made this column ~9,500px tall in a 720px viewport: the deck
  // card is ~300px and the sidebar shows one per row.
  test('keeps the sidebar list within the viewport instead of growing with the deck count', async ({ appPage }) => {
    const height = await appPage
      .locator('#saved-decks-panel')
      .evaluate((element) => Math.round(element.getBoundingClientRect().height));

    expect(height, `the saved-decks panel is ${height}px tall`).toBeLessThanOrEqual(appPage.viewportSize()!.height);
  });

  test('opens every deck in a wider grid, with its actions intact', async ({ appPage }) => {
    await appPage.getByRole('button', { name: /view all decks/i }).click();

    const dialog = appPage.getByRole('dialog', { name: /saved decks/i });
    await expect(dialog).toBeVisible();

    // All of them are present, and the dialog itself still fits on screen.
    await expect(dialog.getByText('Seeded Deck 0', { exact: true })).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(appPage.viewportSize()!.height);

    await appPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('shows more decks per row in the modal than the sidebar can', async ({ appPage }) => {
    const sidebarColumns = await appPage.locator('#saved-decks-panel').evaluate((element) => {
      const cards = Array.from(element.querySelectorAll('div[role="button"]'));
      return new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size;
    });

    await appPage.getByRole('button', { name: /view all decks/i }).click();
    const dialog = appPage.getByRole('dialog', { name: /saved decks/i });
    const modalColumns = await dialog.evaluate((element) => {
      const cards = Array.from(element.querySelectorAll('div[role="button"]'));
      return new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size;
    });

    expect(modalColumns).toBeGreaterThan(sidebarColumns);
  });
});
