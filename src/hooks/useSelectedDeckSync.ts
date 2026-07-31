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
 * Owns the lifecycle of the *selected* saved deck: restoring the selection when an edit
 * session ends, and publishing what the navbar's mobile page menu needs to build its
 * item list.
 *
 * These three effects live together because they are one concern seen from two sides —
 * `selectedDeck` is local component state, but the page menu renders outside the deck
 * manager's subtree and cannot receive it through props, so it has to be mirrored into
 * the store. Keeping the mirror next to the thing being mirrored is what stops the two
 * drifting apart.
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

  // Cleared on unmount: selectedDeck is local state and dies with the deck manager, so
  // leaving a stale summary behind would offer the page menu actions on a deck that is
  // no longer on screen.
  useEffect(() => {
    setSelectedDeckSummary(
      selectedDeck ? { id: selectedDeck.id, name: selectedDeck.name, cardCount: selectedDeck.cards.length } : null
    );
    return () => setSelectedDeckSummary(null);
  }, [selectedDeck, setSelectedDeckSummary]);

  useEffect(() => {
    setSavedDeckCount(savedDecks.length);
  }, [savedDecks.length, setSavedDeckCount]);

  // When an edit session ends, put the user back where they were: viewing the deck they
  // had just been editing. The ref remembers which deck that was, because by the time
  // editing stops `editingDeckId` has already been cleared.
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
