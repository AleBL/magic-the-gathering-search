import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import i18n from '../plugins/i18n';
import { DeckFormatType } from '../types/enums';
import { makeCard } from '../test/factories';

/**
 * Phase 3 found this reporting "check the names" while offline — blaming the user's spelling
 * for a network that was never reached. `fetchCardsFromParsedList` swallows per-card failures
 * and returns an empty list, which is indistinguishable from every name being wrong, so the
 * only thing separating the two messages is the `navigator.onLine` check. Nothing but an E2E
 * covered that until now.
 */

const parseDeckText = vi.hoisted(() => vi.fn());
const fetchCardsFromParsedList = vi.hoisted(() => vi.fn());

vi.mock('../services/deckImportService', () => ({
  parseDeckText,
  fetchCardsFromParsedList
}));

const { useDeckTextImport } = await import('./useDeckTextImport');

const onLoadDeckToEdit = vi.fn();
const showToast = vi.fn();
const showAlert = vi.fn();
const setIsTextImportOpen = vi.fn();

const renderImport = () =>
  renderHook(() =>
    useDeckTextImport(
      i18n,
      'deck-1',
      'My Deck',
      DeckFormatType.FREEFORM,
      onLoadDeckToEdit,
      showToast,
      showAlert,
      setIsTextImportOpen
    )
  );

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });

beforeEach(() => {
  vi.clearAllMocks();
  parseDeckText.mockReturnValue([{ quantity: 4, name: 'Lightning Bolt' }]);
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('useDeckTextImport', () => {
  it('does nothing when the text parses to no cards', async () => {
    parseDeckText.mockReturnValue([]);
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('');
    });

    expect(fetchCardsFromParsedList).not.toHaveBeenCalled();
    expect(result.current.isProgressModalOpen).toBe(false);
  });

  it('blames the names when the lookup ran and found nothing', async () => {
    fetchCardsFromParsedList.mockResolvedValue({ cards: [], missing: ['Lightning Bolt'] });
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('4 Lightning Bolt');
    });

    await waitFor(() => expect(result.current.errorMsg).toBe(i18n.t('deck.importError')));
  });

  // The fix itself: offline, no name was ever looked up, so the spelling is not the problem.
  it('reports the connection, not the spelling, when offline', async () => {
    setOnline(false);
    fetchCardsFromParsedList.mockResolvedValue({ cards: [], missing: ['Lightning Bolt'] });
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('4 Lightning Bolt');
    });

    await waitFor(() => expect(result.current.errorMsg).toBe(i18n.t('search.scryfallOffline')));
    expect(result.current.errorMsg).not.toBe(i18n.t('deck.importError'));
  });

  it('reports the connection when the service throws offline', async () => {
    fetchCardsFromParsedList.mockRejectedValue(new Error('ScryfallOffline'));
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('4 Lightning Bolt');
    });

    await waitFor(() => expect(result.current.errorMsg).toBe(i18n.t('search.scryfallOffline')));
  });

  it('reports rate limiting distinctly, since retrying later is the fix', async () => {
    fetchCardsFromParsedList.mockRejectedValue(new Error('ScryfallRateLimited'));
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('4 Lightning Bolt');
    });

    await waitFor(() => expect(result.current.errorMsg).toBe(i18n.t('search.rateLimited')));
  });

  it('hands the resolved cards to the editor and closes only on success', async () => {
    const card = makeCard({ id: 'bolt', name: 'Lightning Bolt' });
    fetchCardsFromParsedList.mockResolvedValue({ cards: [card], missing: [] });
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('4 Lightning Bolt');
    });
    await waitFor(() => expect(result.current.isImporting).toBe(false));

    act(() => result.current.finishImport());

    expect(onLoadDeckToEdit).toHaveBeenCalledWith('deck-1', 'My Deck', DeckFormatType.FREEFORM, [card]);
    expect(setIsTextImportOpen).toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open when nothing resolved, so the error stays readable', async () => {
    fetchCardsFromParsedList.mockResolvedValue({ cards: [], missing: ['Nope'] });
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('4 Nope');
    });
    act(() => result.current.finishImport());

    expect(onLoadDeckToEdit).not.toHaveBeenCalled();
    expect(setIsTextImportOpen).not.toHaveBeenCalled();
  });

  it('surfaces the names it could not resolve', async () => {
    fetchCardsFromParsedList.mockResolvedValue({ cards: [makeCard({ id: 'a' })], missing: ['Blakc Lotus'] });
    const { result } = renderImport();

    await act(async () => {
      await result.current.importTextDeck('1 Blakc Lotus');
    });

    await waitFor(() => expect(result.current.missingCards).toEqual(['Blakc Lotus']));
  });
});
