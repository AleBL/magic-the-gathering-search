import { logger } from '../utils/logger';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Scry from 'scryfall-sdk';
import { Card } from '../types/Card';
import { DeckRelatedToken } from '../types/Deck';
import { ShowToastFn } from '../types/Toast';
import { useDeckStore } from '../store/useDeckStore';
import { translateCards } from '../utils/translationHelper';

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
        let allParts = card.all_parts;
        if (!allParts) {
          const tokenKeywords = [
            'token',
            'create',
            'ficha',
            'criar',
            'crea',
            'crie',
            'investig',
            'incub',
            'fabric',
            'acumul',
            'enrolar',
            'amass'
          ];
          const text = (card.oracle_text || card.printed_text || '').toLowerCase();
          const hasTokenText = tokenKeywords.some((word) => text.includes(word));

          if (hasTokenText) {
            const fullCard = (await Scry.Cards.byName(card.name)) as Card;
            allParts = fullCard.all_parts || [];
          }
        }

        if (allParts && allParts.length > 0) {
          const tokenParts = allParts.filter((part) => part.id !== card.id && part.name !== card.name);

          if (tokenParts.length > 0) {
            const newTokens: DeckRelatedToken[] = [];
            await Promise.all(
              tokenParts.map(async (part) => {
                try {
                  const fetchedCard = await Scry.Cards.byId(part.id);
                  if (fetchedCard) {
                    const currentLang = i18n.language || 'en';
                    const translated = await translateCards([fetchedCard as unknown as Card], currentLang);
                    const finalCard = translated[0] || fetchedCard;

                    newTokens.push({
                      tokenCard: finalCard,
                      generatorCardName: card.printed_name || card.name,
                      isActive: true
                    });
                  }
                } catch (tokenFetchError) {
                  logger.error('Failed to fetch related token for deck card:', tokenFetchError);
                }
              })
            );

            if (newTokens.length > 0) {
              setCurrentDeckRelatedTokens((prev) => {
                const existingIds = new Set(prev.map((token) => token.tokenCard.id));
                const filteredNew = newTokens.filter((token) => !existingIds.has(token.tokenCard.id));
                return [...prev, ...filteredNew];
              });
            }
          }
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
      const uniqueTokenCard = {
        ...tokenCard,
        id: `token-${tokenCard.id.split('-')[1] || tokenCard.id}-${Math.random().toString(36).substring(2, 9)}`
      };
      const newToken: DeckRelatedToken = {
        tokenCard: uniqueTokenCard,
        generatorCardName: t('common.manualAddition'),
        isActive: true
      };
      setCurrentDeckRelatedTokens((prev) => {
        const existingIds = new Set(prev.map((token) => token.tokenCard.id));
        if (existingIds.has(uniqueTokenCard.id)) return prev;
        return [...prev, newToken];
      });
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
