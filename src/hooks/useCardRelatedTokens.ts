import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Scry from 'scryfall-sdk';
import { Card } from '../types/Card';
import { CardWithScryfallMetadata, ScryfallCardPart } from '../types/Scryfall';
import { translateCards } from '../utils/translationHelper';
import { dispatchToast } from '../utils/toastHelper';

export interface RelatedToken {
  tokenCard: Card;
  generatorCardName: string;
  isActive?: boolean;
}

// Hook to fetch related tokens for a single card (Improvement 9)
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
        let allParts = (card as CardWithScryfallMetadata).all_parts;
        if (!allParts) {
          try {
            // Fetch by English name to ensure we get the English card which has all_parts
            const fullCard = (await Scry.Cards.byName(card.name)) as CardWithScryfallMetadata;
            allParts = fullCard.all_parts || [];
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

        // Fetch each token by ID in parallel
        await Promise.all(
          tokenParts.map(async (part: ScryfallCardPart) => {
            try {
              const fetchedCard = await Scry.Cards.byId(part.id);
              if (fetchedCard) {
                fetched.push(fetchedCard as unknown as Card);
              }
            } catch (tokenFetchError) {
              logger.error('Failed to fetch related token:', tokenFetchError);
            }
          })
        );

        // Translate the fetched tokens to the selected language if available
        const currentLang = i18n.language || 'en';
        const translated = await translateCards(fetched, currentLang);
        setTokens(translated);
      } catch (error) {
        logger.error('Failed to fetch related tokens:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch related tokens';
        setError(message);
        dispatchToast(t('common.relatedTokensLoadError'), 'danger');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, [card, i18n.language, t]);

  return { tokens, isLoading, error };
}
