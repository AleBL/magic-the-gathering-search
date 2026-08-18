import { useTranslation } from 'react-i18next';
import { Card } from '../types/Card';
import { DeckRelatedToken } from '../types/Deck';
import { TokenPreset } from '../components/playtest/PlaytestTokenModal';
import { RelatedToken } from './useCardRelatedTokens';
import { buildPresetTokenCard } from './tokens/presetTokenCard';
import { useDeckTokenAnalysis } from './tokens/useDeckTokenAnalysis';
import { useDeckTokenList } from './tokens/useDeckTokenList';
import { useTokenPresets } from './tokens/useTokenPresets';
import { useTokenSearch } from './tokens/useTokenSearch';

interface UseDeckTokensArgs {
  cards: Card[];
  cachedTokens?: DeckRelatedToken[];
  onTokensLoaded?: (tokens: RelatedToken[]) => void;
}

/** State and Scryfall-backed actions for the deck tokens tab (presets, search, deck analysis). */
export function useDeckTokens({ cards, cachedTokens, onTokensLoaded }: UseDeckTokensArgs) {
  const { t } = useTranslation();
  const presets = useTokenPresets();
  const tokenList = useDeckTokenList({ cachedTokens, onTokensLoaded });
  const search = useTokenSearch(tokenList.addTokens);
  const analysis = useDeckTokenAnalysis({
    cards,
    localTokens: tokenList.localTokens,
    addTokens: tokenList.addTokens,
    onTokensLoaded
  });

  /** Quick add: a preset becomes a token straight away, with no search and no modal step. */
  const handlePresetClick = async (preset: TokenPreset) => {
    tokenList.addTokens([
      {
        tokenCard: buildPresetTokenCard(preset, t(preset.localeKey, preset.name)),
        generatorCardName: t('common.manualAddition')
      }
    ]);
    search.setIsSearchModalOpen(false);
  };

  return {
    presets,
    isSearchModalOpen: search.isSearchModalOpen,
    setIsSearchModalOpen: search.setIsSearchModalOpen,
    openSearchModal: search.openSearchModal,
    searchTerm: search.searchTerm,
    setSearchTerm: search.setSearchTerm,
    searchResults: search.searchResults,
    isSearching: search.isSearching,
    searchError: search.searchError,
    selectedTokenForDetail: search.selectedTokenForDetail,
    setSelectedTokenForDetail: search.setSelectedTokenForDetail,
    tokenDetailImageUrl: search.tokenDetailImageUrl,
    handleViewTokenDetail: search.handleViewTokenDetail,
    isLoading: analysis.isLoading,
    localTokens: tokenList.localTokens,
    handleDeleteToken: tokenList.handleDeleteToken,
    handlePresetClick,
    handleSearchTokens: search.handleSearchTokens,
    handleConfirmAddToken: search.handleConfirmAddToken,
    handleAnalyzeDeck: analysis.handleAnalyzeDeck
  };
}
