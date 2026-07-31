import { useState, useEffect } from 'react';

import { STORAGE_KEYS, readStoredPreference } from '../constants/storage';

export default function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedDarkMode = readStoredPreference(STORAGE_KEYS.darkMode);
    if (savedDarkMode !== null) return savedDarkMode === 'true';
    // No saved preference yet — respect the OS-level prefers-color-scheme instead of forcing dark.
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.darkMode, isDarkMode.toString());
  }, [isDarkMode]);

  return [isDarkMode, setIsDarkMode] as const;
}
