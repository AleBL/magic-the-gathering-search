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
      // Raised 2026-08-15 (was 61/54/60/62) after branch tests for collectionCsv's
      // Scryfall resolution, storagePersistence and useCollectionSettings took those
      // three modules to ~100%: 63.37/56.58/62.06/63.95 -> 65.36/59.04/62.99/65.80.
      // Raised again 2026-08-15 (was 65/59/62/65) after the offline branches of
      // useDeckTokens/useCardSearch and the CSV record splitter got tests:
      // 68.17/61.27/64.56/68.95 measured. Note the change of rule: the floors now sit a
      // full point under the measurement instead of hugging it. The previous style left
      // 0,04 pp of slack, so an unrelated PR adding one untested conditional went red with
      // nothing in the Vitest output naming the culprit. A ratchet is meant to stop
      // backsliding, not to fail on noise.
      // Raised 2026-08-19 (was 67/60/64/67) after the P4 readability sweeps lifted the
      // pure calculation out of the long hooks and tested it: playtestBoard, cardPrints,
      // proxyPrintLayout, tokenCards and scryfallSearch arrived with their own suites.
      // 73.82/67.27/68.86/74.95 measured, each floor a full point under it.
      thresholds: {
        statements: 72,
        branches: 66,
        functions: 67,
        lines: 73
      }
    }
  }
});
