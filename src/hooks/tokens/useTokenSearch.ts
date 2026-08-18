import { logger } from '../../utils/logger';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../types/Card';
import { RelatedToken } from '../useCardRelatedTokens';
import { getCardImageUrl } from '../../utils/deckGrouping';
import { translateCards } from '../../utils/translationHelper';
import { dispatchToast } from '../../utils/toastHelper';
import { dedupeTokensByIdentity, uniqueTokenId, withImageFallback } from '../../utils/tokenCards';

/** Searching Scryfall for a token and adding the chosen printing to the deck. */
export function useTokenSearch(addTokens: (tokens: RelatedToken[]) => void) {
  const { t, i18n } = useTranslation();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTokenForDetail, setSelectedTokenForDetail] = useState<Card | null>(null);
  const [tokenDetailImageUrl, setTokenDetailImageUrl] = useState<string>('');

  const openSearchModal = () => {
    setIsSearchModalOpen(true);
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
  };

  const handleViewTokenDetail = (token: Card) => {
    setSelectedTokenForDetail(token);
    setTokenDetailImageUrl(getCardImageUrl(token));
  };

  const handleSearchTokens = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const query = `t:token lang:any ${searchTerm.trim()}`;
      const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        // 404 is Scryfall's answer for "no card matches", which is an empty result and not a failure.
        if (response.status === 404) {
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
        if (response.status === 503 || response.status === 504) {
          throw new Error('ScryfallOffline');
        }
        throw new Error('SearchError');
      }

      const json = await response.json();
      setSearchResults(json.data && Array.isArray(json.data) ? dedupeTokensByIdentity(json.data as Card[]) : []);
    } catch (error: unknown) {
      logger.error('Failed to search tokens:', error);
      // A dropped connection rejects the fetch with a generic network error, and "Error
      // searching tokens." next to an empty result list reads as a problem with the name.
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (isOffline || (error instanceof Error && error.message === 'ScryfallOffline')) {
        setSearchError(t('search.scryfallOffline'));
      } else {
        setSearchError(t('tokens.searchError'));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmAddToken = async (selectedCard: Card) => {
    setIsSearching(true);
    try {
      const translated = await translateCards([selectedCard], i18n.language || 'en');
      const finalCard = withImageFallback(translated[0] || selectedCard, selectedCard);

      addTokens([
        {
          tokenCard: { ...finalCard, id: uniqueTokenId(finalCard.id) },
          generatorCardName: t('common.manualAddition')
        }
      ]);
      setSelectedTokenForDetail(null);
      setIsSearchModalOpen(false);
    } catch (error) {
      logger.error('Failed to add token:', error);
      dispatchToast(t('tokens.addTokenError'), 'danger');
    } finally {
      setIsSearching(false);
    }
  };

  return {
    isSearchModalOpen,
    setIsSearchModalOpen,
    openSearchModal,
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    searchError,
    selectedTokenForDetail,
    setSelectedTokenForDetail,
    tokenDetailImageUrl,
    handleViewTokenDetail,
    handleSearchTokens,
    handleConfirmAddToken
  };
}
