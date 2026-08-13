import { create } from 'zustand';
import { Currency } from '../types/Collection';
import { STORAGE_KEYS } from '../constants/storage';

const STORAGE_KEY = STORAGE_KEYS.collectionCurrency;
const GAP_KEY = STORAGE_KEYS.showDeckCollectionGap;

const readInitialCurrency = (): Currency => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'eur' ? 'eur' : 'usd';
  } catch {
    return 'usd';
  }
};

/** Opt-out, not opt-in: the summary is useful by default, but permanent for nobody. */
const readInitialShowGap = (): boolean => {
  try {
    return localStorage.getItem(GAP_KEY) !== 'false';
  } catch {
    return false;
  }
};

interface CollectionSettingsState {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  /** Whether a deck shows the "missing from your collection" summary. */
  showDeckGap: boolean;
  setShowDeckGap: (show: boolean) => void;
}

/** Small shared store so the collection screen and deck summary agree on currency. */
export const useCollectionSettings = create<CollectionSettingsState>((set) => ({
  currency: readInitialCurrency(),
  setCurrency: (currency) => {
    try {
      localStorage.setItem(STORAGE_KEY, currency);
    } catch {
      // Ignore persistence failures (e.g. private mode); in-memory state still updates.
    }
    set({ currency });
  },
  showDeckGap: readInitialShowGap(),
  setShowDeckGap: (showDeckGap) => {
    try {
      localStorage.setItem(GAP_KEY, String(showDeckGap));
    } catch {
      // Ignore persistence failures (e.g. private mode); in-memory state still updates.
    }
    set({ showDeckGap });
  }
}));
