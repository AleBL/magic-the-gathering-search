import { logger } from '../../utils/logger';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../types/Card';
import { CardWithScryfallMetadata, ScryfallCardPart } from '../../types/Scryfall';
import { RelatedToken } from '../useCardRelatedTokens';
import { translateCards } from '../../utils/translationHelper';
import { dispatchToast } from '../../utils/toastHelper';
import { findTokenGenerators, withImageFallback, withoutKnownTokens } from '../../utils/tokenCards';
import { isBrowserOffline } from '../../utils/scryfallSearch';

const COLLECTION_BATCH_SIZE = 75;

/** Token printing id to the name of the deck card that makes it. */
type GeneratorByPartId = Map<string, string>;

async function collectTokenPartIds(
  generators: Card[]
): Promise<{ partIdToGenerator: GeneratorByPartId; lookupFailed: boolean }> {
  const partIdToGenerator: GeneratorByPartId = new Map();
  let lookupFailed = false;

  await Promise.all(
    generators.map(async (generator) => {
      let allParts = (generator as CardWithScryfallMetadata).all_parts;
      if (!allParts) {
        try {
          const response = await fetch(
            `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(generator.name)}`
          );
          // A 404 is an answer: Scryfall has no such card, so it makes no tokens. Any
          // other failed status is Scryfall not answering, which is not the same thing.
          if (!response.ok && response.status !== 404) lookupFailed = true;
          allParts = response.ok ? ((await response.json()).all_parts as ScryfallCardPart[]) || [] : [];
        } catch (error) {
          logger.error('Failed to fetch full card during deck analysis:', error);
          lookupFailed = true;
          allParts = [];
        }
      }

      (allParts || [])
        .filter((part) => part.component === 'token' && part.id !== generator.id && part.name !== generator.name)
        .forEach((part) => {
          if (!partIdToGenerator.has(part.id)) {
            partIdToGenerator.set(part.id, generator.printed_name || generator.name);
          }
        });
    })
  );

  return { partIdToGenerator, lookupFailed };
}

/** One request per 75 ids, the collection endpoint's limit, instead of one call per token. */
async function fetchTokenPrintings(partIds: string[]): Promise<Card[]> {
  const printings: Card[] = [];
  for (let start = 0; start < partIds.length; start += COLLECTION_BATCH_SIZE) {
    const identifiers = partIds.slice(start, start + COLLECTION_BATCH_SIZE).map((id) => ({ id }));
    const response = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers })
    });
    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json.data)) printings.push(...(json.data as Card[]));
    }
  }
  return printings;
}

interface DeckTokenAnalysisArgs {
  cards: Card[];
  localTokens: RelatedToken[];
  addTokens: (tokens: RelatedToken[]) => void;
  onTokensLoaded?: (tokens: RelatedToken[]) => void;
}

/** Reads the deck, asks Scryfall which tokens its cards make, and adds the ones still missing. */
export function useDeckTokenAnalysis({ cards, localTokens, addTokens, onTokensLoaded }: DeckTokenAnalysisArgs) {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyzeDeck = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const generators = findTokenGenerators(cards);
    if (generators.length === 0) {
      setIsLoading(false);
      onTokensLoaded?.([]);
      return;
    }

    try {
      const { partIdToGenerator, lookupFailed } = await collectTokenPartIds(generators);

      // A generator whose parts could not be fetched contributes nothing, so an analysis that
      // reached no one ends exactly like a deck that makes no tokens — and the empty state
      // then states that as fact. Say a lookup failed, whether none or only some got through.
      if (lookupFailed) {
        dispatchToast(isBrowserOffline() ? t('search.scryfallOffline') : t('tokens.analysisError'), 'danger');
      }

      const partIds = Array.from(partIdToGenerator.keys());
      if (partIds.length === 0) {
        onTokensLoaded?.(localTokens);
        return;
      }

      const printings = await fetchTokenPrintings(partIds);
      const translated = await translateCards(printings, i18n.language || 'en');
      const discovered: RelatedToken[] = translated.map((finalCard, index) => ({
        tokenCard: withImageFallback(finalCard, printings[index]),
        generatorCardName: partIdToGenerator.get(printings[index].id) || t('common.manualAddition')
      }));

      addTokens(withoutKnownTokens(localTokens, discovered));
    } catch (error) {
      logger.error('Failed to analyze deck for tokens:', error);
      dispatchToast(t('tokens.analysisError'), 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleAnalyzeDeck };
}
