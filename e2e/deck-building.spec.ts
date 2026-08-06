import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const search = 'Search cards...';

/**
 * Saving pops a "Deck saved successfully" confirmation over the page. Asserting on the
 * deck list while it is still up reads the screen mid-flow and races the dismissal, so
 * do what a user does: acknowledge it, then look at the list.
 */
async function confirmSaved(page: Page) {
  const success = page.getByRole('dialog');
  await expect(success).toContainText(/saved/i);
  await success.getByRole('button', { name: /^ok$/i }).click();
  await expect(success).toBeHidden();
}

test.describe('deck building', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: search }).fill('bolt');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
  });

  test('a searched card can be added to the deck and saved', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Add copy' }).click();
    await appPage.getByRole('button', { name: 'My Decks' }).click();

    // The card count in the button label is the deck's own report of what it holds.
    const saveButton = appPage.getByRole('button', { name: /Save Deck \(1 Cards?\)/ });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').first().fill('E2E Test Deck');
    await dialog.getByRole('button', { name: /save/i }).click();

    await confirmSaved(appPage);

    // Saving hands the new deck straight to the editor, so the saved-decks list is no
    // longer on screen — the toolbar switching to "Save Deck <name>" is what says the
    // deck now exists and is open. (Persistence itself is the next test's job.)
    await expect(appPage.getByRole('button', { name: /Save Deck "E2E Test Deck"/ })).toBeVisible();
  });

  test('a saved deck survives a reload', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Add copy' }).click();
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await appPage.getByRole('button', { name: /Save Deck \(1 Cards?\)/ }).click();

    const dialog = appPage.getByRole('dialog');
    await dialog.getByRole('textbox').first().fill('Persisted Deck');
    await dialog.getByRole('button', { name: /save/i }).click();
    await confirmSaved(appPage);

    // Decks live in IndexedDB, not component state — a reload is the only thing that
    // actually proves the write landed rather than the UI just echoing the input back.
    // It also drops the in-memory editing state, so the saved-decks list comes back.
    await appPage.reload();
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await expect(appPage.getByRole('heading', { name: /Saved Decks \(1\)/ })).toBeVisible();
    await expect(appPage.getByText('Persisted Deck')).toBeVisible();
  });
});
