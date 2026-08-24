import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../types/Card';
import { dealOpeningHand, startingLifeTotal } from '../utils/playtestBoard';
import { usePlaytestBattlefield } from './playtest/usePlaytestBattlefield';
import { usePlaytestCardMoves } from './playtest/usePlaytestCardMoves';
import { usePlaytestFaceChoice } from './playtest/usePlaytestFaceChoice';
import { usePlaytestHistory } from './playtest/usePlaytestHistory';
import { usePlaytestLibrary } from './playtest/usePlaytestLibrary';
import { usePlaytestLife } from './playtest/usePlaytestLife';
import { usePlaytestLog } from './playtest/usePlaytestLog';
import { usePlaytestMulligan } from './playtest/usePlaytestMulligan';
import { usePlaytestTurn } from './playtest/usePlaytestTurn';
import { usePlaytestZones } from './playtest/usePlaytestZones';

export function usePlaytestSimulator(deckCards: Card[], deckFormat?: string, isOpen?: boolean) {
  const { t } = useTranslation();
  const log = usePlaytestLog();
  const { logAction } = log;
  const zones = usePlaytestZones();
  const life = usePlaytestLife(logAction);
  const turnState = usePlaytestTurn(zones, logAction);
  const history = usePlaytestHistory({
    zones,
    lifeTotal: life.lifeTotal,
    restoreLifeTotal: life.restoreLifeTotal,
    turn: turnState.turn,
    setTurn: turnState.setTurn,
    logAction
  });
  const mulligan = usePlaytestMulligan(deckCards, zones, logAction);
  const battlefieldActions = usePlaytestBattlefield(zones, logAction);
  const cardMoves = usePlaytestCardMoves(zones, logAction);
  const faceChoice = usePlaytestFaceChoice(zones, logAction);
  const libraryActions = usePlaytestLibrary(zones, logAction);

  const { resetZones } = zones;
  const { resetLife, logLifeChange } = life;
  const { resetLog } = log;
  const { resetHistory, captureSnapshot } = history;
  const { resetMulligan } = mulligan;
  const { handleCancelFaceChoice } = faceChoice;
  const { setTurn } = turnState;

  const startSimulation = useCallback(() => {
    if (deckCards.length === 0) return;
    resetZones(dealOpeningHand(deckCards));
    resetLife(startingLifeTotal(deckFormat));
    resetMulligan();
    handleCancelFaceChoice();
    setTurn(1);
    resetLog(t('playtest.gameStartedLog'));
    resetHistory();
  }, [
    deckCards,
    deckFormat,
    t,
    resetZones,
    resetLife,
    resetMulligan,
    handleCancelFaceChoice,
    setTurn,
    resetLog,
    resetHistory
  ]);

  // The three effects below run in this order on every commit and depend on it: a fresh game
  // resets the history refs before the capture below reads them, and the life log has to see
  // the restore flag that undo sets. Moving one past another changes what undo returns to.
  useEffect(() => {
    if (isOpen) {
      startSimulation();
    }
  }, [isOpen, startSimulation]);

  useEffect(() => {
    logLifeChange();
  }, [logLifeChange]);

  useEffect(() => {
    captureSnapshot();
  }, [captureSnapshot]);

  return {
    library: zones.library,
    hand: zones.hand,
    battlefield: zones.battlefield,
    graveyard: zones.graveyard,
    exile: zones.exile,
    lifeTotal: life.lifeTotal,
    setLifeTotal: life.setLifeTotal,
    mulligans: mulligan.mulligans,
    isMulliganPhase: mulligan.isMulliganPhase,
    selectedToBottom: mulligan.selectedToBottom,
    turn: turnState.turn,
    gameLog: log.gameLog,
    setGameLog: log.setGameLog,
    handleUndo: history.handleUndo,
    handleRedo: history.handleRedo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    startSimulation,
    handleMulligan: mulligan.handleMulligan,
    handleToggleCardSelection: mulligan.handleToggleCardSelection,
    handleConfirmMulligan: mulligan.handleConfirmMulligan,
    handleKeepHand: mulligan.handleKeepHand,
    handleDrawCard: libraryActions.handleDrawCard,
    handleShuffleLibrary: libraryActions.handleShuffleLibrary,
    handlePlayCard: faceChoice.handlePlayCard,
    pendingFaceChoice: faceChoice.pendingFaceChoice,
    handleChooseFace: faceChoice.handleChooseFace,
    handleCancelFaceChoice,
    handleToggleTapCard: battlefieldActions.handleToggleTapCard,
    handleAddCounter: battlefieldActions.handleAddCounter,
    handleRemoveCounter: battlefieldActions.handleRemoveCounter,
    handleToggleFaceDown: battlefieldActions.handleToggleFaceDown,
    handleSendToGraveyard: cardMoves.handleSendToGraveyard,
    handleSendToExile: cardMoves.handleSendToExile,
    handleLibraryToGraveyard: cardMoves.handleLibraryToGraveyard,
    handleDiscardFromHand: cardMoves.handleDiscardFromHand,
    handleSendToLibraryPosition: cardMoves.handleSendToLibraryPosition,
    handleReturnToHand: cardMoves.handleReturnToHand,
    handleUntapAll: battlefieldActions.handleUntapAll,
    handleSummonToken: battlefieldActions.handleSummonToken,
    handleNextTurn: turnState.handleNextTurn,
    moveCard: zones.moveCard,
    setLibrary: zones.setLibrary,
    setGraveyard: zones.setGraveyard,
    logAction
  };
}
