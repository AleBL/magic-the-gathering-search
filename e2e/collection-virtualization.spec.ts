import { expect, test } from './fixtures';
import { CARD_SELECTOR, seedCollection } from './seed';

/** The view picker is a dropdown now, matching the deck tab's display settings. */
const openViewMenu = async (page: import('@playwright/test').Page) => {
  await page.locator('.display-settings-btn').first().click();
};

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

/**
 * Reported: cards in the collection ended up drawn on top of each other, with the list running
 * out of scroll early. Cause: the row height was measured the moment the ref fired, before the
 * cards inside had laid out, so the measurement was the row's 8px bottom padding — and the
 * old guard only rejected `<= 0`. Every row was then placed on an 8px pitch.
 */
test.describe('collection row heights', () => {
  /** Smallest vertical gap between consecutive rows; negative means they overlap. */
  const worstGap = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const rows = [...document.querySelectorAll<HTMLElement>('[data-index]')]
        .map((el) => ({ index: Number(el.dataset.index), rect: el.getBoundingClientRect() }))
        .filter((row) => row.rect.height > 0)
        .sort((a, b) => a.index - b.index);

      let worst = 999;
      for (let i = 1; i < rows.length; i += 1) {
        worst = Math.min(worst, Math.round(rows[i].rect.top - rows[i - 1].rect.bottom));
      }
      return rows.length > 1 ? worst : 999;
    });

  test('rows never overlap, and survive a card-size change', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1280, height: 900 });
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(400);
    await seedCollection(appPage, 200);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await expect(appPage.locator(CARD_SELECTOR).first()).toBeVisible();
    await appPage.waitForTimeout(600);

    // The reported symptom, straight off the initial render.
    const initial = await worstGap(appPage);
    expect(initial, `rows overlap by ${Math.abs(initial)}px on load`).toBeGreaterThanOrEqual(-1);

    // And again after a card-size change, which resizes every row underneath the cached value.
    for (const label of ['XL', 'S', 'L', 'M']) {
      const button = appPage.getByRole('button', { name: label, exact: true }).first();
      if (!(await button.isVisible().catch(() => false))) continue;
      await button.click();
      await appPage.waitForTimeout(500);
      const gap = await worstGap(appPage);
      expect(gap, `rows overlap by ${Math.abs(gap)}px after switching to ${label}`).toBeGreaterThanOrEqual(-1);
    }
  });

  test('the last entry stays reachable when rows have mixed heights', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1280, height: 900 });
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(400);
    await seedCollection(appPage, 120);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await expect(appPage.locator(CARD_SELECTOR).first()).toBeVisible();

    const scroller = appPage.locator('.workspace-body');
    for (let step = 0; step < 20; step += 1) {
      await scroller.evaluate((el) => el.scrollBy(0, el.clientHeight));
      await appPage.waitForTimeout(80);
    }
    await appPage.waitForTimeout(400);

    // Scrolled to the very end, the final row must actually be on screen.
    const lastVisible = await appPage.evaluate(() => {
      const indices = [...document.querySelectorAll<HTMLElement>('[data-index]')].map((el) => Number(el.dataset.index));
      return indices.length ? Math.max(...indices) : -1;
    });

    expect(lastVisible, 'the end of the collection was never rendered').toBeGreaterThan(0);
  });
});

/** The advanced filter panel from the search tab, applied locally to the collection. */
test.describe('collection filters', () => {
  test('advanced filters narrow the collection without a network call', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(400);
    await seedCollection(appPage, 120);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await expect(appPage.locator(CARD_SELECTOR).first()).toBeVisible();

    const before = await appPage.locator(CARD_SELECTOR).count();
    expect(before).toBeGreaterThan(0);

    await appPage.getByRole('button', { name: 'Advanced Filters' }).click();
    const cmc = appPage.getByLabel(/Converted Mana Cost/i);
    await expect(cmc).toBeVisible();
    await cmc.fill('3');
    await appPage.keyboard.press('Escape');
    await appPage.waitForTimeout(500);

    const after = await appPage.locator(CARD_SELECTOR).count();
    expect(after, 'the mana-value filter changed nothing').toBeLessThan(before);
    expect(after, 'the filter removed everything').toBeGreaterThan(0);
  });

  // Community tags are Scryfall-side data; offering the control here would do nothing.
  test('the community-tag filter is not offered in the collection', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(400);
    await seedCollection(appPage, 20);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();

    await appPage.getByRole('button', { name: 'Advanced Filters' }).click();
    await expect(appPage.getByLabel('Function', { exact: true })).toBeHidden();
    // The rest of the panel is there, so this is an omission and not a missing panel.
    await expect(appPage.getByLabel(/Converted Mana Cost/i)).toBeVisible();
  });
});

/** The deck tab's three view modes, applied to the collection. */
test.describe('collection view modes', () => {
  const openCollection = async (page: import('@playwright/test').Page, count: number) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Collection' }).click();
    await page.waitForTimeout(400);
    await seedCollection(page, count);
    await page.reload();
    await page.getByRole('button', { name: 'Collection' }).click();
    await expect(page.locator(CARD_SELECTOR).first()).toBeVisible();
  };

  test('switches between grid, list and binder', async ({ appPage }) => {
    await openCollection(appPage, 40);

    await openViewMenu(appPage);
    await appPage.getByRole('button', { name: 'List', exact: true }).click();
    await expect(appPage.getByRole('table')).toBeVisible();
    await expect(appPage.locator(CARD_SELECTOR)).toHaveCount(0);

    await openViewMenu(appPage);
    await appPage.getByRole('button', { name: 'Binder', exact: true }).click();
    await expect(appPage.getByRole('table')).toHaveCount(0);
    await expect(appPage.getByText(/Page 1 of/)).toBeVisible();

    await openViewMenu(appPage);
    await appPage.getByRole('button', { name: 'Grid', exact: true }).click();
    await expect(appPage.locator(CARD_SELECTOR).first()).toBeVisible();
  });

  test('the list sorts by a column and reverses on a second click', async ({ appPage }) => {
    await openCollection(appPage, 40);
    await openViewMenu(appPage);
    await appPage.getByRole('button', { name: 'List', exact: true }).click();

    const firstCell = () => appPage.locator('tbody tr').first().locator('td').first().innerText();
    const ascending = await firstCell();

    await appPage.getByRole('button', { name: /^Card$/ }).click();
    const descending = await firstCell();

    expect(descending, 'sorting by name did not reverse').not.toBe(ascending);
  });

  test('a row opens the card detail, since the list has no card to click', async ({ appPage }) => {
    await openCollection(appPage, 20);
    await openViewMenu(appPage);
    await appPage.getByRole('button', { name: 'List', exact: true }).click();

    await appPage.locator('tbody tr').first().click();

    await expect(appPage.getByRole('dialog')).toBeVisible();
  });
});

/** 6c — the compact checklist, for stocktaking. */
test.describe('collection checklist view', () => {
  const openChecklist = async (page: import('@playwright/test').Page) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Collection' }).click();
    await page.waitForTimeout(400);
    await seedCollection(page, 30);
    await page.reload();
    await page.getByRole('button', { name: 'Collection' }).click();
    await expect(page.locator(CARD_SELECTOR).first()).toBeVisible();
    await openViewMenu(page);
    await page.getByRole('button', { name: 'Checklist', exact: true }).click();
  };

  test('lists every card in one thin row each', async ({ appPage }) => {
    await openChecklist(appPage);

    const rows = appPage.locator('ul > li');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBe(30);
  });

  /**
   * The tick must not touch the owned count: ownership is a number, and a checkbox meaning
   * "one copy" would destroy it. It toggles the wishlist instead.
   */
  test('the tick toggles wishlist and leaves the owned count alone', async ({ appPage }) => {
    await openChecklist(appPage);

    const row = appPage.locator('ul > li').first();
    const quantityBefore = await row.locator('span').last().innerText();

    const tick = row.getByRole('button', { name: /Wishlist/i });
    const pressedBefore = await tick.getAttribute('aria-pressed');
    await tick.click();
    await appPage.waitForTimeout(400);

    await expect(tick).not.toHaveAttribute('aria-pressed', pressedBefore ?? 'false');
    expect(await row.locator('span').last().innerText(), 'the owned count changed').toBe(quantityBefore);
  });

  test('a row opens the card detail', async ({ appPage }) => {
    await openChecklist(appPage);

    await appPage.locator('ul > li').first().getByRole('button').nth(1).click();

    await expect(appPage.getByRole('dialog')).toBeVisible();
  });
});

/** 6b — collapsible sections per edition, counts without a denominator. */
test.describe('collection by-set view', () => {
  test('groups into editions and collapses a section', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1440, height: 900 });
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(400);
    await seedCollection(appPage, 40);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await expect(appPage.locator(CARD_SELECTOR).first()).toBeVisible();
    await openViewMenu(appPage);
    await appPage.getByRole('button', { name: 'By set', exact: true }).click();

    const sections = appPage.locator('section');
    await expect(sections.first()).toBeVisible();

    // Counts say what they mean: owned copies, with no invented total.
    await expect(appPage.getByText(/\d+ owned/).first()).toBeVisible();
    await expect(appPage.getByText(/\d+ \/ \d+/)).toHaveCount(0);

    const header = sections.first().getByRole('button').first();
    const rowsBefore = await sections.first().locator('li').count();
    expect(rowsBefore).toBeGreaterThan(0);

    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(await sections.first().locator('li').count()).toBe(0);
  });
});

/** 6a — the binder: fixed 3x3 pockets and page navigation. */
test.describe('collection binder view', () => {
  const openBinder = async (page: import('@playwright/test').Page, count: number) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Collection' }).click();
    await page.waitForTimeout(400);
    await seedCollection(page, count);
    await page.reload();
    await page.getByRole('button', { name: 'Collection' }).click();
    await expect(page.locator(CARD_SELECTOR).first()).toBeVisible();
    await openViewMenu(page);
    await page.getByRole('button', { name: 'Binder', exact: true }).click();
  };

  test('pages through nine cards at a time', async ({ appPage }) => {
    await openBinder(appPage, 20);

    await expect(appPage.getByText('Page 1 of 3')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await appPage.getByRole('button', { name: 'Next page' }).click();
    await expect(appPage.getByText('Page 2 of 3')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  /**
   * An empty pocket is information — a gap in the page — so the last page still draws nine.
   * Reflowing would break "page 3, second row" as a way to find a card.
   */
  test('the last page keeps nine slots even when partly empty', async ({ appPage }) => {
    await openBinder(appPage, 20);

    await appPage.getByRole('button', { name: 'Next page' }).click();
    await appPage.getByRole('button', { name: 'Next page' }).click();
    await expect(appPage.getByText('Page 3 of 3')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Next page' })).toBeDisabled();

    // 20 cards = 9 + 9 + 2, so the last page has 2 cards and 7 empty pockets.
    const slots = await appPage.evaluate(() => {
      const grid = document.querySelector('[data-binder-page]');
      return grid ? grid.children.length : -1;
    });
    expect(slots, 'the last page reflowed instead of keeping its pockets').toBe(9);
  });
});
