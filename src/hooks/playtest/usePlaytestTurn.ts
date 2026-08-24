import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playtestCardName } from '../../utils/playtestBoard';
import { LogAction } from './usePlaytestLog';
import { PlaytestZones } from './usePlaytestZones';

export function usePlaytestTurn(zones: PlaytestZones, logAction: LogAction) {
  const { t } = useTranslation();
  const { setBattlefield, setLibrary, setHand } = zones;
  const [turn, setTurn] = useState(1);

  const handleNextTurn = useCallback(() => {
    setTurn((previousTurn) => {
      const nextTurn = previousTurn + 1;

      setBattlefield((previousBattlefield) => previousBattlefield.map((item) => ({ ...item, isTapped: false })));

      setLibrary((previousLibrary) => {
        let drawnCardName = '';
        if (previousLibrary.length > 0) {
          const nextCard = previousLibrary[0];
          drawnCardName = playtestCardName(nextCard);
          setHand((previousHand) => [...previousHand, { ...nextCard, isFaceDown: false }]);
        }

        logAction(t('playtest.turnStartedLog', { turn: nextTurn }));
        logAction(t('playtest.untappedAllLog'));
        if (drawnCardName) {
          logAction(t('playtest.drewCardLog', { name: drawnCardName }));
        }

        return previousLibrary.slice(1);
      });

      return nextTurn;
    });
  }, [setBattlefield, setLibrary, setHand, logAction, t]);

  return { turn, setTurn, handleNextTurn };
}
