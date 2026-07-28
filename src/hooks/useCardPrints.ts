import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Scry from 'scryfall-sdk';
import { Card } from '../types/Card';
import { dispatchToast } from '../utils/toastHelper';

export function useCardPrints(cardOrName: Card | string | undefined, oracleId?: string, isToken?: boolean) {
  const [prints, setPrints] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, i18n } = useTranslation();

  const isCardObject = typeof cardOrName !== 'string';
  const cardName = isCardObject ? cardOrName?.name : cardOrName;
  const targetOracleId = isCardObject ? cardOrName?.oracle_id : oracleId;
  const originalPower = isCardObject ? cardOrName?.power : undefined;
  const originalToughness = isCardObject ? cardOrName?.toughness : undefined;
  const originalColors = isCardObject ? cardOrName?.colors : undefined;
  const originalTypeLine = isCardObject ? cardOrName?.type_line : undefined;
  const originalOracleText = isCardObject ? cardOrName?.oracle_text : undefined;

  useEffect(() => {
    if (!cardName && !targetOracleId) {
      setPrints([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const targetLang = i18n.language || 'en';
    const cleanLang = targetLang.split('-')[0].toLowerCase();

    // Every printing in every language (`lang:any` + `unique:prints`), so the
    // user can switch a card's language/edition, not just its art.
    let query = '';
    if (isToken) {
      // Use name:!"name" for exact name match on Scryfall
      query = `t:token name:!"${cardName}" unique:prints lang:any`;
    } else if (targetOracleId && !targetOracleId.startsWith('token-oracle-')) {
      query = `oracle_id:${targetOracleId} unique:prints lang:any`;
    } else {
      query = `!"${cardName}" unique:prints lang:any`;
    }

    const results: Card[] = [];
    const emitter = Scry.Cards.search(query);

    emitter.on('data', (card: Scry.Card) => {
      const multiverseId = card.multiverse_ids?.[0];
      const gathererUrl = multiverseId
        ? `https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=${multiverseId}&type=card`
        : '';

      results.push({
        ...(card as unknown as Card),
        image_uris: card.image_uris
          ? {
              ...card.image_uris,
              gatherer: gathererUrl
            }
          : undefined
      });
    });

    emitter.on('done', () => {
      // Keep every printing (all languages); only filter mismatched tokens.
      const filtered = results.filter((printCard) => {
        if (isToken && isCardObject) {
          const powerMatches = (printCard.power || '') === (originalPower || '');
          const toughnessMatches = (printCard.toughness || '') === (originalToughness || '');
          const colorsMatches = (printCard.colors ?? []).sort().join(',') === (originalColors ?? []).sort().join(',');
          const typeLineMatches = (printCard.type_line || '') === (originalTypeLine || '');
          const oracleTextMatches =
            (printCard.oracle_text || '').trim().toLowerCase() === (originalOracleText || '').trim().toLowerCase();
          return powerMatches && toughnessMatches && colorsMatches && typeLineMatches && oracleTextMatches;
        }
        return true;
      });

      // Sort: printings with images first, then the app-language ones, so the
      // most relevant editions surface at the top of a potentially long list.
      const sorted = filtered.sort((a, b) => {
        const aImg = a.image_uris?.normal || a.card_faces?.[0]?.image_uris?.normal;
        const bImg = b.image_uris?.normal || b.card_faces?.[0]?.image_uris?.normal;
        if (aImg && !bImg) return -1;
        if (!aImg && bImg) return 1;
        const aLang = a.lang === cleanLang ? 0 : 1;
        const bLang = b.lang === cleanLang ? 0 : 1;
        return aLang - bLang;
      });
      setPrints(sorted);
      setIsLoading(false);
    });

    emitter.on('error', (err: Error) => {
      // Suppress 404/not found errors, just return empty list
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
      // Cancel search emitter on unmount/card change
      try {
        emitter.cancel();
      } catch {
        // Suppress emitter cancellation errors
      }
    };
  }, [
    cardName,
    targetOracleId,
    i18n.language,
    isToken,
    isCardObject,
    originalPower,
    originalToughness,
    originalColors,
    originalTypeLine,
    originalOracleText
  ]);

  return { prints, isLoading, error };
}
