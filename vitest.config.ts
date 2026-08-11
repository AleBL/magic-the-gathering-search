import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Dedicated Vitest config: the app's vite.config.ts wires in Electron plugins and
// filesystem side effects (rmSync) at load time, which don't belong in a jsdom test
// run, so we compose a minimal React-only pipeline here instead of reusing it.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      // The whole logic layer, not a hand-picked list. An allow-list of already-tested
      // modules reports a flattering number that says nothing about the project: adding
      // an untested util simply left it out of the denominator. Components are excluded
      // on purpose — they are covered through E2E/manual QA, and gating them here would
      // push the floor so low it stops catching anything.
      include: ['src/utils/**/*.{ts,tsx}', 'src/services/**/*.ts', 'src/store/**/*.ts', 'src/hooks/**/*.ts'],
      // 'json-summary' + 'json' feed the PR coverage-report action; 'text' for CI logs.
      reporter: ['text', 'text-summary', 'json', 'json-summary', 'html'],
      // Ratchet, set just under the measured value at the time of writing. These read
      // lower than the old numbers only because the denominator is now ~4x larger.
      // Raise them as tests land; never widen the gap to make a red run pass.
      // Raised 2026-08-07 (was 59/53/59/59) after covering deckImage's canvas render:
      // 61.92/54.17/60.45/62.72 measured, each floor set just under it.
      thresholds: {
        statements: 61,
        branches: 54,
        functions: 60,
        lines: 62
      }
    }
  }
});
