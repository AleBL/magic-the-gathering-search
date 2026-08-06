import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/** Puts one card in the deck and opens the deck tab. */
async function withOneCardDeck(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Add copy' }).click();
  await page.getByRole('button', { name: 'My Decks' }).click();
}

/** Where focus currently is, as a readable tag + label, for failure messages. */
async function focusDescription(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body (nothing focused)';
    const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '';
    return `${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;
  });
}

test.describe('keyboard access', () => {
  test('the playtest simulator keeps Tab inside itself', async ({ appPage }) => {
    await withOneCardDeck(appPage);
    await appPage
      .getByRole('button', { name: /playtest/i })
      .first()
      .click();

    const simulator = appPage.getByRole('dialog', { name: /playtest/i });
    await expect(simulator).toBeVisible();

    for (let i = 0; i < 20; i += 1) {
      await appPage.keyboard.press('Tab');
      const escaped = await simulator.evaluate((el) => !el.contains(document.activeElement));
      if (escaped) {
        throw new Error(`focus left the simulator after ${i + 1} Tab presses, onto ${await focusDescription(appPage)}`);
      }
    }
  });

  // A trap inside a trap: a keyboard deadlock here would be worse than no trap at all.
  test('a dialog opened inside the simulator traps focus in turn, and returns it', async ({ appPage }) => {
    await withOneCardDeck(appPage);
    await appPage
      .getByRole('button', { name: /playtest/i })
      .first()
      .click();

    const simulator = appPage.getByRole('dialog', { name: /playtest/i });
    await expect(simulator).toBeVisible();

    await appPage
      .getByRole('button', { name: /shortcuts/i })
      .first()
      .click();
    const overlay = appPage.getByRole('dialog', { name: /shortcut/i });
    await expect(overlay).toBeVisible();

    for (let i = 0; i < 8; i += 1) {
      await appPage.keyboard.press('Tab');
      const escaped = await overlay.evaluate((el) => !el.contains(document.activeElement));
      expect(escaped, `focus left the shortcuts overlay after ${i + 1} Tab presses`).toBe(false);
    }

    // Escape must dismiss it and hand focus back to the simulator, not the page.
    await appPage.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    const backInside = await simulator.evaluate((el) => el.contains(document.activeElement));
    expect(backInside, 'focus did not return to the simulator after closing the inner dialog').toBe(true);
  });
});
