import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import i18n from '../../plugins/i18n';
import { useDeckActions } from '../useDeckActions';
import { useDeckStore } from '../../store/useDeckStore';
import { makeCard } from '../../test/factories';

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
  const originalLanguage = i18n.language;

  beforeEach(() => {
    useDeckStore.setState({ currentDeck: [], currentDeckRelatedTokens: [] });
  });

  // The language is process-wide: leaving it switched would silently retranslate every
  // suite that runs after this file.
  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
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
  // Asserted by switching the language: any message hardcoded in one language is wrong in
  // the other, which "does not contain the old word" could never tell.
  it('translates the removal message instead of hardcoding one language', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    const card = makeCard({ name: 'Counterspell' });
    const { showToast, result } = setup();
    await act(async () => result.current.handleAddToDeck(card));
    showToast.mockClear();

    act(() => result.current.handleRemoveFromDeckWithToast(card));

    const message = showToast.mock.calls[0][0];
    expect(message).toBe(`Counterspell: ${i18n.t('cardDetails.cardRemoved')}`);
    expect(message, 'the message did not follow the language').not.toBe(
      `Counterspell: ${i18n.getFixedT('pt')('cardDetails.cardRemoved')}`
    );
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
