import { beforeEach, describe, expect, it } from 'vitest';
import { useDeckStore } from '../useDeckStore';
import { DeckFormatType, DeckZone } from '../../types/enums';
import { makeCard } from '../../test/factories';
import { DeckRelatedToken } from '../../types/Deck';

const reset = () =>
  useDeckStore.setState({
    currentDeck: [],
    currentDeckRelatedTokens: [],
    editingDeck: { deckId: null, deckName: '', deckFormat: DeckFormatType.FREEFORM, deckNotes: '' },
    pendingAction: null
  });

describe('useDeckStore', () => {
  beforeEach(reset);

  it('adds a card to the current deck', () => {
    const card = makeCard({ name: 'Llanowar Elves' });
    useDeckStore.getState().addCard(card);
    expect(useDeckStore.getState().currentDeck).toEqual([{ ...card, instanceId: expect.any(String) }]);
  });

  // Copies of one printing share `id`, so without a per-entry id there is no way to say
  // "the second of these four".
  it('gives every copy its own entry id, even copies of the same printing', () => {
    const card = makeCard({ id: 'island-unf', name: 'Island' });
    const { addCard } = useDeckStore.getState();
    addCard(card);
    addCard(card);
    addCard(card);

    const ids = useDeckStore.getState().currentDeck.map((entry) => entry.instanceId);
    expect(new Set(ids).size).toBe(3);
  });

  it('updates one copy without touching the others', () => {
    const { addCard } = useDeckStore.getState();
    addCard(makeCard({ id: 'island-unf', name: 'Island', set: 'unf' }));
    addCard(makeCard({ id: 'island-unf', name: 'Island', set: 'unf' }));

    const [first] = useDeckStore.getState().currentDeck;
    useDeckStore.getState().updateCard({ ...first, id: 'island-znr', set: 'znr' });

    const sets = useDeckStore.getState().currentDeck.map((entry) => entry.set);
    expect(sets).toEqual(['znr', 'unf']);
  });

  it('back fills entry ids for decks saved before they existed', () => {
    const legacy = [makeCard({ id: 'island-unf', name: 'Island' }), makeCard({ id: 'island-unf', name: 'Island' })];
    useDeckStore.getState().setCurrentDeck(legacy);

    const ids = useDeckStore.getState().currentDeck.map((entry) => entry.instanceId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it('removes a card by id and returns the removed card', () => {
    const a = makeCard({ id: 'a', name: 'A' });
    const b = makeCard({ id: 'b', name: 'B' });
    useDeckStore.setState({ currentDeck: [a, b] });

    const removed = useDeckStore.getState().removeCard('a');

    expect(removed).toBe(a);
    expect(useDeckStore.getState().currentDeck).toEqual([b]);
  });

  it('returns null when removing an id not in the deck', () => {
    useDeckStore.setState({ currentDeck: [makeCard({ id: 'a' })] });
    expect(useDeckStore.getState().removeCard('missing')).toBeNull();
  });

  it('keeps related tokens while another copy of the generator remains', () => {
    const first = makeCard({ id: '1', name: 'Krenko' });
    const second = makeCard({ id: '2', name: 'Krenko' });
    const token: DeckRelatedToken = { tokenCard: makeCard({ name: 'Goblin Token' }), generatorCardName: 'Krenko' };
    useDeckStore.setState({ currentDeck: [first, second], currentDeckRelatedTokens: [token] });

    useDeckStore.getState().removeCard('1');

    expect(useDeckStore.getState().currentDeckRelatedTokens).toEqual([token]);
  });

  it('prunes related tokens when the last copy of the generator is removed', () => {
    const only = makeCard({ id: '1', name: 'Krenko' });
    const token: DeckRelatedToken = { tokenCard: makeCard({ name: 'Goblin Token' }), generatorCardName: 'Krenko' };
    useDeckStore.setState({ currentDeck: [only], currentDeckRelatedTokens: [token] });

    useDeckStore.getState().removeCard('1');

    expect(useDeckStore.getState().currentDeckRelatedTokens).toEqual([]);
  });

  it('moves a card to another zone', () => {
    const card = makeCard({ id: 'z', zone: DeckZone.MAIN });
    useDeckStore.setState({ currentDeck: [card] });

    useDeckStore.getState().updateCardZone('z', DeckZone.SIDEBOARD);

    expect(useDeckStore.getState().currentDeck[0].zone).toBe(DeckZone.SIDEBOARD);
  });

  it('toggles a commander flag on and back off', () => {
    const card = makeCard({ id: 'c' });
    useDeckStore.setState({ currentDeck: [card] });

    useDeckStore.getState().toggleCommander('c');
    expect(useDeckStore.getState().currentDeck[0].isCommander).toBe(true);

    useDeckStore.getState().toggleCommander('c');
    expect(useDeckStore.getState().currentDeck[0].isCommander).toBe(false);
  });

  it('never keeps more than two commanders at once', () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' }), makeCard({ id: '3' })];
    useDeckStore.setState({ currentDeck: cards });
    const { toggleCommander } = useDeckStore.getState();

    toggleCommander('1');
    toggleCommander('2');
    toggleCommander('3');

    const commanders = useDeckStore.getState().currentDeck.filter((c) => c.isCommander);
    expect(commanders).toHaveLength(2);
  });

  it('clears the deck and its related tokens', () => {
    useDeckStore.setState({
      currentDeck: [makeCard()],
      currentDeckRelatedTokens: [{ tokenCard: makeCard(), generatorCardName: 'X' }]
    });

    useDeckStore.getState().clearDeck();

    expect(useDeckStore.getState().currentDeck).toEqual([]);
    expect(useDeckStore.getState().currentDeckRelatedTokens).toEqual([]);
  });

  it('updates editing-deck metadata independently', () => {
    const store = useDeckStore.getState();
    store.updateDeckName('Mono Red Aggro');
    store.updateDeckFormat(DeckFormatType.STANDARD);
    store.updateNotes('sideboard vs control');

    expect(useDeckStore.getState().editingDeck).toMatchObject({
      deckName: 'Mono Red Aggro',
      deckFormat: DeckFormatType.STANDARD,
      deckNotes: 'sideboard vs control'
    });
  });
});
