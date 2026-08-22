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
import { RequestPacer, createPacer, fetchWithRateLimitRetry } from '../../services/scryfallPacing';

const COLLECTION_BATCH_SIZE = 75;

const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';

/** Token printing id to the name of the deck card that makes it. */
type GeneratorByPartId = Map<string, string>;

/** One paced POST per 75 identifiers, the collection endpoint's limit. */
async function postCollection(
  identifiers: Array<Record<string, string>>,
  pacer: RequestPacer
): Promise<{ data: unknown[]; failed: boolean }> {
  const collected: unknown[] = [];
  let failed = false;

  for (let start = 0; start < identifiers.length; start += COLLECTION_BATCH_SIZE) {
    const batch = identifiers.slice(start, start + COLLECTION_BATCH_SIZE);
    try {
      const response = await fetchWithRateLimitRetry(pacer, COLLECTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batch })
      });

      // Identifiers Scryfall cannot resolve come back under `not_found`, which is an
      // answer and not a failure. Any bad status is Scryfall not answering at all.
      if (!response.ok) {
        failed = true;
        continue;
      }

      const json = await response.json();
      if (Array.isArray(json.data)) collected.push(...json.data);
    } catch (error) {
      logger.error('Failed to reach Scryfall during deck analysis:', error);
      failed = true;
    }
  }

  return { data: collected, failed };
}

/**
 * Which tokens the deck's generators make.
 *
 * One batched request per 75 generators rather than one `/cards/named` call each. The
 * per-card version fanned out through `Promise.all`, so a Commander deck fired dozens of
 * simultaneous requests and Scryfall answered 429 — intermittently, since whether it
 * tripped depended on how many generators the deck happened to hold.
 */
async function collectTokenPartIds(
  generators: Card[],
  pacer: RequestPacer
): Promise<{ partIdToGenerator: GeneratorByPartId; lookupFailed: boolean }> {
  const partIdToGenerator: GeneratorByPartId = new Map();

  // A generator the deck already carries full metadata for needs no request at all.
  const toLookUp = generators.filter((generator) => !(generator as CardWithScryfallMetadata).all_parts);

  // `name` on a Scryfall card is always the English name, which is what the collection
  // endpoint matches; the localized one lives in `printed_name`.
  const { data, failed } = await postCollection(
    toLookUp.map((generator) => ({ name: generator.name })),
    pacer
  );

  const fetchedByName = new Map<string, Card>();
  (data as Card[]).forEach((card) => {
    if (card?.name) fetchedByName.set(card.name.toLowerCase(), card);
  });

  // Deck order, not fetch order: when two cards make the same token, the one credited on
  // screen is the first in the deck rather than whichever request happened to land first.
  generators.forEach((generator) => {
    const source = (generator as CardWithScryfallMetadata).all_parts
      ? generator
      : fetchedByName.get(generator.name.toLowerCase());
    const allParts = ((source as CardWithScryfallMetadata | undefined)?.all_parts ?? []) as ScryfallCardPart[];

    allParts
      .filter((part) => part.component === 'token' && part.id !== generator.id && part.name !== generator.name)
      .forEach((part) => {
        if (!partIdToGenerator.has(part.id)) {
          partIdToGenerator.set(part.id, generator.printed_name || generator.name);
        }
      });
  });

  return { partIdToGenerator, lookupFailed: failed };
}

/** The token printings themselves, on the same clock as the lookup above. */
async function fetchTokenPrintings(
  partIds: string[],
  pacer: RequestPacer
): Promise<{ printings: Card[]; failed: boolean }> {
  const { data, failed } = await postCollection(
    partIds.map((id) => ({ id })),
    pacer
  );
  return { printings: data as Card[], failed };
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

    // One clock for the whole analysis: the lookup, the printings and the translation pass
    // that follows all talk to Scryfall, and the gaps have to hold across the three.
    const pacer = createPacer();

    try {
      const { partIdToGenerator, lookupFailed } = await collectTokenPartIds(generators, pacer);

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

      const { printings, failed: printingsFailed } = await fetchTokenPrintings(partIds, pacer);
      // A batch that never came back used to vanish quietly, leaving the tab looking like
      // Scryfall had answered with fewer tokens than the deck actually makes.
      if (printingsFailed && !lookupFailed) {
        dispatchToast(isBrowserOffline() ? t('search.scryfallOffline') : t('tokens.analysisError'), 'danger');
      }

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
