import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDeckInfoEditor } from '../useDeckInfoEditor';
import { makeCard } from '../../test/factories';
import { Deck } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';

const makeDeck = (overrides: Partial<Deck> = {}): Deck =>
  ({
    id: 'deck-1',
    name: 'Original Name',
    format: DeckFormatType.MODERN,
    cards: [makeCard({ id: 'c1' })],
    notes: 'some notes',
    relatedTokens: [],
    ...overrides
  }) as Deck;

const setup = (saveResult: { success: boolean; errorKey?: string } = { success: true }) => {
  const saveEditedDeck = vi.fn().mockResolvedValue(saveResult);
  const setSelectedDeck = vi.fn();
  const showToast = vi.fn();
  const showAlert = vi.fn();

  const { result } = renderHook(() => useDeckInfoEditor({ saveEditedDeck, setSelectedDeck, showToast, showAlert }));

  return { result, saveEditedDeck, setSelectedDeck, showToast, showAlert };
};

describe('useDeckInfoEditor', () => {
  it('starts closed and seeds the draft fields from the deck it opens', () => {
    const { result } = setup();
    expect(result.current.deckInfoEdit).toBeNull();

    act(() => result.current.openDeckInfoEditor(makeDeck()));

    expect(result.current.deckInfoEdit?.id).toBe('deck-1');
    expect(result.current.infoName).toBe('Original Name');
    expect(result.current.infoFormat).toBe(DeckFormatType.MODERN);
  });

  it('falls back to FREEFORM when the deck has no format', () => {
    const { result } = setup();

    act(() => result.current.openDeckInfoEditor(makeDeck({ format: undefined })));

    expect(result.current.infoFormat).toBe(DeckFormatType.FREEFORM);
  });

  it('persists the edited name and format, then closes and confirms', async () => {
    const { result, saveEditedDeck, setSelectedDeck, showToast } = setup();

    act(() => result.current.openDeckInfoEditor(makeDeck()));
    act(() => result.current.setInfoName('Renamed Deck'));
    act(() => result.current.setInfoFormat(DeckFormatType.COMMANDER));
    await act(async () => {
      await result.current.handleSaveDeckInfo();
    });

    expect(saveEditedDeck).toHaveBeenCalledWith(
      'deck-1',
      'Renamed Deck',
      DeckFormatType.COMMANDER,
      expect.any(Array),
      'some notes',
      []
    );
    expect(setSelectedDeck).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
    await waitFor(() => expect(result.current.deckInfoEdit).toBeNull());
  });

  it('keeps the original name when the draft is only whitespace', async () => {
    const { result, saveEditedDeck } = setup();

    act(() => result.current.openDeckInfoEditor(makeDeck()));
    act(() => result.current.setInfoName('   '));
    await act(async () => {
      await result.current.handleSaveDeckInfo();
    });

    expect(saveEditedDeck).toHaveBeenCalledWith(
      'deck-1',
      'Original Name',
      DeckFormatType.MODERN,
      expect.any(Array),
      'some notes',
      []
    );
  });

  it('only rewrites the selected deck when it is the one being edited', async () => {
    const { result, setSelectedDeck } = setup();

    act(() => result.current.openDeckInfoEditor(makeDeck()));
    act(() => result.current.setInfoName('Renamed Deck'));
    await act(async () => {
      await result.current.handleSaveDeckInfo();
    });

    const updater = setSelectedDeck.mock.calls[0][0] as (prev: Deck | null) => Deck | null;
    expect(updater(makeDeck())?.name).toBe('Renamed Deck');
    expect(updater(makeDeck({ id: 'other-deck' }))?.name).toBe('Original Name');
    expect(updater(null)).toBeNull();
  });

  it('surfaces a save failure as an alert and stays open', async () => {
    const { result, showAlert, showToast } = setup({ success: false, errorKey: 'deck.saveError' });

    act(() => result.current.openDeckInfoEditor(makeDeck()));
    await act(async () => {
      await result.current.handleSaveDeckInfo();
    });

    expect(showAlert).toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(result.current.deckInfoEdit).not.toBeNull();
  });

  it('does nothing when saving with no deck open', async () => {
    const { result, saveEditedDeck } = setup();

    await act(async () => {
      await result.current.handleSaveDeckInfo();
    });

    expect(saveEditedDeck).not.toHaveBeenCalled();
  });

  it('discards the draft when closed', () => {
    const { result } = setup();

    act(() => result.current.openDeckInfoEditor(makeDeck()));
    act(() => result.current.closeDeckInfoEditor());

    expect(result.current.deckInfoEdit).toBeNull();
  });
});
