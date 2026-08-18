import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaytestCard } from '../../types/Playtest';
import { LogAction } from './usePlaytestLog';
import { PlaytestZones } from './usePlaytestZones';

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

interface PlaytestHistoryArgs {
  zones: PlaytestZones;
  lifeTotal: number;
  restoreLifeTotal: (value: number) => void;
  turn: number;
  setTurn: Dispatch<SetStateAction<number>>;
  logAction: LogAction;
}

export function usePlaytestHistory({
  zones,
  lifeTotal,
  restoreLifeTotal,
  turn,
  setTurn,
  logAction
}: PlaytestHistoryArgs) {
  const { t } = useTranslation();
  const { library, hand, battlefield, graveyard, exile } = zones;
  const { setLibrary, setHand, setBattlefield, setGraveyard, setExile } = zones;

  const historyRef = useRef<GameSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const skipCaptureRef = useRef(false);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });

  const refreshUndoState = useCallback(() => {
    setUndoState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1
    });
  }, []);

  // Meant to run as an effect after each batched board change, so the snapshot
  // reflects the committed state rather than the one the handler just asked for.
  const captureSnapshot = useCallback(() => {
    if (skipCaptureRef.current) {
      skipCaptureRef.current = false;
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

  const restoreSnapshot = useCallback(
    (snapshot: GameSnapshot) => {
      skipCaptureRef.current = true;
      setLibrary(snapshot.library);
      setHand(snapshot.hand);
      setBattlefield(snapshot.battlefield);
      setGraveyard(snapshot.graveyard);
      setExile(snapshot.exile);
      restoreLifeTotal(snapshot.lifeTotal);
      setTurn(snapshot.turn);
    },
    [setLibrary, setHand, setBattlefield, setGraveyard, setExile, restoreLifeTotal, setTurn]
  );

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

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    skipCaptureRef.current = false;
    setUndoState({ canUndo: false, canRedo: false });
  }, []);

  return {
    captureSnapshot,
    handleUndo,
    handleRedo,
    canUndo: undoState.canUndo,
    canRedo: undoState.canRedo,
    resetHistory
  };
}
