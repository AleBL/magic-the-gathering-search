import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Deck } from '../types/Deck';
import { DeckFormatType } from '../types/enums';
import { makeCard } from '../test/factories';
import { Card } from '../types/Card';

/**
 * The deck store is IndexedDB. These tests stand a fake table in its place so the
 * persistence *decisions* can be asserted — what gets written, what is refused, what
 * happens when a write throws — without a real database.
 */
const decks = vi.hoisted(() => new Map<string, Deck>());
const putSpy = vi.hoisted(() => vi.fn());

// A fresh [] per call would give every consumer a new reference each render and spin the
// hook's effects forever — the same defect this codebase has already been bitten by twice.
const liveDecks = vi.hoisted(() => [] as Deck[]);
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => liveDecks }));
vi.mock('../db/database', () => ({
  db: {
    decks: {
      put: async (deck: Deck) => {
        putSpy(deck);
        decks.set(deck.id, deck);
      },
      get: async (id: string) => decks.get(id),
      delete: async (id: string) => void decks.delete(id),
      orderBy: () => ({ toArray: async () => [...decks.values()] }),
      toArray: async () => [...decks.values()]
    },
    deckVersions: { where: () => ({ equals: () => ({ toArray: async () => [] }) }), put: async () => undefined }
  }
}));
// Version snapshots are a separate concern with their own service; silence them here.
vi.mock('../services/deckVersionService', () => ({
  saveDeckSnapshot: vi.fn().mockResolvedValue(undefined),
  saveDeckSnapshotIfChanged: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../utils/toastHelper', () => ({ dispatchToast: vi.fn() }));

const { default: useDeckManager } = await import('./useDeckManager');

// Stable identity matters here too: the hook validates the deck in an effect keyed on
// `currentDeck`, so passing a literal [] would hand it a new array every render and spin
// effect -> setState -> render forever. In the app this comes from the store and is stable.
const NO_CARDS: Card[] = [];

const setup = (onCancelEdit = vi.fn()) =>
  renderHook(() => useDeckManager(NO_CARDS, null, DeckFormatType.FREEFORM, onCancelEdit));

const aDeck = (id: string, name = `Deck ${id}`): Deck => ({
  id,
  name,
  format: DeckFormatType.FREEFORM,
  cards: [makeCard()],
  createdAt: '2026-01-01T00:00:00.000Z'
});

describe('useDeckManager', () => {
  beforeEach(() => {
    decks.clear();
    putSpy.mockClear();
  });

  describe('saveDeck', () => {
    it('refuses a blank name and writes nothing', async () => {
      const { result } = setup();
      let outcome;
      await act(async () => {
        outcome = await result.current.saveDeck('   ', DeckFormatType.FREEFORM, [makeCard()]);
      });

      expect(outcome).toMatchObject({ success: false, errorKey: 'deckNamePlaceholder' });
      expect(putSpy).not.toHaveBeenCalled();
    });

    it('refuses an empty deck and writes nothing', async () => {
      const { result } = setup();
      let outcome;
      await act(async () => {
        outcome = await result.current.saveDeck('Empty', DeckFormatType.FREEFORM, []);
      });

      expect(outcome).toMatchObject({ success: false, errorKey: 'addCardsMessage' });
      expect(putSpy).not.toHaveBeenCalled();
    });

    it('persists the deck and hands back what it created', async () => {
      const { result } = setup();
      const cards = [makeCard({ name: 'Lightning Bolt' })];
      let outcome: { success: boolean; createdDeck?: Deck } | undefined;
      await act(async () => {
        outcome = await result.current.saveDeck('  Burn  ', DeckFormatType.MODERN, cards);
      });

      expect(outcome!.success).toBe(true);
      // Trimmed: a trailing space would show up in the deck list and in exports.
      expect(outcome!.createdDeck).toMatchObject({ name: 'Burn', format: DeckFormatType.MODERN });
      expect(decks.get(outcome!.createdDeck!.id)?.cards).toEqual(cards);
    });

    it('reports a write failure instead of claiming success', async () => {
      putSpy.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      const { result } = setup();
      let outcome;
      await act(async () => {
        outcome = await result.current.saveDeck('Burn', DeckFormatType.FREEFORM, [makeCard()]);
      });

      expect(outcome).toMatchObject({ success: false, errorKey: 'deck.saveError' });
    });
  });

  describe('deleteDeck', () => {
    it('removes the deck and returns it, so the undo toast has something to restore', async () => {
      decks.set('a', aDeck('a', 'Doomed'));
      const { result } = setup();

      let removed: Deck | undefined;
      await act(async () => {
        removed = await result.current.deleteDeck('a');
      });

      expect(removed?.name).toBe('Doomed');
      expect(decks.has('a')).toBe(false);
    });

    it('returns undefined for a deck that is not there', async () => {
      const { result } = setup();
      let removed: Deck | undefined;
      await act(async () => {
        removed = await result.current.deleteDeck('ghost');
      });

      expect(removed).toBeUndefined();
    });

    it('cancels the edit session when the deck being edited is deleted', async () => {
      decks.set('a', aDeck('a'));
      const onCancelEdit = vi.fn();
      const { result } = renderHook(() => useDeckManager(NO_CARDS, 'a', DeckFormatType.FREEFORM, onCancelEdit));

      await act(async () => {
        await result.current.deleteDeck('a');
      });

      expect(onCancelEdit).toHaveBeenCalled();
    });
  });

  describe('restoreDeck', () => {
    it('puts a deleted deck back', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.restoreDeck(aDeck('a', 'Back'));
      });

      expect(decks.get('a')?.name).toBe('Back');
    });

    // Undo can be clicked late. If the id has been reused in the meantime, restoring
    // would overwrite whatever is there now.
    it('does not overwrite a deck that already exists at that id', async () => {
      decks.set('a', aDeck('a', 'Current'));
      const { result } = setup();

      await act(async () => {
        await result.current.restoreDeck(aDeck('a', 'Stale'));
      });

      expect(decks.get('a')?.name).toBe('Current');
    });
  });

  describe('duplicateDeck', () => {
    it('copies under a new id so saving the copy cannot clobber the original', async () => {
      const original = aDeck('a', 'Mono Red');
      const { result } = setup();

      let copy: Deck | undefined;
      await act(async () => {
        copy = await result.current.duplicateDeck(original);
      });

      expect(copy!.id).not.toBe('a');
      expect(copy!.name).not.toBe('Mono Red');
      expect(copy!.cards).toEqual(original.cards);
      expect(decks.has('a')).toBe(false); // original was never in the fake table
    });
  });
});
