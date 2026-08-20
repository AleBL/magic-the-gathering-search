import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Initialize the shared i18next instance so components/hooks using useTranslation
// and helpers reading i18n resources behave the same as in the running app.
import '../plugins/i18n';

// Unmount React trees rendered by Testing Library between tests to avoid leakage.
afterEach(() => {
  cleanup();
});

// TODO(test-coverage): the coverage gate in vitest.config.ts spans the whole logic
// layer (utils/services/store/hooks), so the gaps below show up as real numbers
// rather than being excluded from the denominator.

// Still open, highest value first:
//   - hooks + services, one package: useProxyPrint and print/useProxyPrintRoutine end in
//     services/fileDownload, all three at 0%. Testing the routine before the download is
//     tested measures the mock, so they land together
//   - hooks: tokens/useTokenSearch and tokens/useDeckTokenAnalysis, the other open front
//   - utils: cardTypePredicates, formatLabel
//
// Deliberately not on this list: contextMenuPosition and rippleEffect. Both are
// geometry and visual effect whose failure mode is "looks wrong", which a unit test
// asserting numbers does not catch and the E2E suite does. Adding tests there would
// move the coverage number without making a regression more likely to be caught.
