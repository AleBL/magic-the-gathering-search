import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { Card } from '../types/Card';
import { PlaytestCard, LogEntry } from '../types/Playtest';
import { useTranslation } from 'react-i18next';
import { PlaytestZone, LibraryPlacement } from '../types/enums';
import { cardWithFace, isDoubleFaced } from '../utils/cardFaces';
import { newId } from '../utils/id';

const getCardName = (item: PlaytestCard): string => item.card.printed_name || item.card.name;

/** A restorable snapshot of the board for undo/redo. */
interface GameSnapshot {
  library: PlaytestCard[];
  hand: PlaytestCard[];
  battlefield: PlaytestCard[];
  graveyard: PlaytestCard[];
  exile: PlaytestCard[];
  lifeTotal: number;
  turn: number;
}

const MAX_HISTORY = 60;

/** Normalizes a card's tap/face state as it enters a zone (library cards are hidden). */
function applyZoneTransform(card: PlaytestCard, to: PlaytestZone): PlaytestCard {
  // Outside the battlefield a double-faced card is always its full physical
  // card again — drop the single-face representation chosen when it was played.
  const normalized =
    to !== PlaytestZone.BATTLEFIELD && card.baseCard ? { ...card, card: card.baseCard, baseCard: undefined } : card;
  if (to === PlaytestZone.LIBRARY) {
    return { ...normalized, isTapped: false, isFaceDown: true };
  }
  return { ...normalized, isTapped: false, isFaceDown: false };
}

export function usePlaytestSimulator(deckCards: Card[], deckFormat?: string, isOpen?: boolean) {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<PlaytestCard[]>([]);
  const [hand, setHand] = useState<PlaytestCard[]>([]);
  const [battlefield, setBattlefield] = useState<PlaytestCard[]>([]);
  const [graveyard, setGraveyard] = useState<PlaytestCard[]>([]);
  const [exile, setExile] = useState<PlaytestCard[]>([]);
  const [lifeTotal, setLifeTotal] = useState(20);
  const [mulligans, setMulligans] = useState(0);
  const [isMulliganPhase, setIsMulliganPhase] = useState(false);
  const [selectedToBottom, setSelectedToBottom] = useState<Set<string>>(new Set());

  // Double-faced card from the hand awaiting a face choice before entering play.
  const [pendingFaceChoice, setPendingFaceChoice] = useState<PlaytestCard | null>(null);

  const [turn, setTurn] = useState(1);
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);
  const [prevLifeTotal, setPrevLifeTotal] = useState<number | null>(null);

  // Undo/redo history of board snapshots, captured after each batched state change.
  const historyRef = useRef<GameSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const skipSnapshotRef = useRef(false);
  const skipLifeEffectRef = useRef(false);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });

  const refreshUndoState = useCallback(() => {
    setUndoState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1
    });
  }, []);

  const shuffleDeck = (cards: PlaytestCard[]): PlaytestCard[] => {
    const shuffledCards = [...cards];
    for (let currentIndex = shuffledCards.length - 1; currentIndex > 0; currentIndex--) {
      const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
      const temporaryCardHolder = shuffledCards[currentIndex];
      shuffledCards[currentIndex] = shuffledCards[randomIndex];
      shuffledCards[randomIndex] = temporaryCardHolder;
    }
    return shuffledCards;
  };

  const mapToPlaytestCards = (cards: Card[]): PlaytestCard[] => {
    return cards.map((card) => ({
      playtestId: `${card.id}-${newId()}`,
      card,
      isTapped: false,
      counters: 0,
      isFaceDown: true // Hidden in library by default
    }));
  };

  const logAction = useCallback((text: string) => {
    setGameLog((prev) => [
      ...prev,
      {
        id: newId(),
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);
  }, []);

  const startSimulation = useCallback(() => {
    if (deckCards.length === 0) return;
    const mappedCards = mapToPlaytestCards(deckCards);
    const shuffled = shuffleDeck(mappedCards);
    const initialHand = shuffled.slice(0, 7).map((c) => ({ ...c, isFaceDown: false }));
    const initialLibrary = shuffled.slice(7);

    setHand(initialHand);
    setLibrary(initialLibrary);
    setBattlefield([]);
    setGraveyard([]);
    setExile([]);
    const initialLife = deckFormat === 'commander' ? 40 : 20;
    setLifeTotal(initialLife);
    setPrevLifeTotal(initialLife);
    setMulligans(0);
    setIsMulliganPhase(false);
    setSelectedToBottom(new Set());
    setPendingFaceChoice(null);

    setTurn(1);
    setGameLog([
      {
        id: 'start',
        text: t('playtest.gameStartedLog'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);

    // Reset undo history for the fresh game.
    historyRef.current = [];
    historyIndexRef.current = -1;
    skipSnapshotRef.current = false;
    skipLifeEffectRef.current = false;
    setUndoState({ canUndo: false, canRedo: false });
  }, [deckCards, deckFormat, t]);

  useEffect(() => {
    if (isOpen) {
      startSimulation();
    }
  }, [isOpen, startSimulation]);

  useEffect(() => {
    if (skipLifeEffectRef.current) {
      skipLifeEffectRef.current = false;
      setPrevLifeTotal(lifeTotal);
      return;
    }
    if (prevLifeTotal !== null && prevLifeTotal !== lifeTotal) {
      logAction(t('playtest.lifeChangedLog', { from: prevLifeTotal, to: lifeTotal }));
    }
    setPrevLifeTotal(lifeTotal);
  }, [lifeTotal, prevLifeTotal, logAction, t]);

  // Capture a board snapshot after each batched change (skipped while restoring).
  useEffect(() => {
    if (skipSnapshotRef.current) {
      skipSnapshotRef.current = false;
      return;
    }
    const snapshot: GameSnapshot = { library, hand, battlefield, graveyard, exile, lifeTotal, turn };
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);
    if (nextHistory.length > MAX_HISTORY) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    refreshUndoState();
  }, [library, hand, battlefield, graveyard, exile, lifeTotal, turn, refreshUndoState]);

  const handleMulligan = () => {
    const nextMulligans = mulligans + 1;
    const mappedCards = mapToPlaytestCards(deckCards);
    const shuffled = shuffleDeck(mappedCards);

    const initialHand = shuffled.slice(0, 7).map((c) => ({ ...c, isFaceDown: false }));
    const initialLibrary = shuffled.slice(7);

    setHand(initialHand);
    setLibrary(initialLibrary);
    setBattlefield([]);
    setGraveyard([]);
    setExile([]);
    setMulligans(nextMulligans);
    setIsMulliganPhase(true);
    setSelectedToBottom(new Set());

    logAction(t('playtest.mulliganLog', { cards: 7 }));
  };

  const handleToggleCardSelection = (playtestId: string) => {
    if (!isMulliganPhase) return;

    setSelectedToBottom((prevSelectedToBottom) => {
      const nextSelectedToBottom = new Set(prevSelectedToBottom);
      if (nextSelectedToBottom.has(playtestId)) {
        nextSelectedToBottom.delete(playtestId);
      } else {
        if (nextSelectedToBottom.size < mulligans) {
          nextSelectedToBottom.add(playtestId);
        }
      }
      return nextSelectedToBottom;
    });
  };

  const handleConfirmMulligan = () => {
    if (selectedToBottom.size !== mulligans) return;

    const cardsToKeep: PlaytestCard[] = [];
    const cardsToBottom: PlaytestCard[] = [];

    hand.forEach((item) => {
      if (selectedToBottom.has(item.playtestId)) {
        cardsToBottom.push(item);
      } else {
        cardsToKeep.push(item);
      }
    });

    setHand(cardsToKeep);
    setLibrary((previousLibrary) => [...previousLibrary, ...cardsToBottom.map((c) => ({ ...c, isFaceDown: true }))]);
    setIsMulliganPhase(false);
    setSelectedToBottom(new Set());

    logAction(t('playtest.keptHandLog') + ` (London Mulligan para ${7 - mulligans} cartas)`);
  };

  const handleKeepHand = () => {
    setIsMulliganPhase(false);
    setSelectedToBottom(new Set());
    logAction(t('playtest.keptHandLog') + ` (${7 - mulligans} cartas)`);
  };

  const handleDrawCard = useCallback(() => {
    setLibrary((previousLibrary) => {
      if (previousLibrary.length === 0) return previousLibrary;
      const nextCard = previousLibrary[0];
      setHand((previousHand) => [...previousHand, { ...nextCard, isFaceDown: false }]);
      const cardName = nextCard.card.printed_name || nextCard.card.name;
      logAction(t('playtest.drewCardLog', { name: cardName }));
      return previousLibrary.slice(1);
    });
  }, [logAction, t]);

  const handleShuffleLibrary = useCallback(() => {
    setLibrary((prevLibrary) => {
      if (prevLibrary.length === 0) return prevLibrary;
      const shuffled = shuffleDeck(prevLibrary);
      logAction(t('playtest.shuffleLibraryLog'));
      return shuffled;
    });
  }, [logAction, t]);

  // Single source of truth for moving one card between zones. The named handlers
  // below are thin wrappers that add their specific log message.
  const moveCard = useCallback(
    (
      playtestId: string,
      from: PlaytestZone,
      to: PlaytestZone,
      placement: LibraryPlacement = 'top'
    ): PlaytestCard | undefined => {
      const zones: Record<PlaytestZone, PlaytestCard[]> = {
        [PlaytestZone.LIBRARY]: library,
        [PlaytestZone.HAND]: hand,
        [PlaytestZone.BATTLEFIELD]: battlefield,
        [PlaytestZone.GRAVEYARD]: graveyard,
        [PlaytestZone.EXILE]: exile
      };
      const setters: Record<PlaytestZone, Dispatch<SetStateAction<PlaytestCard[]>>> = {
        [PlaytestZone.LIBRARY]: setLibrary,
        [PlaytestZone.HAND]: setHand,
        [PlaytestZone.BATTLEFIELD]: setBattlefield,
        [PlaytestZone.GRAVEYARD]: setGraveyard,
        [PlaytestZone.EXILE]: setExile
      };

      const found = zones[from].find((item) => item.playtestId === playtestId);
      if (!found) return undefined;

      const entering = applyZoneTransform(found, to);

      if (from !== to) {
        setters[from]((prev) => prev.filter((item) => item.playtestId !== playtestId));
      }

      setters[to]((prev) => {
        const base = prev.filter((item) => item.playtestId !== playtestId);
        if (to === PlaytestZone.LIBRARY) {
          if (placement === 'top') return [entering, ...base];
          if (placement === 'bottom') return [...base, entering];
          const index = Math.max(0, Math.min(placement, base.length));
          const next = [...base];
          next.splice(index, 0, entering);
          return next;
        }
        // Graveyard and exile stack newest-on-top; hand and battlefield append.
        if (to === PlaytestZone.GRAVEYARD || to === PlaytestZone.EXILE) {
          return [entering, ...base];
        }
        return [...base, entering];
      });

      return found;
    },
    [library, hand, battlefield, graveyard, exile]
  );

  const handlePlayCard = useCallback(
    (playtestId: string) => {
      // Genuinely double-faced cards (transform/MDFC) must declare which face
      // is being played — hold the card in hand and ask first.
      const inHand = hand.find((item) => item.playtestId === playtestId);
      if (inHand && isDoubleFaced(inHand.card)) {
        setPendingFaceChoice(inHand);
        return;
      }
      const moved = moveCard(playtestId, PlaytestZone.HAND, PlaytestZone.BATTLEFIELD);
      if (moved) logAction(t('playtest.playedCardLog', { name: getCardName(moved) }));
    },
    [hand, moveCard, logAction, t]
  );

  /** Resolves a pending face choice: the selected face enters the battlefield. */
  const handleChooseFace = useCallback(
    (faceIndex: number) => {
      if (!pendingFaceChoice) return;
      const pending = pendingFaceChoice;
      setPendingFaceChoice(null);

      // The card may have left the hand meanwhile (e.g. undo); bail out safely.
      const stillInHand = hand.some((item) => item.playtestId === pending.playtestId);
      if (!stillInHand) return;

      const playedCard = cardWithFace(pending.card, faceIndex);
      // Route battlefield entry through the same normalization every other
      // zone move uses, so DFCs can't drift from regular cards.
      const entering = applyZoneTransform(
        { ...pending, card: playedCard, baseCard: pending.card },
        PlaytestZone.BATTLEFIELD
      );
      setHand((prev) => prev.filter((item) => item.playtestId !== pending.playtestId));
      setBattlefield((prev) => [...prev, entering]);
      logAction(t('playtest.playedCardLog', { name: playedCard.printed_name || playedCard.name }));
    },
    [pendingFaceChoice, hand, logAction, t]
  );

  /** Dismisses the face-choice prompt, leaving the card in hand. */
  const handleCancelFaceChoice = useCallback(() => {
    setPendingFaceChoice(null);
  }, []);

  const handleToggleTapCard = useCallback(
    (playtestId: string) => {
      setBattlefield((previousBattlefield) => {
        const targetCard = previousBattlefield.find((item) => item.playtestId === playtestId);
        if (!targetCard) return previousBattlefield;
        const isTapped = !targetCard.isTapped;
        const cardName = targetCard.card.printed_name || targetCard.card.name;
        logAction(
          isTapped ? t('playtest.tappedCardLog', { name: cardName }) : t('playtest.untappedCardLog', { name: cardName })
        );
        return previousBattlefield.map((item) => (item.playtestId === playtestId ? { ...item, isTapped } : item));
      });
    },
    [logAction, t]
  );

  const handleAddCounter = useCallback(
    (playtestId: string) => {
      setBattlefield((prev) =>
        prev.map((item) => {
          if (item.playtestId === playtestId) {
            const cardName = item.card.printed_name || item.card.name;
            logAction(t('playtest.addedCounterLog', { name: cardName }));
            return { ...item, counters: (item.counters || 0) + 1 };
          }
          return item;
        })
      );
    },
    [logAction, t]
  );

  const handleRemoveCounter = useCallback(
    (playtestId: string) => {
      setBattlefield((prev) =>
        prev.map((item) => {
          if (item.playtestId === playtestId) {
            if ((item.counters || 0) > 0) {
              const cardName = item.card.printed_name || item.card.name;
              logAction(t('playtest.removedCounterLog', { name: cardName }));
            }
            return { ...item, counters: Math.max(0, (item.counters || 0) - 1) };
          }
          return item;
        })
      );
    },
    [logAction, t]
  );

  const handleToggleFaceDown = useCallback(
    (playtestId: string) => {
      setBattlefield((prev) =>
        prev.map((item) => {
          if (item.playtestId === playtestId) {
            const cardName = item.card.printed_name || item.card.name;
            const isFaceDown = !item.isFaceDown;
            logAction(
              isFaceDown
                ? t('playtest.turnedFaceDownLog', { name: cardName })
                : t('playtest.turnedFaceUpLog', { name: cardName })
            );
            return { ...item, isFaceDown };
          }
          return item;
        })
      );
    },
    [logAction, t]
  );

  const handleSendToGraveyard = useCallback(
    (playtestId: string) => {
      const moved = moveCard(playtestId, PlaytestZone.BATTLEFIELD, PlaytestZone.GRAVEYARD);
      if (moved) logAction(t('playtest.graveyardCardLog', { name: getCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  const handleSendToExile = useCallback(
    (playtestId: string, source: PlaytestZone = PlaytestZone.BATTLEFIELD) => {
      const moved = moveCard(playtestId, source, PlaytestZone.EXILE);
      if (moved) logAction(t('playtest.sentToExileLog', { name: getCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  const handleLibraryToGraveyard = useCallback(
    (playtestId: string) => {
      const moved = moveCard(playtestId, PlaytestZone.LIBRARY, PlaytestZone.GRAVEYARD);
      if (moved) {
        logAction(
          t('playtest.movedFromPileLog', {
            name: getCardName(moved),
            source: t('playtest.library'),
            dest: t('playtest.graveyard')
          })
        );
      }
    },
    [moveCard, logAction, t]
  );

  const handleDiscardFromHand = useCallback(
    (playtestId: string) => {
      const moved = moveCard(playtestId, PlaytestZone.HAND, PlaytestZone.GRAVEYARD);
      if (moved) logAction(t('playtest.discardedCardLog', { name: getCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  const handleSendToLibraryPosition = useCallback(
    (playtestId: string, position: number, source: PlaytestZone = PlaytestZone.HAND) => {
      const clampedPosition = Math.max(0, Math.min(position, library.length));
      const moved = moveCard(playtestId, source, PlaytestZone.LIBRARY, position);
      if (moved) {
        logAction(t('playtest.libraryPositionLog', { name: getCardName(moved), pos: clampedPosition + 1 }));
      }
    },
    [moveCard, library.length, logAction, t]
  );

  const handleReturnToHand = useCallback(
    (playtestId: string, fromZone: PlaytestZone) => {
      const moved = moveCard(playtestId, fromZone, PlaytestZone.HAND);
      if (moved) logAction(t('playtest.returnedHandLog', { name: getCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  const handleUntapAll = useCallback(() => {
    setBattlefield((previousBattlefield) => {
      if (previousBattlefield.length === 0) return previousBattlefield;
      logAction(t('playtest.untappedAllLog'));
      return previousBattlefield.map((item) => ({ ...item, isTapped: false }));
    });
  }, [logAction, t]);

  const handleSummonToken = useCallback(
    (tokenCard: Card) => {
      const uniquePlaytestId = `${tokenCard.id}-${newId()}`;
      setBattlefield((previousBattlefield) => [
        ...previousBattlefield,
        {
          playtestId: uniquePlaytestId,
          card: tokenCard,
          isTapped: false
        }
      ]);
      const tokenName = tokenCard.printed_name || tokenCard.name;
      logAction(t('playtest.createdTokenLog', { name: tokenName }));
    },
    [logAction, t]
  );

  const restoreSnapshot = useCallback((snapshot: GameSnapshot) => {
    skipSnapshotRef.current = true;
    skipLifeEffectRef.current = true;
    setLibrary(snapshot.library);
    setHand(snapshot.hand);
    setBattlefield(snapshot.battlefield);
    setGraveyard(snapshot.graveyard);
    setExile(snapshot.exile);
    setLifeTotal(snapshot.lifeTotal);
    setTurn(snapshot.turn);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    refreshUndoState();
    logAction(t('playtest.undoLog'));
  }, [restoreSnapshot, refreshUndoState, logAction, t]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    refreshUndoState();
    logAction(t('playtest.redoLog'));
  }, [restoreSnapshot, refreshUndoState, logAction, t]);

  const handleNextTurn = useCallback(() => {
    setTurn((prevTurn) => {
      const nextTurn = prevTurn + 1;

      setBattlefield((prevBattlefield) => prevBattlefield.map((item) => ({ ...item, isTapped: false })));

      setLibrary((prevLibrary) => {
        let drawnCardName = '';
        if (prevLibrary.length > 0) {
          const nextCard = prevLibrary[0];
          drawnCardName = nextCard.card.printed_name || nextCard.card.name;
          setHand((prevHand) => [...prevHand, { ...nextCard, isFaceDown: false }]);
        }

        logAction(t('playtest.turnStartedLog', { turn: nextTurn }));
        logAction(t('playtest.untappedAllLog'));
        if (drawnCardName) {
          logAction(t('playtest.drewCardLog', { name: drawnCardName }));
        }

        return prevLibrary.slice(1);
      });

      return nextTurn;
    });
  }, [logAction, t]);

  return {
    library,
    hand,
    battlefield,
    graveyard,
    exile,
    lifeTotal,
    setLifeTotal,
    mulligans,
    isMulliganPhase,
    selectedToBottom,
    turn,
    gameLog,
    setGameLog,
    handleUndo,
    handleRedo,
    canUndo: undoState.canUndo,
    canRedo: undoState.canRedo,
    startSimulation,
    handleMulligan,
    handleToggleCardSelection,
    handleConfirmMulligan,
    handleKeepHand,
    handleDrawCard,
    handleShuffleLibrary,
    handlePlayCard,
    pendingFaceChoice,
    handleChooseFace,
    handleCancelFaceChoice,
    handleToggleTapCard,
    handleAddCounter,
    handleRemoveCounter,
    handleToggleFaceDown,
    handleSendToGraveyard,
    handleSendToExile,
    handleLibraryToGraveyard,
    handleDiscardFromHand,
    handleSendToLibraryPosition,
    handleReturnToHand,
    handleUntapAll,
    handleSummonToken,
    handleNextTurn,
    moveCard,
    setLibrary,
    setGraveyard,
    logAction
  };
}
