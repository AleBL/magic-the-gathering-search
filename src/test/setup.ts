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
//
// Covered 2026-08-06: useSearchFilters, useShortcuts, useDeckTextImport,
// useCardPrints, useAnimatedList, useEscapeKey — hooks went 31% → 42% statements.
//
// Covered 2026-08-18 by the P4 sweeps, which lifted the pure calculation out of the
// long hooks and tested it where it landed: useDeckManager, useDeckActions,
// useCardSearch, useDeckTokens, usePlaytestSimulator (undo/redo + mulligan),
// deckImportService, deckImage, deckValidator, plus new suites for playtestBoard,
// cardPrints, proxyPrintLayout, tokenCards and scryfallSearch.
//
// Still open, highest value first:
//   - hooks: useProxyPrint — the routine is tested through utils/proxyPrintLayout,
//     the hook wrapper around it is not
//   - services: fileDownload — the only untested path that writes a file
//   - utils: cardTypePredicates, formatLabel
//
// Deliberately not on this list: contextMenuPosition and rippleEffect. Both are
// geometry and visual effect whose failure mode is "looks wrong", which a unit test
// asserting numbers does not catch and the E2E suite does. Adding tests there would
// move the coverage number without making a regression more likely to be caught.
