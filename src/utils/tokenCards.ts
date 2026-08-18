import { Card } from '../types/Card';
import { CardWithScryfallMetadata } from '../types/Scryfall';

// Any language: a deck imported in pt-BR has its rules text in pt-BR, and matching only
// "create"/"token" would report those decks as making no tokens at all.
const TOKEN_KEYWORDS = [
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

export const uniqueTokenId = (seed?: string): string =>
  `token-${seed || Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;

/** Whether the card's rules text, in any language the app reads, suggests it makes tokens. */
export function mentionsTokenCreation(card: Card): boolean {
  const text = (card.oracle_text || (card as CardWithScryfallMetadata).printed_text || '').toLowerCase();
  return TOKEN_KEYWORDS.some((keyword) => text.includes(keyword));
}

/** The deck's token makers. Lands are excluded before the text check. */
export function findTokenGenerators(cards: Card[]): Card[] {
  return cards.filter((card) => !card.type_line?.toLowerCase().includes('land')).filter(mentionsTokenCreation);
}

/** The entries of `incoming` whose token is not already in `existing`, compared by card id. */
export function withoutKnownTokens<T extends { tokenCard: Card }>(existing: T[], incoming: T[]): T[] {
  const knownIds = new Set(existing.map((token) => token.tokenCard.id));
  return incoming.filter((token) => !knownIds.has(token.tokenCard.id));
}

/**
 * Restores images from the English printing when the translated one has none: Scryfall has
 * localized text for cards it has no localized art for, and the result would render blank.
 */
export function withImageFallback(card: Card, source: Card): Card {
  const cardImage = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
  const sourceImage = source.image_uris?.normal || source.card_faces?.[0]?.image_uris?.normal;
  if (cardImage || !sourceImage) return card;

  return {
    ...card,
    image_uris: {
      ...card.image_uris,
      normal: sourceImage,
      small: source.image_uris?.small || sourceImage,
      large: source.image_uris?.large || sourceImage,
      png: source.image_uris?.png || sourceImage
    }
  };
}

/**
 * One entry per distinct token, since Scryfall returns the same 1/1 white Soldier once per set
 * that printed it and the search list would otherwise be pages of the same card.
 */
export function dedupeTokensByIdentity(tokens: Card[]): Card[] {
  const byIdentity = new Map<string, Card>();
  for (const token of tokens) {
    const identity = [
      token.name?.toLowerCase().trim(),
      token.power || '',
      token.toughness || '',
      // Spread before sorting: `.sort()` mutates, and these arrays belong to the cards.
      [...(token.colors || [])].sort().join('')
    ].join('|');
    if (!byIdentity.has(identity)) {
      byIdentity.set(identity, token);
    }
  }
  return Array.from(byIdentity.values());
}
