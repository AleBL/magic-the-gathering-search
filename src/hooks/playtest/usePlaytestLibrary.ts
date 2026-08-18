import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { playtestCardName, shufflePlaytestCards } from '../../utils/playtestBoard';
import { LogAction } from './usePlaytestLog';
import { PlaytestZones } from './usePlaytestZones';

export function usePlaytestLibrary(zones: PlaytestZones, logAction: LogAction) {
  const { t } = useTranslation();
  const { setLibrary, setHand } = zones;

  const handleDrawCard = useCallback(() => {
    setLibrary((previousLibrary) => {
      if (previousLibrary.length === 0) return previousLibrary;
      const nextCard = previousLibrary[0];
      setHand((previousHand) => [...previousHand, { ...nextCard, isFaceDown: false }]);
      logAction(t('playtest.drewCardLog', { name: playtestCardName(nextCard) }));
      return previousLibrary.slice(1);
    });
  }, [setLibrary, setHand, logAction, t]);

  const handleShuffleLibrary = useCallback(() => {
    setLibrary((previousLibrary) => {
      if (previousLibrary.length === 0) return previousLibrary;
      const shuffled = shufflePlaytestCards(previousLibrary);
      logAction(t('playtest.shuffleLibraryLog'));
      return shuffled;
    });
  }, [setLibrary, logAction, t]);

  return { handleDrawCard, handleShuffleLibrary };
}
