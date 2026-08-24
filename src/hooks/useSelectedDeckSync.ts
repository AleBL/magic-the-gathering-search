import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { Deck } from '../types/Deck';
import { useDeckStore } from '../store/useDeckStore';

interface UseSelectedDeckSyncParams {
  /** The saved deck currently open for viewing, or null while browsing/editing. */
  selectedDeck: Deck | null;
  setSelectedDeck: Dispatch<SetStateAction<Deck | null>>;
  savedDecks: Deck[];
  editingDeckId: string | null;
}

/**
 * Owns the selected saved deck: restores it when an edit session ends, and mirrors it into
 * the store for the navbar's page menu, which renders outside this subtree.
 */
export function useSelectedDeckSync({
  selectedDeck,
  setSelectedDeck,
  savedDecks,
  editingDeckId
}: UseSelectedDeckSyncParams): void {
  const setSelectedDeckSummary = useDeckStore((state) => state.setSelectedDeckSummary);
  const setSavedDeckCount = useDeckStore((state) => state.setSavedDeckCount);

  const lastEditingIdRef = useRef<string | null>(null);

  // Cleared on unmount, or the page menu would offer actions on a deck no longer shown.
  useEffect(() => {
    setSelectedDeckSummary(
      selectedDeck ? { id: selectedDeck.id, name: selectedDeck.name, cardCount: selectedDeck.cards.length } : null
    );
    return () => setSelectedDeckSummary(null);
  }, [selectedDeck, setSelectedDeckSummary]);

  useEffect(() => {
    setSavedDeckCount(savedDecks.length);
  }, [savedDecks.length, setSavedDeckCount]);

  // The ref is needed because `editingDeckId` is already cleared by the time editing stops.
  useEffect(() => {
    if (editingDeckId) {
      lastEditingIdRef.current = editingDeckId;
      return;
    }
    if (!lastEditingIdRef.current) return;

    const deckToSelect = savedDecks.find((deck) => deck.id === lastEditingIdRef.current);
    if (deckToSelect && (!selectedDeck || selectedDeck.id !== deckToSelect.id)) {
      setSelectedDeck(deckToSelect);
    }
    lastEditingIdRef.current = null;
  }, [editingDeckId, savedDecks, selectedDeck, setSelectedDeck]);
}
