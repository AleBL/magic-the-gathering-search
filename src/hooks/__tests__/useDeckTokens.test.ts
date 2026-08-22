import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import i18n from '../../plugins/i18n';
import { Card } from '../../types/Card';
import { TokenPreset } from '../../components/playtest/PlaytestTokenModal';

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

  // The quick-add path: no search, no modal, straight from the built-in list into the deck.
  describe('presets and the deck token list', () => {
    const soldier: TokenPreset = {
      id: 'token-soldier',
      name: 'Soldier',
      type_line: 'Token Creature — Soldier',
      colors: ['W'],
      power: '1',
      toughness: '1',
      oracle_text: '',
      rarity: 'common',
      set_name: 'Tokens',
      localeKey: 'soldierToken'
    };

    it('adds a preset as a token and publishes the new list', async () => {
      const onTokensLoaded = vi.fn();
      const { result } = renderHook(() => useDeckTokens({ cards: [], onTokensLoaded }));

      await act(async () => {
        await result.current.handlePresetClick(soldier);
      });

      expect(result.current.localTokens).toHaveLength(1);
      expect(result.current.localTokens[0].tokenCard.name).toBe('Soldier');
      expect(result.current.localTokens[0].tokenCard.type_line).toBe('Token Creature — Soldier');
      expect(onTokensLoaded).toHaveBeenCalledWith(result.current.localTokens);
    });

    // Two Soldiers are two tokens: a shared id would make deleting one delete both.
    it('gives repeated presets ids of their own', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [] }));

      await act(async () => {
        await result.current.handlePresetClick(soldier);
      });
      await act(async () => {
        await result.current.handlePresetClick(soldier);
      });

      const [first, second] = result.current.localTokens;
      expect(result.current.localTokens).toHaveLength(2);
      expect(first.tokenCard.id).not.toBe(second.tokenCard.id);
    });

    it('deletes the token asked for and leaves the rest', async () => {
      const onTokensLoaded = vi.fn();
      const { result } = renderHook(() => useDeckTokens({ cards: [], onTokensLoaded }));
      await act(async () => {
        await result.current.handlePresetClick(soldier);
      });
      await act(async () => {
        await result.current.handlePresetClick({ ...soldier, id: 'token-zombie', name: 'Zombie' });
      });
      const doomedId = result.current.localTokens[0].tokenCard.id;

      act(() => result.current.handleDeleteToken(doomedId));

      expect(result.current.localTokens.map((token) => token.tokenCard.name)).toEqual(['Zombie']);
      expect(onTokensLoaded).toHaveBeenLastCalledWith(result.current.localTokens);
    });

    // The list is the deck record's: a hook that only kept it locally would lose every
    // token the moment the tab remounted.
    it('starts from the tokens already stored on the deck', () => {
      const cached = [{ tokenCard: { id: 'stored-1', name: 'Treasure' } as Card, generatorCardName: 'Krenko' }];
      const { result } = renderHook(() => useDeckTokens({ cards: [], cachedTokens: cached }));

      expect(result.current.localTokens).toEqual(cached);
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

    // Scryfall not knowing the card *is* an answer: it makes no tokens. The collection
    // endpoint reports that as a 200 listing the identifier under `not_found`.
    it('stays quiet when Scryfall answers that the card does not exist', async () => {
      const { result } = renderHook(() => useDeckTokens({ cards: [generator] }));

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], not_found: [{ name: generator.name }] })
      });
      await act(async () => {
        await result.current.handleAnalyzeDeck();
      });

      expect(dispatchToast).not.toHaveBeenCalled();
    });

    // The generator lookup used to be one `/cards/named` request per card, fired through
    // Promise.all: a Commander deck opened dozens of connections at once and Scryfall
    // answered 429. Batching is what keeps the analysis inside the rate limit.
    it('asks about every generator in one request instead of one request each', async () => {
      const generators = Array.from({ length: 40 }, (_, index) => ({
        ...generator,
        id: `gen-${index}`,
        name: `Generator ${index}`
      })) as Card[];
      const { result } = renderHook(() => useDeckTokens({ cards: generators }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // the preset images
      fetchMock.mockClear();

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], not_found: [] })
      });
      await act(async () => {
        await result.current.handleAnalyzeDeck();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.scryfall.com/cards/collection');
      expect(JSON.parse(init.body).identifiers).toHaveLength(40);
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
