import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import i18n from '../../plugins/i18n';
import { Card } from '../../types/Card';

/**
 * The offline halves of the tokens tab. Both used to end the same way a legitimately empty
 * answer does — "Error searching tokens." next to an empty list, or a deck analysis that
 * finished silently and left "No tokens found for this card." on screen — so nothing in the
 * UI separated "there are none" from "we could not ask".
 */

const dispatchToast = vi.hoisted(() => vi.fn());

vi.mock('../../utils/toastHelper', () => ({ dispatchToast }));
// The real one re-fetches every card in the user's language; identity keeps these tests on
// the branch under test instead of on the translation pipeline.
vi.mock('../../utils/translationHelper', () => ({ translateCards: async (cards: Card[]) => cards }));

const { useDeckTokens } = await import('../useDeckTokens');

const fetchMock = vi.fn();

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });

/** A card whose text names a token, which is what deck analysis looks for. */
const generator = {
  id: 'krenko',
  name: 'Krenko, Mob Boss',
  type_line: 'Legendary Creature — Goblin Warrior',
  oracle_text: 'Create X 1/1 red Goblin creature tokens.'
} as Card;

/** Answers the preset-image request that fires on mount; every other call is per-test. */
const okEmptySearch = () => Promise.resolve({ ok: true, json: async () => ({ data: [] }) });

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
  fetchMock.mockImplementation(okEmptySearch);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  setOnline(true);
  vi.unstubAllGlobals();
});

describe('useDeckTokens', () => {
  describe('token search', () => {
    it('blames the connection, not the name, when there is none', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [] }));
      act(() => result.current.setSearchTerm('goblin'));

      setOnline(false);
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await act(async () => {
        await result.current.handleSearchTokens();
      });

      expect(result.current.searchError).toBe(i18n.t('search.scryfallOffline'));
    });

    it('reports a plain search failure as such while online', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [] }));
      act(() => result.current.setSearchTerm('goblin'));

      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      await act(async () => {
        await result.current.handleSearchTokens();
      });

      expect(result.current.searchError).toBe(i18n.t('tokens.searchError'));
    });

    it('says Scryfall is down when it answers 503', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [] }));
      act(() => result.current.setSearchTerm('goblin'));

      fetchMock.mockResolvedValue({ ok: false, status: 503 });
      await act(async () => {
        await result.current.handleSearchTokens();
      });

      expect(result.current.searchError).toBe(i18n.t('search.scryfallOffline'));
    });
  });

  describe('deck analysis', () => {
    it('reports the dropped connection instead of finishing quietly', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [generator] }));

      setOnline(false);
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await act(async () => {
        await result.current.handleAnalyzeDeck();
      });

      expect(dispatchToast).toHaveBeenCalledWith(i18n.t('search.scryfallOffline'), 'danger');
    });

    it('reports a failed lookup while online as an analysis failure', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [generator] }));

      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await act(async () => {
        await result.current.handleAnalyzeDeck();
      });

      expect(dispatchToast).toHaveBeenCalledWith(i18n.t('tokens.analysisError'), 'danger');
    });

    it('reports a Scryfall error status, since that is not an answer about the deck', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [generator] }));

      fetchMock.mockResolvedValue({ ok: false, status: 503 });
      await act(async () => {
        await result.current.handleAnalyzeDeck();
      });

      expect(dispatchToast).toHaveBeenCalledWith(i18n.t('tokens.analysisError'), 'danger');
    });

    // A 404 *is* an answer: Scryfall has no such card, so it makes no tokens.
    it('stays quiet when Scryfall answers that the card does not exist', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [generator] }));

      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      await act(async () => {
        await result.current.handleAnalyzeDeck();
      });

      expect(dispatchToast).not.toHaveBeenCalled();
    });

    it('never reaches the network for a deck with no token generators', async () => {
      const plain = { id: 'bolt', name: 'Lightning Bolt', type_line: 'Instant', oracle_text: 'Deal 3 damage.' } as Card;
      const onTokensLoaded = vi.fn();
      const { result } = renderHook(() => useDeckTokens({ cards: [plain], onTokensLoaded }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // the preset images

      await act(async () => {
        await result.current.handleAnalyzeDeck();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onTokensLoaded).toHaveBeenCalledWith([]);
      expect(dispatchToast).not.toHaveBeenCalled();
    });
  });
});
