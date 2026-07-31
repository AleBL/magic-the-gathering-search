import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDeckActions } from './useDeckActions';
import { useDeckStore } from '../store/useDeckStore';
import { makeCard } from '../test/factories';

// The add path fans out to Scryfall to look for related tokens; that is not what these
// tests are about, so the SDK is stubbed to find nothing.
vi.mock('scryfall-sdk', () => ({
  Cards: { byName: vi.fn().mockRejectedValue(new Error('no network in tests')), byId: vi.fn() }
}));

const setup = () => {
  const showToast = vi.fn();
  const { result } = renderHook(() => useDeckActions(showToast));
  return { showToast, result };
};

describe('useDeckActions', () => {
  beforeEach(() => {
    useDeckStore.setState({ currentDeck: [], currentDeckRelatedTokens: [] });
  });

  it('adds a card to the deck and confirms it by name', async () => {
    const card = makeCard({ name: 'Lightning Bolt' });
    const { showToast, result } = setup();

    await act(async () => result.current.handleAddToDeck(card));

    expect(useDeckStore.getState().currentDeck.map((c) => c.name)).toEqual(['Lightning Bolt']);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Lightning Bolt'));
  });

  it('removes a card and offers an undo action', async () => {
    const card = makeCard({ name: 'Counterspell' });
    const { showToast, result } = setup();
    await act(async () => result.current.handleAddToDeck(card));
    showToast.mockClear();

    act(() => result.current.handleRemoveFromDeckWithToast(card));

    expect(useDeckStore.getState().currentDeck).toHaveLength(0);
    const [, , action] = showToast.mock.calls[0];
    expect(action).toMatchObject({ label: expect.any(String), onClick: expect.any(Function) });
  });

  // The removal toast used to interpolate a hardcoded Portuguese "Removido", so an
  // English or Spanish user got one word of Portuguese in an otherwise translated app.
  it('translates the removal message instead of hardcoding one language', async () => {
    const card = makeCard({ name: 'Counterspell' });
    const { showToast, result } = setup();
    await act(async () => result.current.handleAddToDeck(card));
    showToast.mockClear();

    act(() => result.current.handleRemoveFromDeckWithToast(card));

    expect(showToast.mock.calls[0][0]).not.toMatch(/Removido/);
  });

  it('puts the card back when undo is invoked', async () => {
    const card = makeCard({ name: 'Brainstorm' });
    const { showToast, result } = setup();
    await act(async () => result.current.handleAddToDeck(card));
    act(() => result.current.handleRemoveFromDeckWithToast(card));

    const undo = showToast.mock.calls.at(-1)![2] as { onClick: () => void };
    await act(async () => undo.onClick());

    expect(useDeckStore.getState().currentDeck.map((c) => c.name)).toEqual(['Brainstorm']);
  });

  it('says nothing when removing a card the deck does not hold', () => {
    const { showToast, result } = setup();

    act(() => result.current.handleRemoveFromDeckWithToast(makeCard({ name: 'Absent' })));

    expect(showToast).not.toHaveBeenCalled();
  });

  it('adds a manual token with an id of its own', () => {
    const token = makeCard({ id: 'tok-1', name: 'Treasure' });
    const { result } = setup();

    act(() => result.current.handleAddTokenToDeck(token));

    const tokens = useDeckStore.getState().currentDeckRelatedTokens;
    expect(tokens).toHaveLength(1);
    // Re-adding the same token must not collide with the copy already there.
    expect(tokens[0].tokenCard.id).not.toBe('tok-1');
  });

  it('keeps repeated copies of the same token', () => {
    const token = makeCard({ id: 'tok-1', name: 'Treasure' });
    const { result } = setup();

    act(() => result.current.handleAddTokenToDeck(token));
    act(() => result.current.handleAddTokenToDeck(token));

    expect(useDeckStore.getState().currentDeckRelatedTokens).toHaveLength(2);
  });
});
