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
// Still open, highest value first:
//   - hooks: useDeckManager, useDeckActions, useCardSearch, useDeckTokens,
//     useProxyPrint, and playtest undo/redo + mulligan flows
//   - services: deckImportService, fileDownload
//   - utils: cardTypePredicates, formatLabel, contextMenuPosition, rippleEffect,
//     deckImage (24%, the largest single gap left)
//   - deckValidator's commander partnership / color-identity branches
