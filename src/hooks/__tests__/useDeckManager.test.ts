import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import i18n from '../../plugins/i18n';
import { Deck } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';
import { makeCard } from '../../test/factories';
import { buildDeckFileContent, encodeDeckToShareString } from '../../services/deckShare';
import { Card } from '../../types/Card';

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
vi.mock('../../db/database', () => ({
  db: {
    decks: {
      put: async (deck: Deck) => {
        putSpy(deck);
        decks.set(deck.id, deck);
      },
      bulkPut: async (list: Deck[]) => {
        for (const deck of list) {
          putSpy(deck);
          decks.set(deck.id, deck);
        }
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
vi.mock('../../services/deckVersionService', () => ({
  saveDeckSnapshot: vi.fn().mockResolvedValue(undefined),
  saveDeckSnapshotIfChanged: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../utils/toastHelper', () => ({ dispatchToast: vi.fn() }));

// Only the Scryfall round trip is stubbed. Parsing stays real, so these tests still prove
// that a `.dec` line or a share payload turns into the identifiers the lookup is asked for.
const resolveList = vi.hoisted(() => vi.fn());
vi.mock('../../services/deckImportService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/deckImportService')>()),
  fetchCardsFromParsedList: resolveList
}));

const { default: useDeckManager } = await import('../useDeckManager');

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
    resolveList.mockReset();
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

  describe('saveEditedDeck', () => {
    it('merges the edit into the stored deck without touching what was not sent', async () => {
      decks.set('a', { ...aDeck('a', 'Burn'), notes: 'sideboard notes', relatedTokens: [] });
      const { result } = setup();
      const cards = [makeCard({ name: 'Shock' })];

      let outcome;
      await act(async () => {
        outcome = await result.current.saveEditedDeck('a', '  Burn v2  ', DeckFormatType.MODERN, cards);
      });

      expect(outcome).toMatchObject({ success: true });
      const stored = decks.get('a')!;
      expect(stored.name).toBe('Burn v2');
      expect(stored.format).toBe(DeckFormatType.MODERN);
      expect(stored.cards).toEqual(cards);
      // Untouched fields survive: the info editor sends only name and format.
      expect(stored.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(stored.relatedTokens).toEqual([]);
    });

    // The edit dialog can outlive the deck — deleted in another tab, or undone. Writing here
    // would resurrect it under an id the deck list has already forgotten, so the callers get an
    // error to show instead of a success they would echo back into the screen.
    it('reports the deck is gone instead of claiming a write that never happened', async () => {
      const { result } = setup();

      let outcome;
      await act(async () => {
        outcome = await result.current.saveEditedDeck('ghost', 'Whatever', DeckFormatType.FREEFORM, [makeCard()]);
      });

      expect(putSpy).not.toHaveBeenCalled();
      expect(decks.has('ghost')).toBe(false);
      expect(outcome).toMatchObject({ success: false, errorKey: 'deck.deckGoneError' });
    });

    it('reports a write failure instead of claiming success', async () => {
      decks.set('a', aDeck('a'));
      putSpy.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      const { result } = setup();

      let outcome;
      await act(async () => {
        outcome = await result.current.saveEditedDeck('a', 'Burn', DeckFormatType.FREEFORM, [makeCard()]);
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

  describe('importDeckFile', () => {
    const jsonFile = (payload: unknown, name = 'decks.json') =>
      new File([JSON.stringify(payload)], name, { type: 'application/json' });

    // The round trip that was broken: exportAllDecks writes an array, and importing it
    // used to be refused as an invalid file.
    it('restores every deck from an "export all decks" file', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(jsonFile([aDeck('a', 'Atraxa'), aDeck('b', 'Krenko')]));
      });

      expect([...decks.values()].map((deck) => deck.name).sort()).toEqual(['Atraxa', 'Krenko']);
    });

    it('still imports a single exported deck', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(jsonFile(aDeck('a', 'Atraxa')));
      });

      expect([...decks.values()].map((deck) => deck.name)).toEqual(['Atraxa']);
    });

    it('reports a malformed file and writes nothing', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(jsonFile({ name: 'No cards here' }));
      });

      expect(result.current.fileImportError).toBeTruthy();
      expect(putSpy).not.toHaveBeenCalled();
    });

    // A file that parses fine and then cannot be written is the last place this path can
    // fail silently: the modal would sit on a finished progress bar over an empty deck list.
    it('reports a write that failed mid-import instead of finishing the modal', async () => {
      putSpy.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(jsonFile(aDeck('a', 'Atraxa')));
      });

      expect(result.current.fileImportError).toBe(i18n.t('deck.invalidFile'));
      expect(decks.size).toBe(0);
    });
  });

  // Everything that is not the `.json` happy path: the other three extensions the router
  // knows, the ones it does not, and a file the browser cannot read at all. This is the
  // class of failure that costs the most here, because it fails quietly — the modal closes
  // and nothing says which of the two Scryfall or the file was the problem.
  describe('importDeckFile: lists, share files and unreadable files', () => {
    const textFile = (name: string, body: string) => new File([body], name, { type: 'text/plain' });

    const storedDecks = () => [...decks.values()];

    it.each(['Burn.dec', 'Burn.txt'])('imports %s as a text list named after the file', async (fileName) => {
      const resolved = makeCard({ name: 'Lightning Bolt' });
      resolveList.mockResolvedValue({ cards: [resolved], missing: [] });

      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(textFile(fileName, '4 Lightning Bolt\n'));
      });

      const [stored] = storedDecks();
      // The extension is not part of the deck name: it would show up in the deck list and
      // in every export made from it.
      expect(stored.name).toBe('Burn');
      expect(stored.format).toBe(DeckFormatType.FREEFORM);
      expect(stored.cards).toEqual([resolved]);
      expect(resolveList.mock.calls[0][0]).toMatchObject([{ name: 'Lightning Bolt', quantity: 4 }]);
    });

    // The modal opens on a placeholder total, because the file has not been parsed yet. What
    // it ends up showing has to come from the lookup, and has to finish full rather than
    // stopping wherever the last chunk left it.
    it('carries the lookup progress into the modal and finishes it filled', async () => {
      resolveList.mockImplementation(async (_entries, _lang, onProgress) => {
        onProgress({ isImporting: true, current: 3, total: 9, message: 'resolving' });
        return { cards: [makeCard()], missing: [] };
      });

      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(textFile('Burn.dec', '4 Lightning Bolt\n'));
      });

      expect(result.current.importProgress).toEqual({
        isImporting: false,
        current: 9,
        total: 9,
        message: 'resolving'
      });
    });

    // A `.deck` file is a share payload with a header; the round trip is asserted against
    // the real writer so a change to either end fails here.
    it('imports a .deck share file by resolving the list it carries', async () => {
      const shared: Deck = { ...aDeck('source', 'Shared Burn'), format: DeckFormatType.MODERN };
      const resolved = makeCard({ name: 'Lightning Bolt' });
      resolveList.mockResolvedValue({ cards: [resolved], missing: [] });

      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(new File([buildDeckFileContent(shared)], 'shared.deck'));
      });

      const [stored] = storedDecks();
      expect(stored.name).toBe('Shared Burn');
      expect(stored.format).toBe(DeckFormatType.MODERN);
      expect(stored.cards).toEqual([resolved]);
      // A new id, or importing a deck twice would overwrite the first copy.
      expect(stored.id).not.toBe('source');
    });

    it('reports a .deck file with no payload in it and writes nothing', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(new File(['# just a header\n'], 'shared.deck'));
      });

      expect(result.current.fileImportError).toBe(i18n.t('deck.invalidFile'));
      expect(decks.size).toBe(0);
    });

    it('reports a text list with no card lines in it and writes nothing', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(textFile('Burn.txt', '// only a comment\n'));
      });

      expect(result.current.fileImportError).toBe(i18n.t('deck.invalidFile'));
      expect(decks.size).toBe(0);
      expect(resolveList).not.toHaveBeenCalled();
    });

    it('refuses an extension it does not know, with the modal open to say so', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(new File(['whatever'], 'deck.pdf'));
      });

      expect(result.current.fileImportError).toBe(i18n.t('deck.invalidFile'));
      expect(result.current.isFileImportModalOpen).toBe(true);
      expect(decks.size).toBe(0);
    });

    // A FileReader that errors never fires `onload`. If the reader's failure did not resolve
    // the read, the import would sit on a spinner that nothing ever clears.
    it('reports a file the browser could not read instead of waiting on it', async () => {
      const RealFileReader = globalThis.FileReader;
      class UnreadableFileReader {
        error = new Error('NotReadableError');
        onload: ((event: unknown) => void) | null = null;
        onerror: (() => void) | null = null;
        readAsText() {
          queueMicrotask(() => this.onerror?.());
        }
      }
      globalThis.FileReader = UnreadableFileReader as unknown as typeof FileReader;

      try {
        const { result } = setup();
        await act(async () => {
          await result.current.importDeckFile(textFile('Burn.dec', '4 Lightning Bolt\n'));
        });

        expect(result.current.fileImportError).toBe(i18n.t('deck.invalidFile'));
        expect(result.current.importProgress.isImporting).toBe(false);
        expect(decks.size).toBe(0);
      } finally {
        globalThis.FileReader = RealFileReader;
      }
    });

    // Scryfall's own failures have to arrive as themselves: "the deck could not be imported"
    // over a rate limit sends the user back to a file that was never the problem.
    it.each([
      ['ScryfallOffline', 'search.scryfallOffline'],
      ['ScryfallRateLimited', 'search.rateLimited'],
      ['Scryfall API error', 'deck.importError']
    ])('reports a %s from the card lookup under its own message', async (thrown, messageKey) => {
      resolveList.mockRejectedValue(new Error(thrown));

      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(textFile('Burn.dec', '4 Lightning Bolt\n'));
      });

      expect(result.current.fileImportError).toBe(i18n.t(messageKey));
      expect(decks.size).toBe(0);
    });

    it('refuses a list where nothing resolved rather than storing an empty deck', async () => {
      resolveList.mockResolvedValue({ cards: [], missing: ['Blacker Lotus'] });

      const { result } = setup();
      await act(async () => {
        await result.current.importDeckFile(textFile('Burn.dec', '4 Blacker Lotus\n'));
      });

      expect(result.current.fileImportError).toBe(i18n.t('deck.importError'));
      expect(result.current.fileMissingCards).toEqual(['Blacker Lotus']);
      expect(decks.size).toBe(0);
    });
  });

  describe('importSharedDeckString', () => {
    /** Hand-built payloads, for share shapes `encodeDeckToShareString` cannot produce. */
    const encodePayload = (payload: unknown): string =>
      btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    it('stores the deck a valid share string describes', async () => {
      const shared: Deck = { ...aDeck('source', 'Shared Burn'), format: DeckFormatType.MODERN };
      const resolved = makeCard({ name: 'Lightning Bolt' });
      resolveList.mockResolvedValue({ cards: [resolved], missing: [] });

      const { result } = setup();
      await act(async () => {
        await result.current.importSharedDeckString(encodeDeckToShareString(shared));
      });

      const [stored] = [...decks.values()];
      expect(stored.name).toBe('Shared Burn');
      expect(stored.format).toBe(DeckFormatType.MODERN);
      expect(stored.cards).toEqual([resolved]);
      expect(result.current.fileImportError).toBeNull();
    });

    // A link shared with no deck name still has to land under something readable, and in a
    // format the deck screen can render.
    it('names an unnamed share and gives it a format', async () => {
      resolveList.mockResolvedValue({ cards: [makeCard()], missing: [] });

      const { result } = setup();
      await act(async () => {
        await result.current.importSharedDeckString(encodePayload({ v: 1, n: '', c: [{ q: 1, n: 'Lightning Bolt' }] }));
      });

      const [stored] = [...decks.values()];
      expect(stored.name).toBe(i18n.t('deck.importedDeckName'));
      expect(stored.format).toBe(DeckFormatType.FREEFORM);
    });

    // Opening the modal is the point: a broken link that closed it silently is exactly the
    // failure this path exists to avoid.
    it('opens the modal to report a broken share link', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.importSharedDeckString('not-a-real-payload!!');
      });

      expect(result.current.isFileImportModalOpen).toBe(true);
      expect(result.current.fileImportError).toBe(i18n.t('deck.invalidShareLink'));
      expect(decks.size).toBe(0);
    });
  });
});
