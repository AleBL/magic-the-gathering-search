import { useCallback, useEffect, useState } from 'react';

import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { STORAGE_KEYS, readStoredPreference } from '../constants/storage';

const STORAGE_KEY = STORAGE_KEYS.visualEffects;
const CHANGE_EVENT = 'visual-effects-change';

function readStored(): boolean {
  const saved = readStoredPreference(STORAGE_KEY);
  return saved !== null ? saved === 'true' : true;
}

/** Reflect the preference on <html> so pure-CSS effects can gate themselves too. */
function syncDomFlag(enabled: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.visualEffects = enabled ? 'on' : 'off';
}

/**
 * Opt-in visual effects (3D flip, foil shine, ambient glow, particles, view transitions),
 * mirrored across every hook instance by a window event so one toggle updates the whole app.
 * `motionEnabled` is the gate to check before decorative motion: it folds in the OS setting.
 */
export function useVisualEffects() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [effectsEnabled, setEffectsEnabledState] = useState<boolean>(readStored);

  useEffect(() => {
    syncDomFlag(effectsEnabled);
  }, [effectsEnabled]);

  useEffect(() => {
    const handleChange = () => setEffectsEnabledState(readStored());
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  const setEffectsEnabled = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(value));
    syncDomFlag(value);
    setEffectsEnabledState(value);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }, []);

  return {
    effectsEnabled,
    setEffectsEnabled,
    /** True only when effects are on AND the OS isn't asking for reduced motion. */
    motionEnabled: effectsEnabled && !prefersReducedMotion
  };
}
