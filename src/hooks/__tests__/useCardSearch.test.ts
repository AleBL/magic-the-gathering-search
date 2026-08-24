import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import i18n from '../../plugins/i18n';
import { SearchFilters } from '../../types';

/**
 * How one `Cards.search` call ends. `done` is the happy path; the others are the endings the
 * real emitter also has and that the hook has to tell apart. `never` emits nothing at all,
 * which is the only way to reach the 6 s timeout from outside the module.
 */
type EmitterScript =
  | { ending: 'done' | 'cancel'; cards?: unknown[]; hasMore?: boolean }
  | { ending: 'not_found' }
  | { ending: 'error'; error: Error }
  | { ending: 'never' };

const { emitted, script } = vi.hoisted(() => ({
  /** Payload the stubbed emitter hands to the hook by default; empty means "no results". */
  emitted: [] as unknown[],
  /**
   * Per-test override. Receives the query the hook built and the page it asked for, and
   * returns that call's script — or a promise the test settles later, which is how two
   * searches are made to answer out of order.
   */
  script: { respond: null as null | ((query: string, page: number) => unknown) }
}));

/**
 * `useCardSearch` searches Scryfall on mount, so the SDK is stubbed: these tests are
 * about how filter state turns into a Scryfall query string and what the hook accepts
 * back, not about the network. The emitter only needs the surface the hook drives.
 */
vi.mock('scryfall-sdk', () => {
  const search = (query: string, options: { page: number }) => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const emitter = {
      // The real emitter marks itself cancelled at the page boundary, which is what the hook
      // reads as "there is a next page"; without it `loadNextPage` never runs.
      cancelled: true,
      cancelAfterPage: () => emitter,
      cancel: () => emitter,
      on(event: string, callback: (...args: unknown[]) => void) {
        handlers.set(event, callback);
        return emitter;
      }
    };

    const planned = script.respond ? script.respond(query, options.page) : { ending: 'done', cards: emitted };

    // The hook registers every listener synchronously while building the promise it returns,
    // so dispatching a microtask later always finds them in place.
    Promise.resolve(planned).then((settled) => {
      const plan = settled as EmitterScript;
      if (plan.ending === 'never') return;

      if (plan.ending === 'done' || plan.ending === 'cancel') {
        emitter.cancelled = plan.hasMore ?? true;
        (plan.cards ?? []).forEach((card) => handlers.get('data')?.(card));
      }

      if (plan.ending === 'error') handlers.get('error')?.(plan.error);
      else handlers.get(plan.ending)?.();
    });

    return emitter;
  };

  return { Cards: { search } };
});

import { EMPTY_SEARCH_FILTERS } from '../../constants';

const { useCardSearch } = await import('../useCardSearch');

/** A script the test settles by hand, so it decides which search answers first. */
const deferScript = () => {
  let settle!: (plan: EmitterScript) => void;
  const promise = new Promise<EmitterScript>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

// A macrotask boundary drains the whole microtask queue, so a settled script always reaches
// the hook in one step. Counting `await Promise.resolve()` hops instead would tie the test to
// how many promises the production chain happens to have.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const withFilters = async (overrides: Partial<SearchFilters>) => {
  const { result } = renderHook(() => useCardSearch('en'));
  await act(async () => {
    result.current.setFilters({ ...EMPTY_SEARCH_FILTERS, ...overrides });
  });
  return result;
};

/** Renders the hook and waits for the search it fires on mount to settle. */
const withResults = async (payload: unknown[]) => {
  emitted.push(...payload);
  const { result } = renderHook(() => useCardSearch('en'));
  await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));
  return result;
};

const resetSearchStub = () => {
  emitted.length = 0;
  script.respond = null;
  vi.clearAllMocks();
};

describe('useCardSearch results', () => {
  beforeEach(resetSearchStub);

  // Scryfall's payload is unvalidated at this point: an entry with no id cannot be added
  // to a deck or looked up again, so it must be dropped rather than rendered blank.
  it('drops results that are not usable cards', async () => {
    const result = await withResults([
      { id: 'a', name: 'Lightning Bolt', oracle_id: 'o1' },
      null,
      { name: 'No id' },
      'nope',
      { id: 'b', name: 'Shock', oracle_id: 'o2' }
    ]);

    expect(result.current.cards.map((card) => card.name)).toEqual(['Lightning Bolt', 'Shock']);
  });

  // Deduplication keys on oracle_id; without a fallback, two printings that carry none
  // both key on `undefined` and collapse into a single result.
  it('keeps distinct printings that carry no oracle_id', async () => {
    const result = await withResults([
      { id: 'a', name: 'Lightning Bolt' },
      { id: 'b', name: 'Shock' }
    ]);

    expect(result.current.cards.map((card) => card.name)).toEqual(['Lightning Bolt', 'Shock']);
  });

  // With no connection the emitter completes empty instead of erroring, which is the exact
  // shape of a query nothing matches: the grid said "No cards found" and offered to adjust
  // filters that were never the problem.
  it('calls an empty result offline what it is, rather than no matches', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    try {
      const result = await withResults([]);
      expect(result.current.cards).toEqual([]);
      expect(result.current.error).toBe(i18n.t('search.scryfallOffline'));
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
  });

  it('leaves an empty result unexplained when the connection is fine', async () => {
    const result = await withResults([]);
    expect(result.current.error).toBeNull();
  });

  // Losing the connection mid-scroll used to just stop the list growing, silently.
  it('reports the dropped connection when the next page comes back empty', async () => {
    const result = await withResults([{ id: 'a', name: 'Lightning Bolt', oracle_id: 'o1' }]);
    emitted.length = 0;

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    try {
      await act(async () => {
        await result.current.loadNextPage();
      });
      expect(result.current.error).toBe(i18n.t('search.scryfallOffline'));
      expect(result.current.hasMore).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
  });
});

// Every ending the Scryfall emitter can reach other than a clean `done`. They are what runs
// when the network answers differently from the happy path, and the whole class fails
// quietly: the list stops growing and nothing on screen says why.
describe('useCardSearch network endings', () => {
  beforeEach(resetSearchStub);

  // `not_found` is Scryfall saying the query matched nothing. It is not an error and it is
  // not a page boundary, so paging has to close instead of asking for a page 2 that the
  // endpoint has already refused.
  it('treats a query that matched nothing as an empty, finished result', async () => {
    script.respond = () => ({ ending: 'not_found' });

    const { result } = renderHook(() => useCardSearch('en'));
    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    expect(result.current.cards).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  // A cancelled emitter still holds the cards it received. Resolving it as empty-and-finished
  // would let an abandoned search close the paging of the search that replaced it.
  it('keeps what a cancelled page already delivered, with paging still open', async () => {
    script.respond = () => ({ ending: 'cancel', cards: [{ id: 'a', name: 'Lightning Bolt', oracle_id: 'o1' }] });

    const { result } = renderHook(() => useCardSearch('en'));
    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    expect(result.current.cards.map((card) => card.name)).toEqual(['Lightning Bolt']);
    expect(result.current.hasMore).toBe(true);
  });

  // Scryfall answers "no cards match" with a 404 on some routes. Surfacing it as a failure
  // would put an error banner over what is really an empty result.
  it('reads a 404 as an empty result rather than a failure', async () => {
    script.respond = () => ({ ending: 'error', error: Object.assign(new Error('Not Found'), { status: 404 }) });

    const { result } = renderHook(() => useCardSearch('en'));
    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    expect(result.current.cards).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  // The SDK does not always attach a status; on those rejections the code is the only place
  // 404 appears at all.
  it('reads a 404 carried only in the message the same way', async () => {
    script.respond = () => ({ ending: 'error', error: new Error('Request failed with status code 404') });

    const { result } = renderHook(() => useCardSearch('en'));
    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    expect(result.current.cards).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('names a rate limit as a rate limit', async () => {
    script.respond = () => ({ ending: 'error', error: Object.assign(new Error('Too Many Requests'), { status: 429 }) });

    const { result } = renderHook(() => useCardSearch('en'));
    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    expect(result.current.error).toBe(i18n.t('search.rateLimited'));
  });

  // A failure with nothing actionable in it still has to say something; the generic message
  // is the fallback, not silence.
  it('falls back to the generic message for a failure it cannot name', async () => {
    script.respond = () => ({ ending: 'error', error: new Error('socket hang up') });

    const { result } = renderHook(() => useCardSearch('en'));
    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    expect(result.current.error).toBe(i18n.t('search.error'));
    expect(result.current.isLoadingInitial).toBe(false);
  });

  // An emitter that never emits anything is what a hung connection looks like from here: no
  // data, no done, no error. Without the 6 s race the spinner would simply never stop.
  it('gives up on a search that never answers', async () => {
    vi.useFakeTimers();
    try {
      script.respond = () => ({ ending: 'never' });

      const { result } = renderHook(() => useCardSearch('en'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      expect(result.current.error).toBe(i18n.t('search.scryfallOffline'));
      expect(result.current.isLoadingInitial).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  // Two searches in flight, the abandoned one answering last. Every write in `loadFirstPage`
  // is guarded by the search id for this: the old answer must not repaint the grid, and it
  // must not clear the loading flag that belongs to the search still running.
  it('lets a replaced search finish without touching the screen', async () => {
    const result = await withResults([]);

    const stale = deferScript();
    const current = deferScript();
    script.respond = (query) => (query.startsWith('old') ? stale.promise : current.promise);

    await act(async () => {
      void result.current.loadFirstPage('old');
    });
    await act(async () => {
      void result.current.loadFirstPage('new');
    });
    expect(result.current.isLoadingInitial).toBe(true);

    await act(async () => {
      stale.settle({ ending: 'done', cards: [{ id: 'old', name: 'Stale Result', oracle_id: 'o-old' }] });
      await flush();
    });

    expect(result.current.cards).toEqual([]);
    // The flag belongs to the search still running; clearing it here would hide a spinner
    // over a grid that has nothing in it yet.
    expect(result.current.isLoadingInitial).toBe(true);

    await act(async () => {
      current.settle({ ending: 'done', cards: [{ id: 'new', name: 'Fresh Result', oracle_id: 'o-new' }] });
      await flush();
    });

    expect(result.current.cards.map((card) => card.name)).toEqual(['Fresh Result']);
    expect(result.current.isLoadingInitial).toBe(false);
  });

  // Same race, failing side: a search the user has moved on from must not put an error
  // banner over results that arrived fine.
  it('does not let a replaced search report its failure', async () => {
    const result = await withResults([]);

    const stale = deferScript();
    const current = deferScript();
    script.respond = (query) => (query.startsWith('old') ? stale.promise : current.promise);

    await act(async () => {
      void result.current.loadFirstPage('old');
    });
    await act(async () => {
      void result.current.loadFirstPage('new');
    });

    await act(async () => {
      current.settle({ ending: 'done', cards: [{ id: 'new', name: 'Fresh Result', oracle_id: 'o-new' }] });
      await flush();
    });
    await act(async () => {
      stale.settle({ ending: 'error', error: Object.assign(new Error('Too Many Requests'), { status: 429 }) });
      await flush();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.cards.map((card) => card.name)).toEqual(['Fresh Result']);
  });

  // The same guard on the paging side: a page 2 belonging to the previous query would append
  // its cards to a list the user is no longer looking at.
  it('drops a next page that lands after a new search replaced the list', async () => {
    const result = await withResults([{ id: 'a', name: 'First Page', oracle_id: 'o1' }]);

    const nextPage = deferScript();
    script.respond = (_query, page) =>
      page === 2 ? nextPage.promise : { ending: 'done', cards: [{ id: 'b', name: 'Second Search', oracle_id: 'o2' }] };

    await act(async () => {
      void result.current.loadNextPage();
    });
    await act(async () => {
      await result.current.loadFirstPage('other');
    });

    await act(async () => {
      nextPage.settle({ ending: 'done', cards: [{ id: 'c', name: 'Stale Page', oracle_id: 'o3' }] });
      await flush();
    });

    expect(result.current.cards.map((card) => card.name)).toEqual(['Second Search']);
  });

  // A reader in pt gets two requests per page, one per language, and the English one fills
  // the gaps: most cards have no localized printing at all.
  it('merges the English page into the localized one when the language is not English', async () => {
    script.respond = (query) =>
      query.includes('lang:pt')
        ? { ending: 'done', cards: [{ id: 'p1', name: 'Relâmpago', oracle_id: 'o1', lang: 'pt' }] }
        : {
            ending: 'done',
            cards: [
              { id: 'e1', name: 'Lightning Bolt', oracle_id: 'o1', lang: 'en' },
              { id: 'e2', name: 'Shock', oracle_id: 'o2', lang: 'en' }
            ]
          };

    const { result } = renderHook(() => useCardSearch('pt'));
    await waitFor(() => expect(result.current.isLoadingInitial).toBe(false));

    // The card that exists in pt keeps its localized printing; the one that does not still
    // shows up, in English, instead of disappearing from the grid.
    expect(result.current.cards.map((card) => card.name)).toEqual(['Relâmpago', 'Shock']);
  });

  // The counterpart of the failure below, and the reason it is worth having: a page 2 that
  // replaced the list, or that re-added a printing page 1 already showed, fails just as
  // quietly as one that never arrives.
  it('appends each further page to the list and asks for the next one', async () => {
    const result = await withResults([{ id: 'a', name: 'First Page', oracle_id: 'o1' }]);

    const pagesAsked: number[] = [];
    script.respond = (_query, page) => {
      pagesAsked.push(page);
      return {
        ending: 'done',
        cards:
          page === 2
            ? [{ id: 'b', name: 'Page 2', oracle_id: 'o2' }]
            : [
                { id: 'b', name: 'Page 2', oracle_id: 'o2' },
                { id: 'c', name: 'Page 3', oracle_id: 'o3' }
              ]
      };
    };

    await act(async () => {
      await result.current.loadNextPage();
    });
    await act(async () => {
      await result.current.loadNextPage();
    });

    expect(pagesAsked).toEqual([2, 3]);
    expect(result.current.cards.map((card) => card.name)).toEqual(['First Page', 'Page 2', 'Page 3']);
  });

  // A failed page 2 has to close paging as well as report: leaving `hasMore` true asks the
  // infinite scroll to keep retrying a request that just failed.
  it('stops paging and says why when the next page fails', async () => {
    const result = await withResults([{ id: 'a', name: 'Lightning Bolt', oracle_id: 'o1' }]);
    script.respond = () => ({ ending: 'error', error: Object.assign(new Error('Too Many Requests'), { status: 429 }) });

    await act(async () => {
      await result.current.loadNextPage();
    });

    expect(result.current.error).toBe(i18n.t('search.rateLimited'));
    expect(result.current.hasMore).toBe(false);
    expect(result.current.cards.map((card) => card.name)).toEqual(['Lightning Bolt']);
  });
});

describe('useCardSearch.buildQuery', () => {
  beforeEach(resetSearchStub);

  it('falls back to the default query when there is no text and no filter', async () => {
    const result = await withFilters({});
    expect(result.current.buildQuery('')).toBe('c>=1');
  });

  it('uses the typed text as-is, trimmed', async () => {
    const result = await withFilters({});
    expect(result.current.buildQuery('  lightning bolt  ')).toBe('lightning bolt');
  });

  // The default query exists only to give an empty search *something* to show. Once a
  // filter is set it would fight the filter, so it must drop out.
  it('drops the default query once a filter is active', async () => {
    const result = await withFilters({ rarity: 'rare' });
    expect(result.current.buildQuery('')).toBe('r:rare');
  });

  it('joins colours into a single Scryfall colour term', async () => {
    const result = await withFilters({ colors: ['W', 'U'] });
    expect(result.current.buildQuery('')).toBe('c:WU');
  });

  // 'C' is Scryfall's colourless keyword, not a sixth colour letter — emitting `c:C`
  // would search for cards that are white-blue-black-red-green *and* colourless.
  it('translates the colourless filter to the dedicated keyword', async () => {
    const result = await withFilters({ colors: ['C'] });
    expect(result.current.buildQuery('')).toBe('c:c');
  });

  it('space-separates multiple types under one term', async () => {
    const result = await withFilters({ types: ['creature', 'instant'] });
    expect(result.current.buildQuery('')).toBe('t:creature instant');
  });

  it('emits cmc as an equality term', async () => {
    const result = await withFilters({ cmc: '3' });
    expect(result.current.buildQuery('')).toBe('cmc=3');
  });

  it('combines typed text with every filter, single-spaced', async () => {
    const result = await withFilters({ colors: ['R'], types: ['instant'], rarity: 'common', cmc: '1' });
    expect(result.current.buildQuery('bolt')).toBe('bolt c:R t:instant r:common cmc=1');
  });

  // Asserted whole rather than as "no leading space": the empty head has to disappear from
  // the joined query, and a negative match on whitespace is also true of a query that came
  // back empty or wrong.
  it('does not leave a leading space when only filters are set', async () => {
    const result = await withFilters({ colors: ['G'] });
    expect(result.current.buildQuery('')).toBe('c:G');
  });
});
