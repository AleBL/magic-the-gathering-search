// These strings are persisted in users' browsers, so renaming one discards the preference
// unless the old name is added to {@link LEGACY_STORAGE_KEYS} to fall back to.
export const STORAGE_KEYS = {
  darkMode: 'deckforge_dark_mode',
  visualEffects: 'deckforge_visual_effects',
  language: 'deckforge_language',
  cardSize: 'deckforge_card_size',
  budgetTarget: 'deckforge_budget_target',
  collectionCurrency: 'deckforge_collection_currency',
  showDeckCollectionGap: 'deckforge_show_deck_collection_gap',
  collectionToolsOpen: 'deckforge_collection_tools_open'
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const LEGACY_STORAGE_KEYS: Partial<Record<StorageKey, string>> = {
  [STORAGE_KEYS.darkMode]: 'darkMode',
  [STORAGE_KEYS.visualEffects]: 'visualEffects'
};

// Null when neither key is set, so a caller can tell "never chosen" from "chosen and off":
// the distinction that decides whether dark mode follows the OS.
export function readStoredPreference(key: StorageKey): string | null {
  if (typeof window === 'undefined') return null;

  const current = window.localStorage.getItem(key);
  if (current !== null) return current;

  const legacyKey = LEGACY_STORAGE_KEYS[key];
  if (!legacyKey) return null;

  const legacyValue = window.localStorage.getItem(legacyKey);
  if (legacyValue === null) return null;

  // Move it over once, so the fallback stops being needed for this browser.
  window.localStorage.setItem(key, legacyValue);
  window.localStorage.removeItem(legacyKey);
  return legacyValue;
}
