import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Scry from 'scryfall-sdk';
import { Card } from '../types/Card';
import { translateCards } from '../utils/translationHelper';
import { dispatchToast } from '../utils/toastHelper';
import { isCardLike, readField, ScryfallPartRef, toPartRefs } from '../utils/typeGuards';

export interface RelatedToken {
  tokenCard: Card;
  generatorCardName: string;
  isActive?: boolean;
}

export function useCardRelatedTokensForCard(card: Card | null) {
  const [tokens, setTokens] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!card) {
      setTokens([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchTokens = async () => {
      try {
        const localParts = readField(card, 'all_parts');
        let allParts: ScryfallPartRef[] | null = Array.isArray(localParts) ? toPartRefs(localParts) : null;
        if (!allParts) {
          try {
            // By English name: only the English card carries `all_parts`.
            const fullCard = await Scry.Cards.byName(card.name);
            allParts = toPartRefs(readField(fullCard, 'all_parts'));
          } catch (fetchAllPartsError) {
            // Swallowing this made "we could not ask" look exactly like "this card makes no
            // tokens": the list rendered empty with nothing to say otherwise. The outer
            // catch reports it.
            logger.error('Failed to fetch full card for related tokens:', fetchAllPartsError);
            throw fetchAllPartsError;
          }
        }

        const tokenParts = allParts.filter((part) => part.id !== card.id && part.name !== card.name);

        if (tokenParts.length === 0) {
          setTokens([]);
          return;
        }

        const fetched: Card[] = [];

        await Promise.all(
          tokenParts.map(async (part: ScryfallPartRef) => {
            try {
              const fetchedCard = await Scry.Cards.byId(part.id);
              if (isCardLike(fetchedCard)) {
                fetched.push(fetchedCard);
              }
            } catch (tokenFetchError) {
              logger.error('Failed to fetch related token:', tokenFetchError);
            }
          })
        );

        const currentLang = i18n.language || 'en';
        const translated = await translateCards(fetched, currentLang);
        setTokens(translated);
      } catch (error) {
        logger.error('Failed to fetch related tokens:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch related tokens';
        setError(message);
        dispatchToast(t('common.relatedTokensLoadError'), 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, [card, i18n.language, t]);

  return { tokens, isLoading, error };
}
