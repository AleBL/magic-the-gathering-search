import { create } from 'zustand';
import { Card } from '../types/Card';
import { DeckFormat, DeckRelatedToken } from '../types/Deck';
import { DeckFormatType, DeckZone } from '../types/enums';
import { deckEntryId, newDeckEntryId, withDeckEntryIds } from '../utils/deckEntry';

interface EditingDeckState {
  deckId: string | null;
  deckName: string;
  deckFormat: DeckFormat;
  deckNotes?: string;
}

interface DeckStoreState {
  currentDeck: Card[];
  currentDeckRelatedTokens: DeckRelatedToken[];
  editingDeck: EditingDeckState;

  setCurrentDeck: (cards: Card[]) => void;
  setCurrentDeckRelatedTokens: (
    tokens: DeckRelatedToken[] | ((prev: DeckRelatedToken[]) => DeckRelatedToken[])
  ) => void;
  setEditingDeck: (state: EditingDeckState) => void;

  addCard: (card: Card) => void;
  removeCard: (cardId: string) => Card | null;
  updateCard: (updatedCard: Card) => void;
  updateCardZone: (cardId: string, zone: DeckZone) => void;
  toggleCommander: (cardId: string) => void;
  clearDeck: () => void;
  updateNotes: (notes: string) => void;
  updateDeckName: (name: string) => void;
  updateDeckFormat: (format: DeckFormat) => void;
  cancelEdit: () => void;
  loadDeckToEdit: (
    id: string,
    name: string,
    format: DeckFormat,
    cards: Card[],
    notes?: string,
    relatedTokens?: DeckRelatedToken[]
  ) => void;

  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;

  /** Read-only snapshot published by DeckManager, so detached UI can offer the right actions. */
  selectedDeckSummary: SelectedDeckSummary | null;
  setSelectedDeckSummary: (summary: SelectedDeckSummary | null) => void;

  /** Saved-decks count, published by DeckManager for the mobile page menu. */
  savedDeckCount: number;
  setSavedDeckCount: (count: number) => void;

  /**
   * Encoded deck lifted from a `?deck=` share link on startup: App parks it here, and
   * DeckManager consumes it once mounted and clears it.
   */
  pendingSharedDeck: string | null;
  setPendingSharedDeck: (encoded: string | null) => void;
}

export interface SelectedDeckSummary {
  id: string;
  name: string;
  cardCount: number;
}

/**
 * Cross-component command channel: shortcuts, the command palette and the page menu set one
 * of these and the owning component's effect runs it. A union, not a string, so a typo fails
 * to compile instead of silently no-opping.
 */
export type PendingAction =
  | 'focus-search'
  | 'open-search-filters'
  | 'save-deck'
  | 'save-deck-as-new'
  | 'clear-deck'
  | 'playtest-deck'
  | 'print-proxies'
  | 'export-deck'
  | 'export-all-decks'
  | 'import-deck-text'
  | 'import-deck-file'
  | 'edit-selected-deck'
  | 'show-saved-decks'
  | 'open-history'
  | 'toggle-deck-list';

const INITIAL_EDITING_STATE: EditingDeckState = {
  deckId: null,
  deckName: '',
  deckFormat: DeckFormatType.FREEFORM,
  deckNotes: ''
};

export const useDeckStore = create<DeckStoreState>((set) => ({
  currentDeck: [],
  currentDeckRelatedTokens: [],
  editingDeck: INITIAL_EDITING_STATE,
  pendingAction: null,
  selectedDeckSummary: null,
  savedDeckCount: 0,
  pendingSharedDeck: null,

  setPendingAction: (action) => set({ pendingAction: action }),

  setPendingSharedDeck: (encoded) => set({ pendingSharedDeck: encoded }),

  setSelectedDeckSummary: (summary) => set({ selectedDeckSummary: summary }),

  setSavedDeckCount: (count) => set({ savedDeckCount: count }),

  setCurrentDeck: (cards) => set({ currentDeck: withDeckEntryIds(cards) }),

  setCurrentDeckRelatedTokens: (tokens) =>
    set((state) => ({
      currentDeckRelatedTokens: typeof tokens === 'function' ? tokens(state.currentDeckRelatedTokens) : tokens
    })),

  setEditingDeck: (editingState) => set({ editingDeck: editingState }),

  // Always a fresh entry id, even when the card came from another entry in this deck
  // ("add another copy" hands back the card it was called with).
  addCard: (card) =>
    set((state) => ({ currentDeck: [...state.currentDeck, { ...card, instanceId: newDeckEntryId() }] })),

  removeCard: (cardId) => {
    let removedCard: Card | null = null;
    set((state) => {
      const index = state.currentDeck.findIndex((card) => card.id === cardId);
      if (index > -1) {
        const newDeck = [...state.currentDeck];
        removedCard = newDeck.splice(index, 1)[0];
        const remains = newDeck.some((card) => card.name === removedCard!.name);

        let newTokens = state.currentDeckRelatedTokens;
        if (!remains) {
          const cardName = removedCard!.name;
          const printedName = removedCard!.printed_name || removedCard!.name;
          newTokens = state.currentDeckRelatedTokens.filter(
            (token) => token.generatorCardName !== cardName && token.generatorCardName !== printedName
          );
        }
        return { currentDeck: newDeck, currentDeckRelatedTokens: newTokens };
      }
      return state;
    });
    return removedCard;
  },

  // Keyed on the entry, not the printing: every copy of an edition shares `id`, so this
  // used to rewrite all four copies when one had its art changed.
  updateCard: (updatedCard) =>
    set((state) => {
      const target = deckEntryId(updatedCard);
      return { currentDeck: state.currentDeck.map((card) => (deckEntryId(card) === target ? updatedCard : card)) };
    }),

  updateCardZone: (cardId, zone) =>
    set((state) => ({
      currentDeck: state.currentDeck.map((card) => (card.id === cardId ? { ...card, zone } : card))
    })),

  toggleCommander: (cardId) =>
    set((state) => {
      const index = state.currentDeck.findIndex((card) => card.id === cardId);
      if (index === -1) return state;

      if (state.currentDeck[index].isCommander) {
        return {
          currentDeck: state.currentDeck.map((card, idx) => (idx === index ? { ...card, isCommander: false } : card))
        };
      }

      // Two commanders are legal (partners), so promoting a third demotes every earlier one
      // except the most recently marked, rather than refusing the click with no explanation.
      const commanders = state.currentDeck.filter((card) => card.isCommander);
      const keptCommanderId = commanders.length >= 2 ? commanders[commanders.length - 1].id : null;

      return {
        currentDeck: state.currentDeck.map((card, idx) => {
          if (idx === index) return { ...card, isCommander: true };
          if (keptCommanderId === null) return card;
          return { ...card, isCommander: card.id === keptCommanderId };
        })
      };
    }),

  clearDeck: () => set({ currentDeck: [], currentDeckRelatedTokens: [] }),

  updateNotes: (notes) => set((state) => ({ editingDeck: { ...state.editingDeck, deckNotes: notes } })),
  updateDeckName: (name) => set((state) => ({ editingDeck: { ...state.editingDeck, deckName: name } })),
  updateDeckFormat: (format) => set((state) => ({ editingDeck: { ...state.editingDeck, deckFormat: format } })),

  cancelEdit: () =>
    set({
      editingDeck: INITIAL_EDITING_STATE,
      currentDeck: [],
      currentDeckRelatedTokens: []
    }),

  loadDeckToEdit: (id, name, format, cards, notes, relatedTokens) =>
    set({
      editingDeck: { deckId: id, deckName: name, deckFormat: format, deckNotes: notes || '' },
      currentDeck: withDeckEntryIds(cards),
      currentDeckRelatedTokens: relatedTokens || []
    })
}));
