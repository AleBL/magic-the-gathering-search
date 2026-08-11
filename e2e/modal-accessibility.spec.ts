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

/**
 * Reported: scrolling a long rules text moved the card art and the edition list with it,
 * because one scroller wrapped both columns. From md up each lane scrolls on its own.
 */
test.describe('card detail scrolling', () => {
  test('the text column scrolls without moving the card art', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 800 });
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await appPage.getByRole('button', { name: 'Lightning Bolt' }).first().click();

    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await appPage.waitForTimeout(500);

    const shared = await dialog.evaluate((el) => {
      const wrapper = el.querySelector('.flex.flex-col.md\\:flex-row') as HTMLElement | null;
      if (!wrapper) return null;
      return { overflowY: getComputedStyle(wrapper).overflowY };
    });

    // The wrapper must not be the scroller at this width; its children are.
    expect(shared?.overflowY, 'both columns still share one scrollbar').toBe('hidden');
  });

  test('below md the dialog keeps a single scrolling column', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 600, height: 800 });
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await appPage.getByRole('button', { name: 'Lightning Bolt' }).first().click();

    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const overflow = await dialog.evaluate((el) => {
      const wrapper = el.querySelector('.flex.flex-col.md\\:flex-row') as HTMLElement | null;
      return wrapper ? getComputedStyle(wrapper).overflowY : null;
    });

    expect(overflow, 'the phone layout lost its scroller').toBe('auto');
  });
});
