/**
 * Every localStorage key the app owns, in one place.
 *
 * The string values are persisted in users' browsers, so a key is never simply renamed:
 * doing that silently discards the preference on the next visit. `darkMode` and
 * `visualEffects` predated the `deckforge_` prefix and were migrated by adding the new
 * key here and listing the old one in {@link LEGACY_STORAGE_KEYS}, which
 * {@link readStoredPreference} falls back to.
 */
export const STORAGE_KEYS = {
  darkMode: 'deckforge_dark_mode',
  visualEffects: 'deckforge_visual_effects',
  language: 'deckforge_language',
  cardSize: 'deckforge_card_size',
  budgetTarget: 'deckforge_budget_target',
  collectionCurrency: 'deckforge_collection_currency'
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Pre-prefix names still sitting in browsers that used an older build. Read-only: nothing
 * writes these any more, and {@link readStoredPreference} clears each one as it migrates.
 */
const LEGACY_STORAGE_KEYS: Partial<Record<StorageKey, string>> = {
  [STORAGE_KEYS.darkMode]: 'darkMode',
  [STORAGE_KEYS.visualEffects]: 'visualEffects'
};

/**
 * Reads a preference, falling back to its pre-prefix name and migrating the value across
 * on the way. Returns null when neither key is set, so callers can tell "never chosen"
 * from "chosen and off" — the distinction that decides whether to follow the OS setting.
 */
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
