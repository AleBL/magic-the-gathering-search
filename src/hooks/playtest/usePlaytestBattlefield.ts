import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../types/Card';
import { playtestCardName } from '../../utils/playtestBoard';
import { newId } from '../../utils/id';
import { LogAction } from './usePlaytestLog';
import { PlaytestZones } from './usePlaytestZones';

/** In-place actions on cards already in play: tapping, counters, face-down state, tokens. */
export function usePlaytestBattlefield(zones: PlaytestZones, logAction: LogAction) {
  const { t } = useTranslation();
  const { setBattlefield } = zones;

  const handleToggleTapCard = useCallback(
    (playtestId: string) => {
      setBattlefield((previousBattlefield) => {
        const targetCard = previousBattlefield.find((item) => item.playtestId === playtestId);
        if (!targetCard) return previousBattlefield;
        const isTapped = !targetCard.isTapped;
        const cardName = playtestCardName(targetCard);
        logAction(
          isTapped ? t('playtest.tappedCardLog', { name: cardName }) : t('playtest.untappedCardLog', { name: cardName })
        );
        return previousBattlefield.map((item) => (item.playtestId === playtestId ? { ...item, isTapped } : item));
      });
    },
    [setBattlefield, logAction, t]
  );

  const handleAddCounter = useCallback(
    (playtestId: string) => {
      setBattlefield((previousBattlefield) =>
        previousBattlefield.map((item) => {
          if (item.playtestId === playtestId) {
            logAction(t('playtest.addedCounterLog', { name: playtestCardName(item) }));
            return { ...item, counters: (item.counters || 0) + 1 };
          }
          return item;
        })
      );
    },
    [setBattlefield, logAction, t]
  );

  const handleRemoveCounter = useCallback(
    (playtestId: string) => {
      setBattlefield((previousBattlefield) =>
        previousBattlefield.map((item) => {
          if (item.playtestId === playtestId) {
            if ((item.counters || 0) > 0) {
              logAction(t('playtest.removedCounterLog', { name: playtestCardName(item) }));
            }
            return { ...item, counters: Math.max(0, (item.counters || 0) - 1) };
          }
          return item;
        })
      );
    },
    [setBattlefield, logAction, t]
  );

  const handleToggleFaceDown = useCallback(
    (playtestId: string) => {
      setBattlefield((previousBattlefield) =>
        previousBattlefield.map((item) => {
          if (item.playtestId === playtestId) {
            const cardName = playtestCardName(item);
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
    [setBattlefield, logAction, t]
  );

  const handleUntapAll = useCallback(() => {
    setBattlefield((previousBattlefield) => {
      if (previousBattlefield.length === 0) return previousBattlefield;
      logAction(t('playtest.untappedAllLog'));
      return previousBattlefield.map((item) => ({ ...item, isTapped: false }));
    });
  }, [setBattlefield, logAction, t]);

  const handleSummonToken = useCallback(
    (tokenCard: Card) => {
      setBattlefield((previousBattlefield) => [
        ...previousBattlefield,
        {
          playtestId: `${tokenCard.id}-${newId()}`,
          card: tokenCard,
          isTapped: false
        }
      ]);
      logAction(t('playtest.createdTokenLog', { name: tokenCard.printed_name || tokenCard.name }));
    },
    [setBattlefield, logAction, t]
  );

  return {
    handleToggleTapCard,
    handleAddCounter,
    handleRemoveCounter,
    handleToggleFaceDown,
    handleUntapAll,
    handleSummonToken
  };
}
