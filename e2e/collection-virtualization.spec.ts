import { expect, test } from './fixtures';
import { CARD_SELECTOR, seedCollection } from './seed';

/**
 * Guards the Phase 1 fix. Before it, the collection rendered every entry: 5,000 cards
 * meant 95,000 DOM nodes, 5,000 IndexedDB reads and ~426 ms scroll frames.
 */

const ENTRY_COUNT = 1500;

test.describe('the collection at size', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.goto('/');
    // Dexie has to create the object stores before raw IndexedDB writes can find them.
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(500);

    await seedCollection(appPage, ENTRY_COUNT);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.locator(CARD_SELECTOR).first().waitFor({ timeout: 60_000 });
  });

  test('renders a window of cards rather than the whole collection', async ({ appPage }) => {
    const rendered = await appPage.locator(CARD_SELECTOR).count();

    expect(rendered, `${rendered} of ${ENTRY_COUNT} cards are in the DOM`).toBeLessThan(200);
    // Still a full screen of them — a window that renders nothing is not a fix.
    expect(rendered).toBeGreaterThan(0);
  });

  // Rendering only the first screenful and breaking scroll would pass the assertion above.
  test('scrolling reaches entries far past the first screen', async ({ appPage }) => {
    const first = await appPage.locator(CARD_SELECTOR).first().innerText();

    await appPage.locator('.workspace-body').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(async () => appPage.locator(CARD_SELECTOR).first().innerText(), { timeout: 15_000 })
      .not.toBe(first);

    // The last seeded card is only reachable if the whole list is scrollable. Card names
    // are exposed as accessible names, not visible text.
    await expect(appPage.getByLabel('Seeded Card 01499').first()).toBeVisible();
  });

  test('keeps the window bounded after scrolling through the collection', async ({ appPage }) => {
    const scroller = appPage.locator('.workspace-body');
    for (let step = 0; step < 12; step += 1) {
      await scroller.evaluate((element) => {
        element.scrollTop += element.clientHeight;
      });
      await appPage.waitForTimeout(120);
    }

    // Windowing that only ever appends is just a slower way to render everything.
    const rendered = await appPage.locator(CARD_SELECTOR).count();
    expect(rendered, `${rendered} cards in the DOM after scrolling`).toBeLessThan(200);
  });
});

test.describe('ownership on a phone', () => {
  test.use({ viewport: { width: 390, height: 700 } });

  // Below sm the −/+ cluster stays hidden (mis-taps on a dense grid), but the count is the
  // whole point of this tab and used to be reachable only by opening the card modal.
  test('the collection shows how many copies are owned', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(500);
    await seedCollection(appPage, 6);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();

    const firstCard = appPage.locator(CARD_SELECTOR).first();
    await expect(firstCard).toBeVisible();
    // Visibility, not text: the badge is in the DOM either way, and `toContainText` matches
    // a `display: none` element — which is exactly the bug being guarded against.
    await expect(firstCard.getByText('1x', { exact: true })).toBeVisible();

    // The editing controls stay out of the way at this width.
    await expect(appPage.getByRole('button', { name: 'Add one copy' })).toHaveCount(0);
  });
});
