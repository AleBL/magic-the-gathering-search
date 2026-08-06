import { defineConfig, devices } from '@playwright/test';

// Deliberately not the dev server's default 3000: that port is commonly already taken by
// another project, and with `reuseExistingServer` Playwright will happily attach to it and
// run the whole suite against someone else's app. A dedicated port plus no reuse means a
// green run is always a run against *this* app.
const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // `*.bench.ts` files measure rather than assert: slow by design, and a number that moved
  // is not a failure. They fall outside Playwright's default `*.spec.ts` match, so only
  // `yarn test:e2e:bench` (which sets BENCH) picks them up.
  testMatch: process.env.BENCH ? '**/*.bench.ts' : '**/*.spec.ts',
  // Journeys drive real UI; a single slow step should not fail the whole run.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // A rogue `test.only` should fail CI rather than silently skip the rest of the suite.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Capped deliberately. Vite's dev server transforms modules on demand, and letting the
  // runner use every core meant a dozen workers hammering a cold server at once — enough
  // for `goto('/')` to time out on a machine that was otherwise fine. Four keeps the
  // suite quick without making the server the bottleneck.
  workers: process.env.CI ? 1 : 4,
  // 'html' in CI feeds the uploaded artifact; 'github' annotates the failing line in the
  // PR diff. Locally 'list' is enough — an HTML report nobody opens is just noise.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The PWA registers a service worker in dev (`devOptions.enabled`). Left alone it
    // answers requests from its own cache and the route mocks below never see them,
    // which makes runs non-deterministic. Tests do not exercise the SW itself.
    serviceWorkers: 'block'
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Locally, drive the Chrome that is already installed rather than making every
        // developer download a second browser. CI installs Playwright's own pinned
        // chromium instead, so runs there do not drift with whatever Chrome the runner
        // image happens to ship this week.
        channel: process.env.CI ? undefined : 'chrome'
      }
    }
  ],

  webServer: {
    // Benchmarks against the dev server measure React's development build, which carries
    // checks production strips. BENCH_PROD serves the real bundle instead.
    command: process.env.BENCH_PROD
      ? `yarn build:web && npx vite preview --config vite.config.web.ts --port ${PORT} --strictPort`
      : `yarn dev:web --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000
  }
});
