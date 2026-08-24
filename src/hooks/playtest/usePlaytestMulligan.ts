import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../types/Card';
import { PlaytestCard } from '../../types/Playtest';
import { dealOpeningHand, OPENING_HAND_SIZE } from '../../utils/playtestBoard';
import { LogAction } from './usePlaytestLog';
import { PlaytestZones } from './usePlaytestZones';

export function usePlaytestMulligan(deckCards: Card[], zones: PlaytestZones, logAction: LogAction) {
  const { t } = useTranslation();
  const { hand, setHand, setLibrary, resetZones } = zones;
  const [mulligans, setMulligans] = useState(0);
  const [isMulliganPhase, setIsMulliganPhase] = useState(false);
  const [selectedToBottom, setSelectedToBottom] = useState<Set<string>>(new Set());

  const resetMulligan = useCallback(() => {
    setMulligans(0);
    setIsMulliganPhase(false);
    setSelectedToBottom(new Set());
  }, []);

  const handleMulligan = () => {
    resetZones(dealOpeningHand(deckCards));
    setMulligans(mulligans + 1);
    setIsMulliganPhase(true);
    setSelectedToBottom(new Set());
    logAction(t('playtest.mulliganLog', { cards: OPENING_HAND_SIZE }));
  };

  const handleToggleCardSelection = (playtestId: string) => {
    if (!isMulliganPhase) return;

    setSelectedToBottom((previousSelection) => {
      const nextSelection = new Set(previousSelection);
      if (nextSelection.has(playtestId)) {
        nextSelection.delete(playtestId);
      } else if (nextSelection.size < mulligans) {
        nextSelection.add(playtestId);
      }
      return nextSelection;
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
    setLibrary((previousLibrary) => [
      ...previousLibrary,
      ...cardsToBottom.map((item) => ({ ...item, isFaceDown: true }))
    ]);
    setIsMulliganPhase(false);
    setSelectedToBottom(new Set());

    logAction(t('playtest.keptHandLog') + ` (London Mulligan para ${OPENING_HAND_SIZE - mulligans} cartas)`);
  };

  const handleKeepHand = () => {
    setIsMulliganPhase(false);
    setSelectedToBottom(new Set());
    logAction(t('playtest.keptHandLog') + ` (${OPENING_HAND_SIZE - mulligans} cartas)`);
  };

  return {
    mulligans,
    isMulliganPhase,
    selectedToBottom,
    handleMulligan,
    handleToggleCardSelection,
    handleConfirmMulligan,
    handleKeepHand,
    resetMulligan
  };
}
