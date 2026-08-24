import { logger } from './logger';
import { Card } from '../types/Card';
import i18n from '../plugins/i18n';
import { dispatchToast } from './toastHelper';
import { gathererImageUrl, scryfallSearchUrl } from '../constants/urls';

const hasPriceData = (prices?: Card['prices']): boolean =>
  !!prices && [prices.usd, prices.usd_foil, prices.eur, prices.eur_foil].some((v) => v != null && v !== '');

/** Order is preserved, and any card the API cannot translate comes back untouched. */
export async function translateCards(cards: Card[], targetLang: string): Promise<Card[]> {
  if (cards.length === 0) return [];

  // Scryfall's `lang:` takes the bare code, so a browser locale like "en-US" has to be cut.
  const lang = (targetLang || 'en').split('-')[0].toLowerCase();

  const oracleIdMap = new Map<string, Card>();
  cards.forEach((card) => {
    if (card.oracle_id) {
      oracleIdMap.set(card.oracle_id, card);
    }
  });

  const uniqueOracleIds = Array.from(oracleIdMap.keys());
  const translatedMap = new Map<string, Card>();

  // Batched because the whole query travels in the URL, and one oracle_id term is ~50 chars.
  const BATCH_SIZE = 20;
  for (let batchStartIndex = 0; batchStartIndex < uniqueOracleIds.length; batchStartIndex += BATCH_SIZE) {
    const batch = uniqueOracleIds.slice(batchStartIndex, batchStartIndex + BATCH_SIZE);

    // The parentheses are load-bearing: Scryfall binds adjacency tighter than OR, so without
    // them `lang:` constrains only the last oracle_id term and every other card comes back in
    // English. `include:extras` is what makes tokens and emblems, hidden from default search,
    // resolve to their localized printing instead of their English name.
    const oracleQuery = batch.map((id) => `oracle_id:${id}`).join(' OR ');
    const query = `(${oracleQuery}) lang:${lang} include:extras`;
    const url = scryfallSearchUrl(query);

    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        if (json.data && Array.isArray(json.data)) {
          json.data.forEach((card: Card & { multiverse_ids?: number[] }) => {
            if (card.oracle_id) {
              const multiverseId = card.multiverse_ids?.[0];
              const gathererUrl = multiverseId ? gathererImageUrl(multiverseId) : '';

              const image_uris = card.image_uris || {
                small: '',
                normal: '',
                large: '',
                png: ''
              };
              translatedMap.set(card.oracle_id, {
                ...card,
                image_uris: {
                  ...image_uris,
                  gatherer: gathererUrl || image_uris.gatherer
                }
              });
            }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to translate card batch:', error);
      dispatchToast(i18n.t('common.errorTranslatingBatch') as string, 'error');
    }
  }

  return cards.map((card) => {
    if (!card.oracle_id || !translatedMap.has(card.oracle_id)) return card;

    const translated = translatedMap.get(card.oracle_id)!;
    const hasImage = translated.image_uris?.normal || translated.card_faces?.[0]?.image_uris?.normal;
    const originalHasImage = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;

    let result: Card = translated;

    if (!hasImage && originalHasImage) {
      const gatherer = translated.image_uris?.gatherer;
      result = {
        ...translated,
        image_uris: card.image_uris
          ? {
              ...card.image_uris,
              gatherer: gatherer || card.image_uris.gatherer
            }
          : gatherer
            ? { small: '', normal: '', large: '', png: '', gatherer }
            : undefined,
        card_faces: card.card_faces
      };
    }

    // Localized printings very often ship with no price at all, and dropping the English
    // printing's prices would blank out the value of every imported deck.
    if (!hasPriceData(result.prices) && hasPriceData(card.prices)) {
      result = { ...result, prices: card.prices };
    }

    return result;
  });
}
