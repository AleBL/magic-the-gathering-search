import { test as base, expect, Page } from '@playwright/test';

/**
 * Stubbed Scryfall responses, never the live API: a red run must mean this app broke, not
 * that someone else's service is down.
 */

export interface StubCardOptions {
  name?: string;
  id?: string;
  typeLine?: string;
  oracleText?: string;
  rarity?: string;
  cmc?: number;
  colors?: string[];
}

export function stubCard(options: StubCardOptions = {}) {
  const name = options.name ?? 'Lightning Bolt';
  const id = options.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    object: 'card',
    id,
    oracle_id: `oracle-${id}`,
    name,
    printed_name: name,
    lang: 'en',
    released_at: '2021-01-01',
    type_line: options.typeLine ?? 'Instant',
    oracle_text: options.oracleText ?? 'Deal 3 damage to any target.',
    mana_cost: '{R}',
    cmc: options.cmc ?? 1,
    colors: options.colors ?? ['R'],
    color_identity: options.colors ?? ['R'],
    rarity: options.rarity ?? 'common',
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    multiverse_ids: [1],
    image_uris: {
      small: 'https://cards.scryfall.io/small/stub.jpg',
      normal: 'https://cards.scryfall.io/normal/stub.jpg',
      large: 'https://cards.scryfall.io/large/stub.jpg',
      art_crop: 'https://cards.scryfall.io/art_crop/stub.jpg'
    },
    legalities: {
      standard: 'legal',
      modern: 'legal',
      legacy: 'legal',
      vintage: 'legal',
      commander: 'legal',
      pauper: 'legal',
      pioneer: 'legal'
    },
    prices: { usd: '1.00', eur: '1.00' }
  };
}

/** 1×1 transparent GIF — keeps <img> elements loading without touching the network. */
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function mockScryfall(page: Page, cards = [stubCard()]) {
  // Playwright uses the *last* matching route, so the catch-all goes first. It 404s rather
  // than letting an unstubbed path reach the real API.
  await page.route('**/api.scryfall.com/**', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ object: 'error' }) })
  );

  await page.route('**/api.scryfall.com/symbology*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'list', data: [] }) })
  );

  await page.route('**/api.scryfall.com/cards/search*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ object: 'list', total_cards: cards.length, has_more: false, data: cards })
    })
  );

  await page.route('**/cards.scryfall.io/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL })
  );
}

export const test = base.extend<{ appPage: Page }>({
  // Named `runTest`, not `use`: the React Hooks lint rule reads `use` as a hook call.
  appPage: async ({ page }, runTest) => {
    // Pinned to English so selectors read as assertions rather than translations.
    await page.addInitScript(() => {
      window.localStorage.setItem('deckforge_language', 'en');
    });
    await mockScryfall(page);
    await runTest(page);
  }
});

export { expect };
