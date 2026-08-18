import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Scry from 'scryfall-sdk';
import { Card } from '../types/Card';
import { dispatchToast } from '../utils/toastHelper';
import { buildPrintsQuery, sortPrintsByRelevance, tokenIdentityKey, withGathererImage } from '../utils/cardPrints';
import { isBrowserOffline } from '../utils/scryfallSearch';

export function useCardPrints(cardOrName: Card | string | undefined, oracleId?: string, isToken?: boolean) {
  const [prints, setPrints] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, i18n } = useTranslation();

  const isCardObject = typeof cardOrName !== 'string';
  const cardName = isCardObject ? cardOrName?.name : cardOrName;
  const targetOracleId = isCardObject ? cardOrName?.oracle_id : oracleId;
  // A string, not the card's own fields: arrays compare by reference, so a caller building
  // its card during render re-ran the lookup, which set state, which rebuilt the array.
  const originalIdentity = isCardObject && cardOrName ? tokenIdentityKey(cardOrName) : '';

  useEffect(() => {
    if (!cardName && !targetOracleId) {
      setPrints([]);
      return;
    }

    // With no connection the emitter is not dependable: an aborted request ends as `done`
    // with zero results or emits nothing at all, so the editions sidebar either read as
    // "this card has one printing" or waited forever.
    if (isBrowserOffline()) {
      setPrints([]);
      setIsLoading(false);
      setError('offline');
      return;
    }

    setIsLoading(true);
    setError(null);

    const results: Card[] = [];
    const emitter = Scry.Cards.search(buildPrintsQuery({ cardName, oracleId: targetOracleId, isToken }));

    emitter.on('data', (card: Scry.Card) => {
      results.push(withGathererImage(card as unknown as Card));
    });

    emitter.on('done', () => {
      const matching =
        isToken && isCardObject ? results.filter((print) => tokenIdentityKey(print) === originalIdentity) : results;
      const sorted = sortPrintsByRelevance(matching, i18n.language);

      // Zero results with no error event is also what a single-printing card looks like,
      // and the editions control simply disappeared. Say which one it was.
      if (sorted.length === 0 && isBrowserOffline()) {
        setError('offline');
      }

      setPrints(sorted);
      setIsLoading(false);
    });

    emitter.on('not_found', () => {
      setPrints([]);
      setIsLoading(false);
    });

    emitter.on('error', (err: Error) => {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setPrints([]);
      } else {
        logger.error('Failed to fetch card prints:', err);
        setError(err.message);
        dispatchToast(t('common.printsLoadError'), 'danger');
      }
      setIsLoading(false);
    });

    return () => {
      try {
        emitter.cancel();
      } catch {
        // A cancelled emitter that already finished throws; there is nothing left to stop.
      }
    };
  }, [cardName, targetOracleId, i18n.language, isToken, isCardObject, originalIdentity, t]);

  return { prints, isLoading, error };
}
