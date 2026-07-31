import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSelectedDeckSync } from './useSelectedDeckSync';
import { useDeckStore } from '../store/useDeckStore';
import { Deck } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { makeCard } from '../test/factories';

const makeDeck = (id: string, name = `Deck ${id}`): Deck => ({
  id,
  name,
  format: DeckFormatType.FREEFORM,
  cards: [makeCard(), makeCard()],
  createdAt: '2026-01-01T00:00:00.000Z'
});

const store = () => useDeckStore.getState();

describe('useSelectedDeckSync', () => {
  beforeEach(() => {
    useDeckStore.setState({ selectedDeckSummary: null, savedDeckCount: 0 });
  });

  it('publishes a summary of the selected deck for the detached page menu', () => {
    const deck = makeDeck('a', 'Mono Red');
    renderHook(() =>
      useSelectedDeckSync({ selectedDeck: deck, setSelectedDeck: vi.fn(), savedDecks: [deck], editingDeckId: null })
    );

    expect(store().selectedDeckSummary).toEqual({ id: 'a', name: 'Mono Red', cardCount: 2 });
  });

  // The summary outliving the component would offer the page menu actions on a deck
  // that is no longer on screen.
  it('clears the published summary on unmount', () => {
    const deck = makeDeck('a');
    const { unmount } = renderHook(() =>
      useSelectedDeckSync({ selectedDeck: deck, setSelectedDeck: vi.fn(), savedDecks: [deck], editingDeckId: null })
    );

    expect(store().selectedDeckSummary).not.toBeNull();
    unmount();
    expect(store().selectedDeckSummary).toBeNull();
  });

  it('publishes the saved-deck count', () => {
    renderHook(() =>
      useSelectedDeckSync({
        selectedDeck: null,
        setSelectedDeck: vi.fn(),
        savedDecks: [makeDeck('a'), makeDeck('b')],
        editingDeckId: null
      })
    );

    expect(store().savedDeckCount).toBe(2);
  });

  it('re-selects the deck that was being edited once editing ends', () => {
    const deck = makeDeck('a');
    const setSelectedDeck = vi.fn();
    const { rerender } = renderHook(
      (props: { editingDeckId: string | null }) =>
        useSelectedDeckSync({ selectedDeck: null, setSelectedDeck, savedDecks: [deck], ...props }),
      { initialProps: { editingDeckId: 'a' as string | null } }
    );

    expect(setSelectedDeck).not.toHaveBeenCalled();

    rerender({ editingDeckId: null });
    expect(setSelectedDeck).toHaveBeenCalledWith(deck);
  });

  it('does not re-select a deck that is already selected', () => {
    const deck = makeDeck('a');
    const setSelectedDeck = vi.fn();
    const { rerender } = renderHook(
      (props: { editingDeckId: string | null }) =>
        useSelectedDeckSync({ selectedDeck: deck, setSelectedDeck, savedDecks: [deck], ...props }),
      { initialProps: { editingDeckId: 'a' as string | null } }
    );

    rerender({ editingDeckId: null });
    expect(setSelectedDeck).not.toHaveBeenCalled();
  });

  // Landing on the deck manager without having edited anything must not select a deck
  // out of nowhere.
  it('selects nothing when no edit session preceded', () => {
    const setSelectedDeck = vi.fn();
    renderHook(() =>
      useSelectedDeckSync({
        selectedDeck: null,
        setSelectedDeck,
        savedDecks: [makeDeck('a')],
        editingDeckId: null
      })
    );

    expect(setSelectedDeck).not.toHaveBeenCalled();
  });

  it('selects nothing when the edited deck is gone from the saved list', () => {
    const setSelectedDeck = vi.fn();
    const { rerender } = renderHook(
      (props: { editingDeckId: string | null }) =>
        useSelectedDeckSync({ selectedDeck: null, setSelectedDeck, savedDecks: [makeDeck('other')], ...props }),
      { initialProps: { editingDeckId: 'deleted' as string | null } }
    );

    rerender({ editingDeckId: null });
    expect(setSelectedDeck).not.toHaveBeenCalled();
  });
});
