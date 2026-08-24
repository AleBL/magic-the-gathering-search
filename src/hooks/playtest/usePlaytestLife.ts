import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startingLifeTotal } from '../../utils/playtestBoard';
import { LogAction } from './usePlaytestLog';

export function usePlaytestLife(logAction: LogAction) {
  const { t } = useTranslation();
  const [lifeTotal, setLifeTotal] = useState(startingLifeTotal());
  const [previousLifeTotal, setPreviousLifeTotal] = useState<number | null>(null);
  const skipNextLogRef = useRef(false);

  /** Undo/redo rewinds life to a past value, which is not a life change to announce. */
  const restoreLifeTotal = useCallback((value: number) => {
    skipNextLogRef.current = true;
    setLifeTotal(value);
  }, []);

  const resetLife = useCallback((value: number) => {
    skipNextLogRef.current = false;
    setLifeTotal(value);
    setPreviousLifeTotal(value);
  }, []);

  const logLifeChange = useCallback(() => {
    if (skipNextLogRef.current) {
      skipNextLogRef.current = false;
      setPreviousLifeTotal(lifeTotal);
      return;
    }
    if (previousLifeTotal !== null && previousLifeTotal !== lifeTotal) {
      logAction(t('playtest.lifeChangedLog', { from: previousLifeTotal, to: lifeTotal }));
    }
    setPreviousLifeTotal(lifeTotal);
  }, [lifeTotal, previousLifeTotal, logAction, t]);

  return { lifeTotal, setLifeTotal, restoreLifeTotal, resetLife, logLifeChange };
}
