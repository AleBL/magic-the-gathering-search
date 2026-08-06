import { test } from './fixtures';
import type { Page } from '@playwright/test';
import { CARD_SELECTOR, seedCollection } from './seed';

/**
 * Measurement, not a test — it asserts nothing and falls outside the `testMatch` that
 * `yarn test:e2e` uses. Run it with `yarn test:e2e:bench`, or `BENCH_PROD=1
 * yarn test:e2e:bench` to measure the production bundle instead of the dev server.
 *
 * Phase 1 of the roadmap: the collection had never been measured at any real size.
 */

const SIZES = [500, 2000, 5000];

/**
 * Counts IndexedDB reads by wrapping the store prototype before the app opens the tab.
 * `useCardCollection` runs one `get` per rendered card, which is the number in question.
 */
async function countIdbReads(page: Page) {
  await page.evaluate(() => {
    const counter = { get: 0, getAll: 0, openCursor: 0 };
    (window as unknown as { __idb: typeof counter }).__idb = counter;

    type Patchable = Record<string, (...args: unknown[]) => unknown>;
    const prototype = IDBObjectStore.prototype as unknown as Patchable;
    for (const method of ['get', 'getAll', 'openCursor'] as const) {
      const original = prototype[method];
      prototype[method] = function patched(this: IDBObjectStore, ...args: unknown[]) {
        counter[method] += 1;
        return original.apply(this, args);
      };
    }
  });
}

/** Frame intervals during a scripted scroll; long frames are where jank is felt. */
async function measureScroll(page: Page) {
  return page.evaluate(async (selector) => {
    // The app is a full-height flex layout, so the page itself never scrolls — walk up
    // from the grid to whichever ancestor actually owns the overflow.
    const grid = document.querySelector(selector)?.parentElement;
    let scroller: Element = document.scrollingElement ?? document.body;
    for (let node = grid; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 50) {
        scroller = node;
        break;
      }
    }
    const frames: number[] = [];
    let last = performance.now();
    let running = true;

    const tick = () => {
      const now = performance.now();
      frames.push(now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    for (let step = 0; step < 30; step += 1) {
      scroller.scrollTop += 600;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    running = false;
    await new Promise((resolve) => setTimeout(resolve, 100));

    frames.shift();
    const sorted = [...frames].sort((a, b) => a - b);
    return {
      scrolledPx: scroller.scrollTop,
      frames: frames.length,
      medianMs: Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0),
      p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
      worstMs: Math.round(sorted[sorted.length - 1] ?? 0),
      over50ms: frames.filter((frame) => frame > 50).length
    };
  }, CARD_SELECTOR);
}

for (const size of SIZES) {
  test(`collection at ${size} entries`, async ({ appPage }) => {
    test.setTimeout(180_000);

    await appPage.goto('/');
    // Open the tab once first: raw `indexedDB.open` on a database Dexie has not created
    // yet yields an empty v1 with no object stores, and seeding fails on a missing store.
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(1000);

    await seedCollection(appPage, size);
    await appPage.reload();
    await countIdbReads(appPage);

    const openedAt = Date.now();
    await appPage.getByRole('button', { name: 'Collection' }).click();
    // First card painted = the grid is on screen and interactive.
    await appPage.locator(CARD_SELECTOR).first().waitFor({ timeout: 120_000 });
    const timeToFirstCardMs = Date.now() - openedAt;

    // Let the per-card live queries settle before counting them.
    await appPage.waitForTimeout(3000);

    const stats = await appPage.evaluate(
      (selector) => ({
        idb: (window as unknown as { __idb: { get: number; getAll: number; openCursor: number } }).__idb,
        domNodes: document.querySelectorAll('*').length,
        renderedCards: document.querySelectorAll(selector).length,
        heapMb: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ? Math.round((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1e6)
          : null
      }),
      CARD_SELECTOR
    );

    const scroll = await measureScroll(appPage);

    // Printing the numbers is the entire point of a benchmark.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ size, timeToFirstCardMs, ...stats, scroll }, null, 2));
  });
}
