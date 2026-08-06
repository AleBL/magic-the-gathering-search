import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../types/Card';
import { DeckRelatedToken } from '../types/Deck';
import { RelatedToken } from './useCardRelatedTokens';
import { tokenPresets, TokenPreset } from '../components/playtest/PlaytestTokenModal';
import { translateCards } from '../utils/translationHelper';
import { getCardImageUrl } from '../utils/deckGrouping';
import { CardWithScryfallMetadata, ScryfallCardPart, ScryfallSearchResponse } from '../types/Scryfall';
import { dispatchToast } from '../utils/toastHelper';

interface UseDeckTokensArgs {
  cards: Card[];
  cachedTokens?: DeckRelatedToken[];
  onTokensLoaded?: (tokens: RelatedToken[]) => void;
}

/** State and Scryfall-backed actions for the deck tokens tab (presets, search, deck analysis). */
export function useDeckTokens({ cards, cachedTokens, onTokensLoaded }: UseDeckTokensArgs) {
  const { t, i18n } = useTranslation();

  const [presets, setPresets] = useState<TokenPreset[]>(tokenPresets);

  useEffect(() => {
    const fetchPresetImages = async () => {
      try {
        const query =
          't:token (name:soldier or name:zombie or name:goblin or name:thopter or name:saproling or name:bird or name:beast or name:treasure or name:food)';
        const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const data = (await response.json()) as ScryfallSearchResponse;
        if (data.data && Array.isArray(data.data)) {
          const updated = tokenPresets.map((preset) => {
            const match = data.data?.find(
              (cardCandidate) => cardCandidate.name.toLowerCase() === preset.name.toLowerCase()
            );
            if (match) {
              const normalImg = match.image_uris?.normal || match.card_faces?.[0]?.image_uris?.normal;
              if (normalImg) {
                return { ...preset, imageUrl: normalImg };
              }
            }
            return preset;
          });
          setPresets(updated);
        }
      } catch (error) {
        // Keep default preset images when dynamic fetch fails.
        logger.error('Failed to fetch preset token images:', error);
      }
    };
    fetchPresetImages();
  }, []);

  // Modal & Search States
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTokenForDetail, setSelectedTokenForDetail] = useState<Card | null>(null);
  const [tokenDetailImageUrl, setTokenDetailImageUrl] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [localTokens, setLocalTokens] = useState<RelatedToken[]>([]);

  // Synchronize localTokens with incoming cached tokens
  useEffect(() => {
    if (cachedTokens !== undefined) {
      setLocalTokens(cachedTokens);
    } else {
      setLocalTokens([]);
    }
  }, [cachedTokens]);

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

  const handleDeleteToken = (tokenId: string) => {
    const updated = localTokens.filter((token) => token.tokenCard.id !== tokenId);
    setLocalTokens(updated);
    onTokensLoaded?.(updated);
  };

  const handlePresetClick = async (preset: TokenPreset) => {
    // Quick add: build a token card from the preset and add directly (no modal)
    const tokenCard: Card = {
      id: `token-${preset.id}-${Math.random().toString(36).substring(2, 9)}`,
      oracle_id: `token-oracle-${preset.id}`,
      name: preset.name,
      printed_name: t(preset.localeKey, preset.name),
      type_line: preset.type_line,
      printed_type_line: preset.type_line,
      oracle_text: preset.oracle_text,
      rarity: preset.rarity,
      set_name: preset.set_name,
      colors: preset.colors,
      color_identity: preset.colors,
      power: preset.power,
      toughness: preset.toughness,
      image_uris: preset.imageUrl
        ? {
            small: preset.imageUrl,
            normal: preset.imageUrl,
            large: preset.imageUrl,
            png: preset.imageUrl
          }
        : undefined
    };

    const newToken: RelatedToken = {
      tokenCard,
      generatorCardName: t('common.manualAddition')
    };
    const updated = [...localTokens, newToken];
    setLocalTokens(updated);
    onTokensLoaded?.(updated);
    // Close modal if open
    setIsSearchModalOpen(false);
  };

  const handleSearchTokens = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const query = `t:token lang:any ${searchTerm.trim()}`;
      const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);

      if (!response.ok) {
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
      if (json.data && Array.isArray(json.data)) {
        // Group tokens by unique identity: name + power/toughness + colors
        const grouped = new Map<string, Card>();
        (json.data as Card[]).forEach((token: Card) => {
          const key = [
            token.name?.toLowerCase().trim(),
            token.power || '',
            token.toughness || '',
            (token.colors || []).sort().join('')
          ].join('|');
          if (!grouped.has(key)) {
            grouped.set(key, token);
          }
        });
        setSearchResults(Array.from(grouped.values()));
      } else {
        setSearchResults([]);
      }
    } catch (err: unknown) {
      logger.error('Failed to search tokens:', err);
      if (err instanceof Error && err.message === 'ScryfallOffline') {
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
      const currentLang = i18n.language || 'en';
      const translated = await translateCards([selectedCard], currentLang);
      const finalCard = translated[0] || selectedCard;

      // Garantir que a ficha tem imagem associada e usar fallback para a de inglês caso não tenha normal
      const imgNormal = finalCard.image_uris?.normal || finalCard.card_faces?.[0]?.image_uris?.normal;
      const origNormal = selectedCard.image_uris?.normal || selectedCard.card_faces?.[0]?.image_uris?.normal;
      if (!imgNormal && origNormal) {
        finalCard.image_uris = {
          ...finalCard.image_uris,
          normal: origNormal,
          small: selectedCard.image_uris?.small || origNormal,
          large: selectedCard.image_uris?.large || origNormal,
          png: selectedCard.image_uris?.png || origNormal
        };
      }

      const uniqueTokenCard = {
        ...finalCard,
        id: `token-${finalCard.id || Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`
      };

      const newToken: RelatedToken = {
        tokenCard: uniqueTokenCard,
        generatorCardName: t('common.manualAddition')
      };

      const updated = [...localTokens, newToken];
      setLocalTokens(updated);
      onTokensLoaded?.(updated);
      setSelectedTokenForDetail(null);
      setIsSearchModalOpen(false);
    } catch (error) {
      logger.error('Failed to add token:', error);
      dispatchToast(t('tokens.addTokenError'), 'danger');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAnalyzeDeck = async () => {
    if (isLoading) return;
    setIsLoading(true);

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
    const nonLandCards = cards.filter((c) => !c.type_line?.toLowerCase().includes('land'));

    // Find generators in cards
    const generators = nonLandCards.filter((c) => {
      const text = (c.oracle_text || (c as CardWithScryfallMetadata).printed_text || '').toLowerCase();
      return tokenKeywords.some((word) => text.includes(word));
    });

    if (generators.length === 0) {
      setIsLoading(false);
      onTokensLoaded?.([]);
      return;
    }

    try {
      // 1) Resolve each generator's related parts (fetching all_parts only when
      //    missing), collecting unique token printing ids and their generator.
      const partIdToGenerator = new Map<string, string>();
      await Promise.all(
        generators.map(async (c) => {
          let allParts = (c as CardWithScryfallMetadata).all_parts;
          if (!allParts) {
            try {
              const resp = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.name)}`);
              allParts = resp.ok ? ((await resp.json()).all_parts as ScryfallCardPart[]) || [] : [];
            } catch (fetchAllPartsError) {
              logger.error('Failed to fetch full card during deck analysis:', fetchAllPartsError);
              allParts = [];
            }
          }

          (allParts || [])
            .filter((part) => part.component === 'token' && part.id !== c.id && part.name !== c.name)
            .forEach((part) => {
              if (!partIdToGenerator.has(part.id)) {
                partIdToGenerator.set(part.id, c.printed_name || c.name);
              }
            });
        })
      );

      const partIds = Array.from(partIdToGenerator.keys());
      if (partIds.length === 0) {
        onTokensLoaded?.(localTokens);
        return;
      }

      // 2) Batch-fetch every token printing in one/few requests via the
      //    collection endpoint (75 ids max) instead of one call per token.
      const fetchedCards: Card[] = [];
      for (let i = 0; i < partIds.length; i += 75) {
        const identifiers = partIds.slice(i, i + 75).map((id) => ({ id }));
        const resp = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers })
        });
        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json.data)) fetchedCards.push(...(json.data as Card[]));
        }
      }

      // 3) Translate the whole batch once, keeping an English image fallback.
      const currentLang = i18n.language || 'en';
      const translated = await translateCards(fetchedCards, currentLang);
      const newTokensToAdd: RelatedToken[] = translated.map((finalCard, index) => {
        const original = fetchedCards[index];
        const imgNormal = finalCard.image_uris?.normal || finalCard.card_faces?.[0]?.image_uris?.normal;
        const origNormal = original.image_uris?.normal || original.card_faces?.[0]?.image_uris?.normal;
        const tokenCard: Card =
          !imgNormal && origNormal
            ? {
                ...finalCard,
                image_uris: {
                  ...finalCard.image_uris,
                  normal: origNormal,
                  small: original.image_uris?.small || origNormal,
                  large: original.image_uris?.large || origNormal,
                  png: original.image_uris?.png || origNormal
                }
              }
            : finalCard;
        return { tokenCard, generatorCardName: partIdToGenerator.get(original.id) || t('common.manualAddition') };
      });

      // Merge results avoiding duplicate tokenCard IDs
      const existingIds = new Set(localTokens.map((token) => token.tokenCard.id));
      const filteredNew = newTokensToAdd.filter((token) => !existingIds.has(token.tokenCard.id));
      const updated = [...localTokens, ...filteredNew];

      setLocalTokens(updated);
      onTokensLoaded?.(updated);
    } catch (error) {
      logger.error('Failed to analyze deck for tokens:', error);
      dispatchToast(t('tokens.analysisError'), 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    presets,
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
    isLoading,
    localTokens,
    handleDeleteToken,
    handlePresetClick,
    handleSearchTokens,
    handleConfirmAddToken,
    handleAnalyzeDeck
  };
}
