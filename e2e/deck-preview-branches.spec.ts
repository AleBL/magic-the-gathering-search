import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Safety net for the DeckPreview unification (roadmap: "unify the two DeckPreview branches").
 *
 * `DeckPreview` returns from two places — one for a saved deck, one for the working deck — and
 * neither had a test. These pin what each branch actually shows, so the refactor that merges
 * them has an oracle instead of being a rewrite. Written before the refactor, on purpose.
 */

async function searchAndAdd(page: Page) {
  await page.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Add copy' }).first().click();
}

test.describe('DeckPreview — working deck branch', () => {
  test('shows the unsaved chip and the view controls, with no deck name header', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await appPage.goto('/');
    await searchAndAdd(appPage);
    await appPage.getByRole('button', { name: 'My Decks' }).click();

    // Identity of this branch: it is a deck-in-progress, not a named deck.
    await expect(appPage.getByText(/Temporary|Unsaved/i).first()).toBeVisible();

    // Shared furniture that must survive the merge.
    await expect(appPage.getByRole('button', { name: /View Mode|Display/i }).first()).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' }).first()).toBeVisible();
  });

  test('offers an empty state before any card is added', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'My Decks' }).click();

    // Only the working-deck branch has this; the saved branch always has cards.
    await expect(appPage.getByText(/add cards|no cards/i).first()).toBeVisible();
  });
});

test.describe('DeckPreview — saved deck branch', () => {
  /**
   * Seeded rather than saved through the dialog: this suite is about what the saved-deck branch
   * renders, and routing through the save flow would make it fail for unrelated reasons.
   */
  const withSavedDeck = async (page: Page, name: string) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'My Decks' }).click();
    await page.waitForTimeout(400);

    await page.evaluate(async (deckName) => {
      const database: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open('MagicDecksDB');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('decks', 'readwrite');
        transaction.objectStore('decks').put({
          id: 'branch-deck',
          name: deckName,
          format: 'modern',
          createdAt: new Date().toISOString(),
          cards: [{ id: 'bolt', name: 'Lightning Bolt', type_line: 'Instant', cmc: 1, rarity: 'common' }]
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }, name);

    await page.reload();
    await page.getByRole('button', { name: 'My Decks' }).click();
  };

  test('shows the deck name, its format and card count, and the edit-info control', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await withSavedDeck(appPage, 'Branch Test Deck');

    await appPage
      .getByRole('button', { name: /Branch Test Deck/ })
      .first()
      .click();

    // Identity of this branch: a named deck with its metadata and an edit affordance.
    await expect(appPage.getByRole('heading', { name: /Branch Test Deck/ })).toBeVisible();
    await expect(appPage.getByRole('button', { name: /Edit deck info/i })).toBeVisible();
    await expect(appPage.getByText(/1 Cards|1 cards/i).first()).toBeVisible();

    // Shared furniture, again — the merge must keep it on this side too.
    await expect(appPage.getByRole('button', { name: /View Mode|Display/i }).first()).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' }).first()).toBeVisible();
  });

  test('keeps the sticky header pinned while its card list scrolls', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 800 });
    await withSavedDeck(appPage, 'Sticky Branch Deck');
    await appPage
      .getByRole('button', { name: /Sticky Branch Deck/ })
      .first()
      .click();

    const header = appPage.locator('.panel-header-sticky').last();
    await expect(header).toBeVisible();
  });
});
