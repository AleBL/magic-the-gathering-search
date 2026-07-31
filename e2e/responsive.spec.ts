import { expect, test } from './fixtures';

/**
 * The breakpoint sweep from the audit brief, as an assertion rather than an eyeball.
 *
 * A page that scrolls horizontally is the one responsive failure that is unambiguous:
 * something is wider than the viewport and the user has to pan to read it. Comparing
 * `documentElement.scrollWidth` against `innerWidth` catches it at every width without
 * anyone deciding whether a screenshot "looks right".
 */

const VIEWPORTS = [
  { name: '320  (smallest phone)', width: 320, height: 640 },
  { name: '375  (iPhone SE/13 mini)', width: 375, height: 667 },
  { name: '390  (iPhone 13/14)', width: 390, height: 844 },
  { name: '414  (large phone)', width: 414, height: 896 },
  { name: '768  (tablet portrait)', width: 768, height: 1024 },
  { name: '1024 (tablet landscape)', width: 1024, height: 768 },
  { name: '1280 (laptop)', width: 1280, height: 800 },
  { name: '1440 (desktop)', width: 1440, height: 900 },
  { name: '2560 (ultrawide)', width: 2560, height: 1080 }
];

const TABS = ['Search Cards', 'My Decks', 'My Collection'] as const;

/** Horizontal overflow in CSS pixels; 1px of tolerance absorbs sub-pixel rounding. */
async function horizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - window.innerWidth);
  });
}

for (const viewport of VIEWPORTS) {
  test(`no horizontal overflow at ${viewport.name}`, async ({ appPage }) => {
    await appPage.setViewportSize({ width: viewport.width, height: viewport.height });
    await appPage.goto('/');

    for (const tab of TABS) {
      await appPage.getByRole('button', { name: tab }).click();
      // The deck and collection tabs are lazy chunks; wait for their heading to land
      // before measuring, or the measurement races the Suspense fallback.
      await expect(appPage.getByRole('main')).toBeVisible();
      await appPage.waitForTimeout(300);

      const overflow = await horizontalOverflow(appPage);
      expect(overflow, `"${tab}" overflows by ${overflow}px at ${viewport.width}px wide`).toBeLessThanOrEqual(1);
    }
  });
}

// The base tabs passing says nothing about overlays, which is where the audit brief
// expected trouble: a dialog with a fixed min-width is the classic 320px failure.
test('an open modal does not overflow the narrowest phone', async ({ appPage }) => {
  await appPage.setViewportSize({ width: 320, height: 640 });
  await appPage.goto('/');
  await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
  await appPage.getByRole('button', { name: 'Search', exact: true }).click();
  await appPage.getByRole('button', { name: 'Add copy' }).click();

  await appPage.getByRole('button', { name: 'My Decks' }).click();

  // Below `sm` the on-screen toolbars are replaced entirely by the navbar's page menu,
  // so this is the *only* route to the save dialog on a phone — which is exactly why it
  // is worth asserting on.
  await appPage.getByRole('button', { name: 'Page actions' }).click();
  await appPage
    .getByRole('button', { name: /save deck/i })
    .first()
    .click();

  const dialog = appPage.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const overflow = await horizontalOverflow(appPage);
  expect(overflow, `the page overflows by ${overflow}px with the save dialog open`).toBeLessThanOrEqual(1);

  // Not just "the page does not scroll" — the dialog itself has to fit and start on-screen.
  const box = await dialog.boundingBox();
  expect(box!.width, `the save dialog is ${box!.width}px wide in a 320px viewport`).toBeLessThanOrEqual(320);
  expect(box!.x, 'the save dialog starts off-screen').toBeGreaterThanOrEqual(0);
});

// WCAG 2.2 SC 2.5.8 (Target Size, Minimum) asks for 24×24 CSS px. Buttons that are
// comfortable with a mouse are routinely too small to hit with a thumb.
test('touch targets meet the 24px minimum on a phone viewport', async ({ appPage }) => {
  await appPage.setViewportSize({ width: 390, height: 844 });
  await appPage.goto('/');

  const undersized = await appPage.evaluate(() => {
    const MIN = 24;
    const offenders: { label: string; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll('button, a[href], [role="button"]'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue; // not rendered
      if (rect.width >= MIN && rect.height >= MIN) continue;
      const label =
        el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.className.toString().slice(0, 40);
      offenders.push({ label, w: Math.round(rect.width), h: Math.round(rect.height) });
    }
    return offenders;
  });

  expect(undersized, `undersized targets: ${JSON.stringify(undersized)}`).toEqual([]);
});

test('search results reflow without overflow on the narrowest phone', async ({ appPage }) => {
  await appPage.setViewportSize({ width: 320, height: 640 });
  await appPage.goto('/');
  await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
  await appPage.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();

  const overflow = await horizontalOverflow(appPage);
  expect(overflow, `search results overflow by ${overflow}px at 320px`).toBeLessThanOrEqual(1);
});
