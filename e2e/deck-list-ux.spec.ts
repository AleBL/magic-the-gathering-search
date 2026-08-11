import { expect, test } from './fixtures';
import { seedDecks } from './seed';
import type { Page } from '@playwright/test';

/** Four reported UI problems in the saved-decks surfaces, each guarded here. */

const DECK_NAMES = Array.from({ length: 12 }, (_, i) => `Deck ${String(i + 1).padStart(2, '0')}`);

async function withDecks(page: Page) {
  await page.goto('/');
  // Dexie must create the stores before the seed can write to them.
  await page.getByRole('button', { name: 'My Decks' }).click();
  await seedDecks(page, DECK_NAMES);
  await page.reload();
  await page.getByRole('button', { name: 'My Decks' }).click();
  const toggle = page.getByRole('button', { name: /Saved decks/i }).first();
  if (await toggle.isVisible().catch(() => false)) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
}

test.describe('all-decks modal', () => {
  test('a double click picks the deck and closes the modal', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1280, height: 900 });
    await withDecks(appPage);

    await appPage.getByRole('button', { name: /View all decks/i }).click();
    const modal = appPage.getByRole('dialog', { name: /Saved decks/i });
    await expect(modal).toBeVisible();

    await modal
      .getByRole('button', { name: /Deck 05/ })
      .first()
      .dblclick();

    // Closing is the point: a single click only previewed the choice behind the modal.
    await expect(modal).toBeHidden();
  });

  test('a single click selects without closing, so the choice can be previewed', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1280, height: 900 });
    await withDecks(appPage);

    await appPage.getByRole('button', { name: /View all decks/i }).click();
    const modal = appPage.getByRole('dialog', { name: /Saved decks/i });
    await modal
      .getByRole('button', { name: /Deck 05/ })
      .first()
      .click();

    await expect(modal).toBeVisible();
  });

  // Reported: near the bottom of the modal the menu opened downward, growing the dialog's
  // scroll area instead of overlaying it.
  test('the more-actions menu opens upward when there is no room below', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1280, height: 700 });
    await withDecks(appPage);

    await appPage.getByRole('button', { name: /View all decks/i }).click();
    const modal = appPage.getByRole('dialog', { name: /Saved decks/i });
    await expect(modal).toBeVisible();

    // Scroll to the end so the last deck's trigger sits against the bottom edge.
    const scroller = modal.locator('div.overflow-y-auto').first();
    await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await appPage.waitForTimeout(300);

    const trigger = modal.getByRole('button', { name: /More actions/i }).last();
    await trigger.click();

    const menu = modal.getByRole('menu').first();
    await expect(menu).toBeVisible();

    const fits = await menu.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.bottom <= window.innerHeight + 1 && rect.top >= -1;
    });
    expect(fits, 'the actions menu opened off-screen instead of flipping upward').toBe(true);
  });
});

test.describe('deck page scrolling', () => {
  /**
   * The report: reading a long decklist scrolled the page, which dragged the saved-decks lane
   * along with it. The fix gives each lane its own scroller at lg+, so the page itself stops
   * scrolling — that is what this asserts, since a programmatic scrollTo cannot reproduce the
   * wheel-driven scroll chaining that was the symptom.
   */
  test('a long decklist scrolls its own pane, not the page', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await withDecks(appPage);

    // A deck long enough that its pane must scroll.
    await appPage.evaluate(async () => {
      const database: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open('MagicDecksDB');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('decks', 'readwrite');
        transaction.objectStore('decks').put({
          id: 'long-deck',
          name: 'Long Deck',
          format: 'freeform',
          createdAt: new Date().toISOString(),
          cards: Array.from({ length: 90 }, (_, i) => ({
            id: `long-${i}`,
            name: `Card ${i}`,
            type_line: 'Creature',
            image_uris: { art_crop: 'https://cards.scryfall.io/art_crop/stub.jpg' }
          }))
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    });
    await appPage.reload();
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await appPage
      .getByRole('button', { name: /Long Deck/ })
      .first()
      .click();
    await appPage.waitForTimeout(600);

    // `.workspace-body` wraps *both* lanes, so anything scrolling there moves the saved-decks
    // list along with the decklist — the reported symptom. The document itself never scrolled.
    const layout = await appPage.evaluate(() => {
      const shared = document.querySelector('.workspace-body') as HTMLElement | null;
      const deckPane = document.querySelector('.workspace-body div.overflow-y-auto:not(#saved-decks-panel div)');
      return {
        sharedOverflow: shared ? shared.scrollHeight - shared.clientHeight : -1,
        paneScrolls: [...document.querySelectorAll<HTMLElement>('div')].some(
          (el) => getComputedStyle(el).overflowY === 'auto' && el.scrollHeight > el.clientHeight + 1
        ),
        hasDeckPane: Boolean(deckPane)
      };
    });

    // A few pixels of slack are normal; hundreds mean both lanes are riding one scrollbar.
    expect(
      layout.sharedOverflow,
      `the shared wrapper scrolls by ${layout.sharedOverflow}px, dragging both lanes together`
    ).toBeLessThan(40);
    expect(layout.paneScrolls, 'no pane has its own scrollbar').toBe(true);
  });

  // The fix is scoped to lg+; below it the page must stay one ordinary scrolling column.
  test('below lg the deck page stays a single column in normal flow', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 820, height: 900 });
    await withDecks(appPage);

    const capped = await appPage.evaluate(() => {
      const grid = document.querySelector('.deck-manager-content, main') as HTMLElement | null;
      if (!grid) return false;
      // No lane should be locked to the viewport height at this width.
      return [...document.querySelectorAll<HTMLElement>('div')].some((el) => {
        const style = getComputedStyle(el);
        return style.overflowY === 'hidden' && el.getBoundingClientRect().height >= window.innerHeight - 1;
      });
    });

    expect(capped, 'a viewport-height lock leaked below the lg breakpoint').toBe(false);
  });
});
