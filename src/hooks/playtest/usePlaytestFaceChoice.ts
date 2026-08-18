import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaytestCard } from '../../types/Playtest';
import { PlaytestZone } from '../../types/enums';
import { cardWithFace, isDoubleFaced } from '../../utils/cardFaces';
import { applyZoneTransform, playtestCardName } from '../../utils/playtestBoard';
import { LogAction } from './usePlaytestLog';
import { PlaytestZones } from './usePlaytestZones';

/** Playing a card from hand, including the face prompt a double-faced card has to answer first. */
export function usePlaytestFaceChoice(zones: PlaytestZones, logAction: LogAction) {
  const { t } = useTranslation();
  const { hand, setHand, setBattlefield, moveCard } = zones;
  const [pendingFaceChoice, setPendingFaceChoice] = useState<PlaytestCard | null>(null);

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
      if (moved) logAction(t('playtest.playedCardLog', { name: playtestCardName(moved) }));
    },
    [hand, moveCard, logAction, t]
  );

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
      setHand((previousHand) => previousHand.filter((item) => item.playtestId !== pending.playtestId));
      setBattlefield((previousBattlefield) => [...previousBattlefield, entering]);
      logAction(t('playtest.playedCardLog', { name: playedCard.printed_name || playedCard.name }));
    },
    [pendingFaceChoice, hand, setHand, setBattlefield, logAction, t]
  );

  const handleCancelFaceChoice = useCallback(() => {
    setPendingFaceChoice(null);
  }, []);

  return { pendingFaceChoice, handlePlayCard, handleChooseFace, handleCancelFaceChoice };
}
