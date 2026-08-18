import { Card } from '../types/Card';

/**
 * Adds the Gatherer image URL for printings that have a multiverse id, which is the only
 * source of art for cards Scryfall itself has no image for.
 */
export function withGathererImage(card: Card & { multiverse_ids?: number[] }): Card {
  const multiverseId = card.multiverse_ids?.[0];
  const gatherer = multiverseId
    ? `https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=${multiverseId}&type=card`
    : '';

  return {
    ...card,
    image_uris: card.image_uris ? { ...card.image_uris, gatherer } : undefined
  };
}

interface PrintsQueryArgs {
  cardName?: string;
  oracleId?: string;
  isToken?: boolean;
}

/**
 * Every printing in every language (`lang:any` + `unique:prints`), so the user can switch a
 * card's language and edition rather than only its art. Tokens have no shared oracle id, so
 * they are matched by exact name (`name:!"..."`) instead.
 */
export function buildPrintsQuery({ cardName, oracleId, isToken }: PrintsQueryArgs): string {
  if (isToken) return `t:token name:!"${cardName}" unique:prints lang:any`;
  if (oracleId && !oracleId.startsWith('token-oracle-')) return `oracle_id:${oracleId} unique:prints lang:any`;
  return `!"${cardName}" unique:prints lang:any`;
}

/**
 * What makes two token printings the same token. Scryfall answers a token name search with
 * every token that shares the name, including sizes and colours the deck never asked for.
 */
export function tokenIdentityKey(card: Card): string {
  return [
    card.power || '',
    card.toughness || '',
    // Spread before sorting: `.sort()` mutates, and these arrays belong to the cards.
    [...(card.colors ?? [])].sort().join(','),
    card.type_line || '',
    (card.oracle_text || '').trim().toLowerCase()
  ].join('|');
}

/** Printings with images first, then the ones in the app's language: the top of a long list. */
export function sortPrintsByRelevance(prints: Card[], language: string): Card[] {
  const cleanLang = (language || 'en').split('-')[0].toLowerCase();
  const hasImage = (card: Card) => !!(card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal);

  return [...prints].sort((first, second) => {
    if (hasImage(first) && !hasImage(second)) return -1;
    if (!hasImage(first) && hasImage(second)) return 1;
    return (first.lang === cleanLang ? 0 : 1) - (second.lang === cleanLang ? 0 : 1);
  });
}
