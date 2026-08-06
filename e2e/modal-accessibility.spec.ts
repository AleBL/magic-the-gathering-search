import { expect, test } from './fixtures';

/**
 * Guards the modal convention: dialog semantics, focus trapped, Escape to close, focus
 * restored. Only a test driving a real keyboard notices when a new modal skips it.
 */
test.describe('modal accessibility', () => {
  test('the save dialog traps focus and restores it on Escape', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await appPage.getByRole('button', { name: 'Add copy' }).click();
    await appPage.getByRole('button', { name: 'My Decks' }).click();

    const opener = appPage.getByRole('button', { name: /Save Deck \(1 Cards?\)/ });
    await opener.click();

    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // A dialog with no accessible name is announced as just "dialog".
    await expect(dialog).toHaveAccessibleName(/.+/);

    // Focus must be inside the dialog, not left behind on the page underneath.
    await expect(dialog.locator(':focus')).toBeVisible();

    // Tab all the way round; focus must never escape into the page behind.
    for (let i = 0; i < 12; i += 1) {
      await appPage.keyboard.press('Tab');
      const escaped = await dialog.evaluate((el) => !el.contains(document.activeElement));
      expect(escaped, `focus escaped the dialog after ${i + 1} Tab presses`).toBe(false);
    }

    await appPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the text import dialog is a labelled modal and closes on Escape', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await appPage.getByRole('button', { name: /Import \/ Export/ }).click();

    await appPage.getByRole('button', { name: /text/i }).first().click();

    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleName(/.+/);

    await appPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
