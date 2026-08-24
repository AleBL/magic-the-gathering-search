import { logger } from '../utils/logger';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Scry from 'scryfall-sdk';
import { Card } from '../types/Card';
import { DeckRelatedToken } from '../types/Deck';
import { ShowToastFn } from '../types/Toast';
import { useDeckStore } from '../store/useDeckStore';
import { translateCards } from '../utils/translationHelper';
import { mentionsTokenCreation, uniqueTokenId, withoutKnownTokens } from '../utils/tokenCards';

/**
 * The tokens a card makes, translated. Cards added from a search carry no `all_parts`, so the
 * full card is only re-fetched when its text suggests there is something to find.
 */
async function fetchRelatedTokens(card: Card, language: string): Promise<DeckRelatedToken[]> {
  let allParts = card.all_parts;
  if (!allParts) {
    if (!mentionsTokenCreation(card)) return [];
    const fullCard = (await Scry.Cards.byName(card.name)) as Card;
    allParts = fullCard.all_parts || [];
  }

  const tokenParts = allParts.filter((part) => part.id !== card.id && part.name !== card.name);
  const tokens: DeckRelatedToken[] = [];

  await Promise.all(
    tokenParts.map(async (part) => {
      try {
        const fetchedCard = (await Scry.Cards.byId(part.id)) as unknown as Card;
        if (!fetchedCard) return;
        const translated = await translateCards([fetchedCard], language);
        tokens.push({
          tokenCard: translated[0] || fetchedCard,
          generatorCardName: card.printed_name || card.name,
          isActive: true
        });
      } catch (tokenFetchError) {
        logger.error('Failed to fetch related token for deck card:', tokenFetchError);
      }
    })
  );

  return tokens;
}

export function useDeckActions(showToast: ShowToastFn) {
  const { t, i18n } = useTranslation();

  const addCard = useDeckStore((state) => state.addCard);
  const removeCard = useDeckStore((state) => state.removeCard);
  const setCurrentDeckRelatedTokens = useDeckStore((state) => state.setCurrentDeckRelatedTokens);

  const handleAddToDeck = useCallback(
    async (card: Card) => {
      addCard(card);
      showToast(`${card.name}: ${t('cardDetails.cardAdded')}`);

      try {
        const newTokens = await fetchRelatedTokens(card, i18n.language || 'en');
        if (newTokens.length > 0) {
          setCurrentDeckRelatedTokens((previous) => [...previous, ...withoutKnownTokens(previous, newTokens)]);
        }
      } catch (error) {
        logger.error('Failed to fetch related tokens for added card:', error);
        showToast(t('common.relatedTokensLoadError'), 'error');
      }
    },
    [addCard, i18n.language, setCurrentDeckRelatedTokens, showToast, t]
  );

  const handleAddTokenToDeck = useCallback(
    (tokenCard: Card) => {
      const newToken: DeckRelatedToken = {
        tokenCard: { ...tokenCard, id: uniqueTokenId(tokenCard.id.split('-')[1] || tokenCard.id) },
        generatorCardName: t('common.manualAddition'),
        isActive: true
      };
      setCurrentDeckRelatedTokens((previous) => [...previous, ...withoutKnownTokens(previous, [newToken])]);
      showToast(`${tokenCard.name}: ${t('tokens.tokenAdded')}`);
    },
    [setCurrentDeckRelatedTokens, showToast, t]
  );

  const handleRemoveFromDeckWithToast = useCallback(
    (cardToRemove: Card) => {
      const removedCard = removeCard(cardToRemove.id);
      if (removedCard) {
        showToast(`${cardToRemove.name}: ${t('cardDetails.cardRemoved')}`, 'info', {
          label: t('common.undo'),
          onClick: () => {
            handleAddToDeck(cardToRemove);
          }
        });
      }
    },
    [handleAddToDeck, removeCard, showToast, t]
  );

  return {
    handleAddToDeck,
    handleAddTokenToDeck,
    handleRemoveFromDeckWithToast
  };
}
