import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

/**
 * The only test in the suite that runs the Electron main process and the preload script.
 * Everything else drives `yarn dev:web` in a plain browser, where neither file exists, so a
 * green web suite says nothing about electron/.
 *
 * Opt-in, one app boot for the whole file: `ELECTRON_E2E=1 yarn test:e2e`.
 */

// Electron needs a display server. WSL provides one through WSLg and desktop Linux through
// X or Wayland; a bare CI container provides neither, and there the honest outcome is a
// skip rather than a launch timeout dressed up as a product failure.
const NO_DISPLAY = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;

test.describe.configure({ mode: 'serial' });

let app: ElectronApplication;
let page: Page;

/** What the document looked like at the first moment the loading overlay existed. */
let overlayAtBoot: { background: string; dots: number; styleTags: number };

const cspViolations: string[] = [];

test.beforeAll(async () => {
  test.skip(NO_DISPLAY, 'no display available for Electron');

  // `config.rootDir` is the test directory, not the project root: the build output and the
  // package.json that names the Electron entry point live one level up, next to the config.
  const projectRoot = dirname(test.info().config.configFile ?? '');

  // The app is launched over the build output, not over sources: `main` in package.json
  // points at dist-electron/index.js and the window loads dist-vite/index.html from
  // file://, which is also what puts the production CSP in play.
  for (const artifact of ['dist-electron/index.js', 'dist-electron/preload.js', 'dist-vite/index.html']) {
    if (!existsSync(join(projectRoot, artifact))) {
      throw new Error(`Missing ${artifact}. Run \`yarn build\` before the desktop boot spec.`);
    }
  }

  // VS Code's integrated terminal exports ELECTRON_RUN_AS_NODE=1. Inherited by the launch it
  // turns the Electron binary into a plain Node, which then rejects Playwright's own
  // debugging flags and the run dies before the app exists.
  const env = { ...process.env } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;

  app = await electron.launch({
    env,
    args: [
      '.',
      // Chromium refuses to start its sandbox as uid 0. Containers and WSL images that run
      // as root would otherwise fail at launch; this concerns the OS sandbox of the test
      // run, not `webPreferences.sandbox`, which stays on.
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])
    ],
    cwd: projectRoot
  });

  page = await app.firstWindow();

  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) cspViolations.push(message.text());
  });

  // Polled inside the page so the overlay is read at the first frame it exists. The preload
  // appends it on `readystatechange`, long before the React bundle finishes executing, but
  // the window between that and `removeLoading` belongs to the app, not to the test.
  const probe = await page.waitForFunction(() => {
    const overlay = document.querySelector('#loading-to-remove');
    if (!overlay) return null;
    return {
      // The stylesheet is a <link> in index.html now, so the evidence that it arrived
      // before the overlay painted is the overlay's own computed background.
      background: getComputedStyle(overlay).backgroundColor,
      dots: overlay.querySelectorAll('.sk-chase .sk-chase-dot').length,
      styleTags: document.querySelectorAll('style').length
    };
  });
  // The `null` above is the "keep polling" signal, so it cannot be the settled value; the
  // guard is here because the returned handle is typed with it anyway.
  const observed = await probe.jsonValue();
  if (!observed) throw new Error('waitForFunction settled without an overlay');
  overlayAtBoot = observed;
});

test.afterAll(async () => {
  await app?.close();
});

test('the preload paints the loading overlay before the app mounts', () => {
  // #282c34, the wrapper background from src/style/loader.css.
  expect(overlayAtBoot.background).toBe('rgb(40, 44, 52)');
  expect(overlayAtBoot.dots).toBe(6);
});

test('the preload styles the overlay without injecting a <style> element', () => {
  // The whole point of moving the spinner CSS into src/style/loader.css: an injected
  // <style> is inline style, and while style-src still carries 'unsafe-inline' for
  // useProxyPrint, nothing else would fail if the injection came back. This assertion is
  // the only thing standing between that and a silent regression.
  expect(overlayAtBoot.styleTags).toBe(0);
});

test('the loading overlay is gone once the app mounts', async () => {
  // The renderer posts `removeLoading` from an effect after the first render, so the
  // overlay disappearing is also the evidence that React mounted at all.
  await page.waitForFunction(() => !document.querySelector('#loading-to-remove'));

  await expect(page.getByRole('banner')).toBeVisible();
});

test('booting the desktop app violates no CSP directive', () => {
  expect(cspViolations).toEqual([]);
});
