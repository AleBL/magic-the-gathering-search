import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The trap this guards: `buildQuery` used to decide "are any filters active?" from a
 * hand-written list. A field missing from it meant an empty search box fell back to the
 * default query and returned unrelated cards — a filter that silently did nothing.
 */

/** The query Scryfall was actually asked for, read off the request the app made. */
async function capturedQuery(page: Page, act: () => Promise<void>) {
  const request = page.waitForRequest((req) => req.url().includes('/cards/search'));
  await act();
  const url = new URL((await request).url());
  return url.searchParams.get('q') ?? '';
}

const openAdvanced = async (page: Page) => {
  await page.getByRole('button', { name: 'Advanced Filters' }).click();
  // The section opens expanded, so clicking unconditionally would close it.
  const disclosure = page.getByRole('button', { name: 'Text & stats' });
  await expect(disclosure).toBeVisible();
  if ((await disclosure.getAttribute('aria-expanded')) !== 'true') await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
};

/** The open panel lays a backdrop over the page, so a user closes it before searching. */
const closeAdvancedAndSearch = async (page: Page) => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
};

test.describe('text filters', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.goto('/');
    await openAdvanced(appPage);
  });

  test('a phrase is quoted, so it stays one search term', async ({ appPage }) => {
    const query = await capturedQuery(appPage, async () => {
      await appPage.getByLabel('Contains text').fill('draw a card');
      await closeAdvancedAndSearch(appPage);
    });

    expect(query).toContain('(o:"draw a card" or fo:"draw a card")');
  });

  // With an empty search box, the filter has to be the search — not a fallback query.
  test('a text filter alone does not fall back to the default query', async ({ appPage }) => {
    const query = await capturedQuery(appPage, async () => {
      await appPage.getByLabel('Contains text').fill('flying');
      await closeAdvancedAndSearch(appPage);
    });

    expect(query).toContain('(o:flying or fo:flying)');
    expect(query).not.toContain('c>=1');
  });

  // `fo:` reaches the reminder text in brackets but only in English; `o:` reaches
  // translated text but skips reminder text. Shipping either alone loses something.
  test('searches oracle and full text together', async ({ appPage }) => {
    const query = await capturedQuery(appPage, async () => {
      await appPage.getByLabel('Contains text').fill('flying');
      await closeAdvancedAndSearch(appPage);
    });

    expect(query).toContain('(o:flying or fo:flying)');
  });

  test('function, keyword and stat filters reach the query', async ({ appPage }) => {
    const query = await capturedQuery(appPage, async () => {
      await appPage.getByLabel('Function').selectOption('removal');
      await appPage.getByLabel('Keyword').selectOption('flying');
      await appPage.getByLabel('Power').fill('>=4');
      await appPage.getByLabel('Toughness').fill('2');
      await closeAdvancedAndSearch(appPage);
    });

    expect(query).toContain('otag:removal');
    expect(query).toContain('kw:flying');
    expect(query).toContain('pow>=4');
    expect(query).toContain('tou=2');
  });

  test('a text-only filter marks the panel active, so it can be cleared', async ({ appPage }) => {
    await appPage.getByLabel('Contains text').fill('flying');

    const clear = appPage.getByRole('button', { name: 'Clear Filters' });
    await expect(clear).toBeEnabled();
    await clear.click();

    // Clearing closes the panel; the text section stays expanded when it reopens.
    await appPage.getByRole('button', { name: 'Advanced Filters' }).click();
    await expect(appPage.getByLabel('Contains text')).toHaveValue('');
  });
});

test.describe('the filter sheet on a phone', () => {
  test.use({ viewport: { width: 390, height: 700 } });

  // Reported: scrolling the filters scrolled the whole app, and the drag handle — the only
  // affordance saying the sheet can be pulled shut — scrolled away with it.
  test('scrolls its own body and keeps the drag handle in place', async ({ appPage }) => {
    await appPage.goto('/');
    // Below `sm` the filter row is hidden; the navbar button opens the sheet instead.
    await appPage.getByRole('banner').getByRole('button', { name: 'Advanced Filters' }).click();

    const sheet = appPage.getByRole('dialog');
    await expect(sheet).toBeVisible();

    const handle = sheet.locator('div[aria-hidden="true"] > div').first();
    const body = sheet.locator('> div').nth(1);
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await appPage.waitForTimeout(200);

    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    // Reported twice: the sheet scrolled sideways. Checking only the dialog missed it the
    // first time — the culprit was a descendant, so every element inside is measured.
    const sideways = await sheet.evaluate((element) =>
      [element, ...Array.from(element.querySelectorAll('*'))]
        .filter((node) => node.scrollWidth - node.clientWidth > 1)
        .map((node) => `${node.tagName.toLowerCase()}.${(node.getAttribute('class') || '').slice(0, 40)}`)
    );
    expect(sideways, `these scroll horizontally: ${sideways.join(' | ')}`).toEqual([]);
    const pageOverflow = await appPage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(pageOverflow, `the page overflows horizontally by ${pageOverflow}px`).toBeLessThanOrEqual(1);
    // The handle rides with the sheet, not with its content: after scrolling to the very
    // bottom it is still pinned to the top edge rather than scrolled out of sight.
    await expect(handle).toBeVisible();
    const sheetBox = (await sheet.boundingBox())!;
    const handleBox = (await handle.boundingBox())!;
    expect(handleBox.y - sheetBox.y, 'the grab handle scrolled away with the content').toBeLessThan(40);
  });
});

test.describe('search language', () => {
  // Reported and confirmed: `o:voar` alone finds nothing, but the app always appends
  // `lang:pt`, and `o:voar lang:pt` matches 3,145 cards. The filter is not English-only.
  test('sends the browsing language alongside the text filter', async ({ appPage }) => {
    await appPage.addInitScript(() => window.localStorage.setItem('deckforge_language', 'pt'));
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Filtros Avançados' }).click();

    const query = await capturedQuery(appPage, async () => {
      await appPage.getByLabel('Contém o texto').fill('voar');
      await appPage.keyboard.press('Escape');
      await appPage.getByRole('button', { name: 'Buscar', exact: true }).click();
    });

    expect(query).toContain('(o:voar or fo:voar)');
    expect(query).toContain('lang:pt');
  });
});
