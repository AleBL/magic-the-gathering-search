import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlaytestSimulator } from '../usePlaytestSimulator';
import { makeCard } from '../../test/factories';
import { Card } from '../../types/Card';
import { PlaytestZone } from '../../types/enums';

const deckOf = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) => makeCard({ id: `deck-${i}`, name: `Card ${i}` }));

describe('usePlaytestSimulator', () => {
  it('deals an opening hand of seven and puts the rest in the library', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));

    act(() => result.current.startSimulation());

    expect(result.current.hand).toHaveLength(7);
    expect(result.current.library).toHaveLength(3);
    expect(result.current.hand.every((c) => c.isFaceDown === false)).toBe(true);
    expect(result.current.library.every((c) => c.isFaceDown === true)).toBe(true);
  });

  it('does nothing when the deck is empty', () => {
    const { result } = renderHook(() => usePlaytestSimulator([]));

    act(() => result.current.startSimulation());

    expect(result.current.hand).toHaveLength(0);
    expect(result.current.library).toHaveLength(0);
  });

  it('draws the top card of the library into the hand', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    const topCardId = result.current.library[0].playtestId;
    act(() => result.current.handleDrawCard());

    expect(result.current.library).toHaveLength(2);
    expect(result.current.hand).toHaveLength(8);
    expect(result.current.hand.some((c) => c.playtestId === topCardId)).toBe(true);
  });

  it('shuffling reorders the library without losing or duplicating a card', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(15)));
    act(() => result.current.startSimulation());

    const before = result.current.library.map((c) => c.playtestId);
    // Pinned randomness, because "the same cards are still there" is also true of a shuffle
    // that does nothing. Fisher-Yates always picking index 0 rotates the pile by one, so the
    // order assertion below is a fact about the shuffle rather than a coin toss.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    act(() => result.current.handleShuffleLibrary());
    random.mockRestore();
    const after = result.current.library.map((c) => c.playtestId);

    expect([...after].sort()).toEqual([...before].sort());
    expect(after, 'the library came back in the order it went in').not.toEqual(before);
  });

  it('plays a card from the hand onto the battlefield', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));

    expect(result.current.hand.some((c) => c.playtestId === cardId)).toBe(false);
    expect(result.current.battlefield.some((c) => c.playtestId === cardId)).toBe(true);
  });

  it('advances the turn and draws for the turn', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());
    const libraryBefore = result.current.library.length;
    const handBefore = result.current.hand.length;

    act(() => result.current.handleNextTurn());

    expect(result.current.turn).toBe(2);
    expect(result.current.library).toHaveLength(libraryBefore - 1);
    expect(result.current.hand).toHaveLength(handBefore + 1);
  });

  it('starts Commander games at 40 life', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10), 'commander'));

    act(() => result.current.startSimulation());

    expect(result.current.lifeTotal).toBe(40);
  });
});

const faceImages = (url: string) => ({ small: url, normal: url, large: url, png: url });

const makeDfcCard = (id: string): Card =>
  makeCard({
    id,
    name: 'Delver of Secrets // Insectile Aberration',
    type_line: 'Creature — Human Wizard // Creature — Human Insect',
    card_faces: [
      {
        name: 'Delver of Secrets',
        type_line: 'Creature — Human Wizard',
        mana_cost: '{U}',
        power: '1',
        toughness: '1',
        image_uris: faceImages('front.jpg')
      },
      {
        name: 'Insectile Aberration',
        type_line: 'Creature — Human Insect',
        power: '3',
        toughness: '2',
        image_uris: faceImages('back.jpg')
      }
    ]
  });

const dfcDeck = (n: number): Card[] => Array.from({ length: n }, (_, i) => makeDfcCard(`dfc-${i}`));

describe('usePlaytestSimulator — double-faced cards (DFC/MDFC)', () => {
  it('defers playing a double-faced card until a face is chosen', () => {
    const { result } = renderHook(() => usePlaytestSimulator(dfcDeck(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));

    expect(result.current.pendingFaceChoice?.playtestId).toBe(cardId);
    expect(result.current.hand.some((c) => c.playtestId === cardId)).toBe(true);
    expect(result.current.battlefield).toHaveLength(0);
  });

  it('puts the chosen back face onto the battlefield with that face characteristics', () => {
    const { result } = renderHook(() => usePlaytestSimulator(dfcDeck(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    act(() => result.current.handleChooseFace(1));

    expect(result.current.pendingFaceChoice).toBeNull();
    expect(result.current.hand.some((c) => c.playtestId === cardId)).toBe(false);
    const played = result.current.battlefield.find((c) => c.playtestId === cardId);
    expect(played?.card.name).toBe('Insectile Aberration');
    expect(played?.card.type_line).toBe('Creature — Human Insect');
    expect(played?.card.power).toBe('3');
    expect(played?.card.image_uris?.normal).toBe('back.jpg');
  });

  it('puts the chosen front face onto the battlefield with front-face characteristics', () => {
    const { result } = renderHook(() => usePlaytestSimulator(dfcDeck(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    act(() => result.current.handleChooseFace(0));

    const played = result.current.battlefield.find((c) => c.playtestId === cardId);
    expect(played?.card.name).toBe('Delver of Secrets');
    expect(played?.card.mana_cost).toBe('{U}');
  });

  it('restores the full double-faced card when it leaves the battlefield', () => {
    const { result } = renderHook(() => usePlaytestSimulator(dfcDeck(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    act(() => result.current.handleChooseFace(1));
    act(() => result.current.handleSendToGraveyard(cardId));

    const inGraveyard = result.current.graveyard.find((c) => c.playtestId === cardId);
    expect(inGraveyard?.card.name).toBe('Delver of Secrets // Insectile Aberration');
    expect(inGraveyard?.card.card_faces).toHaveLength(2);
  });

  it('keeps the card in hand when the face choice is cancelled', () => {
    const { result } = renderHook(() => usePlaytestSimulator(dfcDeck(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    act(() => result.current.handleCancelFaceChoice());

    expect(result.current.pendingFaceChoice).toBeNull();
    expect(result.current.hand.some((c) => c.playtestId === cardId)).toBe(true);
    expect(result.current.battlefield).toHaveLength(0);
  });

  it('still plays single-faced cards immediately without a face prompt', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));

    expect(result.current.pendingFaceChoice ?? null).toBeNull();
    expect(result.current.battlefield.some((c) => c.playtestId === cardId)).toBe(true);
  });
});

describe('usePlaytestSimulator — undo/redo', () => {
  it('undo puts back the card a play took out of the hand', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    expect(result.current.battlefield).toHaveLength(1);

    act(() => result.current.handleUndo());

    expect(result.current.battlefield).toHaveLength(0);
    expect(result.current.hand.some((item) => item.playtestId === cardId)).toBe(true);
  });

  it('redo replays what undo took back', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    act(() => result.current.handleUndo());
    act(() => result.current.handleRedo());

    expect(result.current.battlefield.map((item) => item.playtestId)).toEqual([cardId]);
    expect(result.current.hand.some((item) => item.playtestId === cardId)).toBe(false);
  });

  it('rewinds the life total without logging the rewind as a life change', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    act(() => result.current.setLifeTotal(17));
    expect(result.current.lifeTotal).toBe(17);
    const logAfterDamage = result.current.gameLog.length;

    act(() => result.current.handleUndo());

    expect(result.current.lifeTotal).toBe(20);
    // The undo line itself is expected; a second "life changed" line would mean the
    // restore flag never reached the life effect.
    expect(result.current.gameLog.length).toBe(logAfterDamage + 1);
    // Matched on the numbers, which every locale renders the same way in this line.
    expect(result.current.gameLog.filter((entry) => entry.text.includes('20 -> 17'))).toHaveLength(1);
  });

  it('drops the redone future once a new move is made after an undo', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    act(() => result.current.handlePlayCard(result.current.hand[0].playtestId));
    act(() => result.current.handleUndo());
    act(() => result.current.handleDrawCard());

    expect(result.current.canRedo).toBe(false);
  });

  it('refuses to redo when nothing was undone', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    const before = result.current.hand.map((item) => item.playtestId);
    act(() => result.current.handleRedo());

    expect(result.current.hand.map((item) => item.playtestId)).toEqual(before);
    expect(result.current.canRedo).toBe(false);
  });
});

describe('usePlaytestSimulator — opening a game', () => {
  // The deck is hoisted on purpose: `startSimulation` depends on the array identity, so a
  // caller that rebuilds the deck every render restarts the game on every render. The app
  // passes the deck held in the store, and that is the shape these tests pin down.
  it('deals the opening hand when the simulator is opened', () => {
    const deck = deckOf(10);
    const { result } = renderHook(() => usePlaytestSimulator(deck, undefined, true));

    expect(result.current.hand).toHaveLength(7);
  });

  it('does not restart the game on a re-render, which would reshuffle mid-game', () => {
    const deck = deckOf(10);
    const { result, rerender } = renderHook(() => usePlaytestSimulator(deck, undefined, true));

    const dealt = result.current.hand.map((item) => item.playtestId);
    act(() => result.current.handleDrawCard());
    rerender();
    rerender();

    expect(result.current.hand.map((item) => item.playtestId).slice(0, 7)).toEqual(dealt);
    expect(result.current.hand).toHaveLength(8);
  });
});

describe('usePlaytestSimulator — the London mulligan', () => {
  const afterOneMulligan = () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());
    act(() => result.current.handleMulligan());
    return result;
  };

  it('deals a fresh seven and counts the mulligan', () => {
    const result = afterOneMulligan();

    expect(result.current.hand).toHaveLength(7);
    expect(result.current.library).toHaveLength(3);
    expect(result.current.mulligans).toBe(1);
    expect(result.current.isMulliganPhase).toBe(true);
  });

  // The rule the whole phase exists for: you always draw seven and put back as many as you
  // have mulliganed. Selecting an eighth card would let a player keep a full hand for free.
  it('refuses to select more cards than mulligans taken', () => {
    const result = afterOneMulligan();
    const [first, second] = result.current.hand;

    act(() => result.current.handleToggleCardSelection(first.playtestId));
    act(() => result.current.handleToggleCardSelection(second.playtestId));

    expect(result.current.selectedToBottom.size).toBe(1);
    expect(result.current.selectedToBottom.has(first.playtestId)).toBe(true);
  });

  it('frees the slot again when the same card is deselected', () => {
    const result = afterOneMulligan();
    const cardId = result.current.hand[0].playtestId;

    act(() => result.current.handleToggleCardSelection(cardId));
    act(() => result.current.handleToggleCardSelection(cardId));

    expect(result.current.selectedToBottom.size).toBe(0);
  });

  it('puts the selected card on the bottom of the library, face down', () => {
    const result = afterOneMulligan();
    const doomed = result.current.hand[0].playtestId;

    act(() => result.current.handleToggleCardSelection(doomed));
    act(() => result.current.handleConfirmMulligan());

    expect(result.current.hand).toHaveLength(6);
    expect(result.current.hand.some((item) => item.playtestId === doomed)).toBe(false);
    expect(result.current.library).toHaveLength(4);
    expect(result.current.library.at(-1)?.playtestId).toBe(doomed);
    expect(result.current.library.at(-1)?.isFaceDown).toBe(true);
    expect(result.current.isMulliganPhase).toBe(false);
  });

  it('refuses to confirm while fewer cards are selected than mulligans taken', () => {
    const result = afterOneMulligan();

    act(() => result.current.handleConfirmMulligan());

    expect(result.current.hand).toHaveLength(7);
    expect(result.current.library).toHaveLength(3);
    expect(result.current.isMulliganPhase).toBe(true);
  });

  it('keeps the seven as dealt when the hand is kept outright', () => {
    const result = afterOneMulligan();

    act(() => result.current.handleKeepHand());

    expect(result.current.isMulliganPhase).toBe(false);
    expect(result.current.hand).toHaveLength(7);
    expect(result.current.selectedToBottom.size).toBe(0);
  });

  it('ignores card selection outside the mulligan phase', () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());

    act(() => result.current.handleToggleCardSelection(result.current.hand[0].playtestId));

    expect(result.current.selectedToBottom.size).toBe(0);
  });
});

describe('usePlaytestSimulator — moving cards between zones', () => {
  const openGame = () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(12)));
    act(() => result.current.startSimulation());
    return result;
  };

  it('discards from the hand onto the top of the graveyard', () => {
    const result = openGame();
    const cardId = result.current.hand[0].playtestId;

    act(() => result.current.handleDiscardFromHand(cardId));

    expect(result.current.hand.some((item) => item.playtestId === cardId)).toBe(false);
    expect(result.current.graveyard[0].playtestId).toBe(cardId);
  });

  it('exiles a card that is in play', () => {
    const result = openGame();
    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));

    act(() => result.current.handleSendToExile(cardId));

    expect(result.current.battlefield).toHaveLength(0);
    expect(result.current.exile[0].playtestId).toBe(cardId);
  });

  // The position is the reason this is not just "put it back": scry and tutor effects put a
  // card at a chosen depth, and it has to be hidden again once it is in the library.
  it('puts a card back into the library at the position asked for, face down', () => {
    const result = openGame();
    const cardId = result.current.hand[0].playtestId;
    const libraryBefore = result.current.library.map((item) => item.playtestId);

    act(() => result.current.handleSendToLibraryPosition(cardId, 2));

    expect(result.current.library[2].playtestId).toBe(cardId);
    expect(result.current.library[2].isFaceDown).toBe(true);
    expect(result.current.library.filter((item) => libraryBefore.includes(item.playtestId))).toHaveLength(
      libraryBefore.length
    );
  });

  it('returns a card from the graveyard to the hand, face up', () => {
    const result = openGame();
    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    act(() => result.current.handleSendToGraveyard(cardId));

    act(() => result.current.handleReturnToHand(cardId, PlaytestZone.GRAVEYARD));

    expect(result.current.graveyard).toHaveLength(0);
    const returned = result.current.hand.find((item) => item.playtestId === cardId);
    expect(returned?.isFaceDown).toBe(false);
  });

  it('mills a card straight from the library into the graveyard', () => {
    const result = openGame();
    const cardId = result.current.library[1].playtestId;

    act(() => result.current.handleLibraryToGraveyard(cardId));

    expect(result.current.library.some((item) => item.playtestId === cardId)).toBe(false);
    expect(result.current.graveyard[0].playtestId).toBe(cardId);
  });

  // Every named handler names the zone it moves from, and a card that is not there must not
  // be teleported out of wherever it actually is.
  it('ignores a move whose card is not in the zone it names', () => {
    const result = openGame();
    const inLibrary = result.current.library[0].playtestId;

    act(() => result.current.handleDiscardFromHand(inLibrary));

    expect(result.current.graveyard).toHaveLength(0);
    expect(result.current.library.some((item) => item.playtestId === inLibrary)).toBe(true);
  });
});

describe('usePlaytestSimulator — cards already in play', () => {
  const withOnePermanent = () => {
    const { result } = renderHook(() => usePlaytestSimulator(deckOf(10)));
    act(() => result.current.startSimulation());
    const cardId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(cardId));
    return { result, cardId };
  };

  const inPlay = (result: ReturnType<typeof withOnePermanent>['result'], cardId: string) =>
    result.current.battlefield.find((item) => item.playtestId === cardId);

  it('taps a permanent and untaps it again', () => {
    const { result, cardId } = withOnePermanent();

    act(() => result.current.handleToggleTapCard(cardId));
    expect(inPlay(result, cardId)?.isTapped).toBe(true);

    act(() => result.current.handleToggleTapCard(cardId));
    expect(inPlay(result, cardId)?.isTapped).toBe(false);
  });

  it('adds counters and never takes one below zero', () => {
    const { result, cardId } = withOnePermanent();

    act(() => result.current.handleAddCounter(cardId));
    act(() => result.current.handleAddCounter(cardId));
    expect(inPlay(result, cardId)?.counters).toBe(2);

    act(() => result.current.handleRemoveCounter(cardId));
    act(() => result.current.handleRemoveCounter(cardId));
    act(() => result.current.handleRemoveCounter(cardId));

    expect(inPlay(result, cardId)?.counters).toBe(0);
  });

  it('untaps everything at once', () => {
    const { result, cardId } = withOnePermanent();
    const secondId = result.current.hand[0].playtestId;
    act(() => result.current.handlePlayCard(secondId));
    act(() => result.current.handleToggleTapCard(cardId));
    act(() => result.current.handleToggleTapCard(secondId));

    act(() => result.current.handleUntapAll());

    expect(result.current.battlefield.every((item) => item.isTapped === false)).toBe(true);
  });

  it('turns a permanent face down and back up', () => {
    const { result, cardId } = withOnePermanent();

    act(() => result.current.handleToggleFaceDown(cardId));
    expect(inPlay(result, cardId)?.isFaceDown).toBe(true);

    act(() => result.current.handleToggleFaceDown(cardId));
    expect(inPlay(result, cardId)?.isFaceDown).toBe(false);
  });

  // Two copies of the same token are two permanents: sharing a playtestId would make every
  // later action hit whichever one the lookup found first.
  it('summons tokens that do not collide with each other', () => {
    const { result } = withOnePermanent();
    const token = makeCard({ id: 'token-goblin', name: 'Goblin' });

    act(() => result.current.handleSummonToken(token));
    act(() => result.current.handleSummonToken(token));

    const summoned = result.current.battlefield.filter((item) => item.card.id === 'token-goblin');
    expect(summoned).toHaveLength(2);
    expect(summoned[0].playtestId).not.toBe(summoned[1].playtestId);
  });
});
