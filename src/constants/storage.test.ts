import { describe, expect, it, beforeEach } from 'vitest';
import { STORAGE_KEYS, readStoredPreference } from './storage';

describe('readStoredPreference', () => {
  beforeEach(() => localStorage.clear());

  it('reads the current key when it is set', () => {
    localStorage.setItem(STORAGE_KEYS.darkMode, 'false');
    expect(readStoredPreference(STORAGE_KEYS.darkMode)).toBe('false');
  });

  // The whole point of the migration: someone who chose light mode on an older build
  // must not be silently flipped back to the default on their next visit.
  it('falls back to the pre-prefix key', () => {
    localStorage.setItem('darkMode', 'false');
    expect(readStoredPreference(STORAGE_KEYS.darkMode)).toBe('false');
  });

  it('moves the legacy value onto the new key and clears the old one', () => {
    localStorage.setItem('visualEffects', 'false');

    readStoredPreference(STORAGE_KEYS.visualEffects);

    expect(localStorage.getItem(STORAGE_KEYS.visualEffects)).toBe('false');
    expect(localStorage.getItem('visualEffects')).toBeNull();
  });

  it('prefers the current key when both exist', () => {
    localStorage.setItem(STORAGE_KEYS.darkMode, 'true');
    localStorage.setItem('darkMode', 'false');
    expect(readStoredPreference(STORAGE_KEYS.darkMode)).toBe('true');
  });

  // null and 'false' must stay distinguishable: null means "never chose", which is what
  // makes dark mode follow the OS instead of forcing a default.
  it('returns null when neither key is set', () => {
    expect(readStoredPreference(STORAGE_KEYS.darkMode)).toBeNull();
  });

  it('preserves a stored "false" rather than treating it as unset', () => {
    localStorage.setItem('darkMode', 'false');
    expect(readStoredPreference(STORAGE_KEYS.darkMode)).not.toBeNull();
  });

  it('has no legacy fallback for keys that were always prefixed', () => {
    localStorage.setItem('language', 'es');
    expect(readStoredPreference(STORAGE_KEYS.language)).toBeNull();
  });
});
