import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaytestZone } from '../../types/enums';
import { playtestCardName } from '../../utils/playtestBoard';
import { LogAction } from './usePlaytestLog';
import { PlaytestZones } from './usePlaytestZones';

/** Zone-to-zone transfers: each handler is `moveCard` plus the log line that names it. */
export function usePlaytestCardMoves(zones: PlaytestZones, logAction: LogAction) {
  const { t } = useTranslation();
  const { moveCard, library } = zones;
  const libraryLength = library.length;

  const handleSendToGraveyard = useCallback(
    (playtestId: string) => {
      const moved = moveCard(playtestId, PlaytestZone.BATTLEFIELD, PlaytestZone.GRAVEYARD);
      if (moved) logAction(t('playtest.graveyardCardLog', { name: playtestCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  const handleSendToExile = useCallback(
    (playtestId: string, source: PlaytestZone = PlaytestZone.BATTLEFIELD) => {
      const moved = moveCard(playtestId, source, PlaytestZone.EXILE);
      if (moved) logAction(t('playtest.sentToExileLog', { name: playtestCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  const handleLibraryToGraveyard = useCallback(
    (playtestId: string) => {
      const moved = moveCard(playtestId, PlaytestZone.LIBRARY, PlaytestZone.GRAVEYARD);
      if (moved) {
        logAction(
          t('playtest.movedFromPileLog', {
            name: playtestCardName(moved),
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
      if (moved) logAction(t('playtest.discardedCardLog', { name: playtestCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  const handleSendToLibraryPosition = useCallback(
    (playtestId: string, position: number, source: PlaytestZone = PlaytestZone.HAND) => {
      const clampedPosition = Math.max(0, Math.min(position, libraryLength));
      const moved = moveCard(playtestId, source, PlaytestZone.LIBRARY, position);
      if (moved) {
        logAction(t('playtest.libraryPositionLog', { name: playtestCardName(moved), pos: clampedPosition + 1 }));
      }
    },
    [moveCard, libraryLength, logAction, t]
  );

  const handleReturnToHand = useCallback(
    (playtestId: string, fromZone: PlaytestZone) => {
      const moved = moveCard(playtestId, fromZone, PlaytestZone.HAND);
      if (moved) logAction(t('playtest.returnedHandLog', { name: playtestCardName(moved) }));
    },
    [moveCard, logAction, t]
  );

  return {
    handleSendToGraveyard,
    handleSendToExile,
    handleLibraryToGraveyard,
    handleDiscardFromHand,
    handleSendToLibraryPosition,
    handleReturnToHand
  };
}
