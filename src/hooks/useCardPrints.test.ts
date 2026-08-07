import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { makeCard } from '../test/factories';

/**
 * Phase 3 found the editions control simply disappearing when the connection was gone: an
 * aborted lookup ends as `done` with zero results — sometimes emitting nothing at all — which
 * reads as "this card has only one printing". The hook answers up front when the browser is
 * offline rather than depending on which event the SDK emits, and only an E2E covered it.
 */

const search = vi.hoisted(() => vi.fn());

vi.mock('scryfall-sdk', () => ({ Cards: { search } }));
vi.mock('../utils/toastHelper', () => ({ dispatchToast: vi.fn() }));

const { useCardPrints } = await import('./useCardPrints');

/** Stands in for the SDK's emitter, so a test can decide which events actually arrive. */
function emitterOf(script: (emit: (event: string, payload?: unknown) => void) => void) {
  const handlers = new Map<string, (payload?: unknown) => void>();
  const emitter = {
    on(event: string, handler: (payload?: unknown) => void) {
      handlers.set(event, handler);
      return emitter;
    },
    cancel: vi.fn()
  };
  queueMicrotask(() => script((event, payload) => handlers.get(event)?.(payload)));
  return emitter;
}

/**
 * Cards are created once, never inside the render callback. `useCardPrints` lists the card's
 * `colors` array among its effect dependencies, so a freshly built card each render re-runs
 * the lookup forever. Real callers pass a card held in state, so this is a test constraint —
 * but it is a sharp edge worth knowing about.
 */
const BOLT = makeCard({ id: 'p1', name: 'Lightning Bolt' });
const OTHER = makeCard({ id: 'p2', name: 'Lightning Bolt' });
const FIRST = makeCard({ id: 'first', name: 'first' });
const SECOND = makeCard({ id: 'second', name: 'second' });

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
});

afterEach(() => setOnline(true));

describe('useCardPrints', () => {
  it('asks for nothing when there is no card', () => {
    renderHook(() => useCardPrints(undefined));

    expect(search).not.toHaveBeenCalled();
  });

  // The fix: say it was a failed lookup instead of letting the control vanish.
  it('reports offline without asking the network at all', async () => {
    setOnline(false);

    const { result } = renderHook(() => useCardPrints(BOLT));

    await waitFor(() => expect(result.current.error).toBe('offline'));
    expect(search, 'a lookup was attempted with no connection').not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.prints).toEqual([]);
  });

  it('collects the printings it receives', async () => {
    search.mockImplementation(() =>
      emitterOf((emit) => {
        emit('data', { ...BOLT, lang: 'en' });
        emit('data', { ...OTHER, lang: 'en' });
        emit('done');
      })
    );

    const { result } = renderHook(() => useCardPrints(BOLT));

    await waitFor(() => expect(result.current.prints).toHaveLength(2));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // A dropped connection ends the same way a single-printing card does; only onLine tells them apart.
  it('marks an empty result as offline when the connection went away mid-lookup', async () => {
    search.mockImplementation(() =>
      emitterOf((emit) => {
        setOnline(false);
        emit('done');
      })
    );

    const { result } = renderHook(() => useCardPrints(BOLT));

    await waitFor(() => expect(result.current.error).toBe('offline'));
  });

  it('treats an empty result as a card with one printing while online', async () => {
    search.mockImplementation(() => emitterOf((emit) => emit('done')));

    const { result } = renderHook(() => useCardPrints(BOLT));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.prints).toEqual([]);
  });

  it('does not raise an error when the card is simply not found', async () => {
    search.mockImplementation(() => emitterOf((emit) => emit('not_found')));

    const { result } = renderHook(() => useCardPrints(BOLT));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('swallows a 404 but surfaces a real failure', async () => {
    search.mockImplementation(() => emitterOf((emit) => emit('error', new Error('404 not found'))));
    const notFound = renderHook(() => useCardPrints(BOLT));
    await waitFor(() => expect(notFound.result.current.isLoading).toBe(false));
    expect(notFound.result.current.error).toBeNull();

    search.mockImplementation(() => emitterOf((emit) => emit('error', new Error('500 boom'))));
    const failed = renderHook(() => useCardPrints(OTHER));
    await waitFor(() => expect(failed.result.current.error).toBe('500 boom'));
  });

  it('cancels the in-flight lookup when the card changes', async () => {
    const emitters: { cancel: ReturnType<typeof vi.fn> }[] = [];
    search.mockImplementation(() => {
      const emitter = emitterOf(() => undefined);
      emitters.push(emitter);
      return emitter;
    });

    const { rerender } = renderHook(({ card }: { card: typeof FIRST }) => useCardPrints(card), {
      initialProps: { card: FIRST }
    });
    rerender({ card: SECOND });

    await waitFor(() => expect(emitters[0].cancel).toHaveBeenCalled());
  });
});
