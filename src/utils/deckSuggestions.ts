import { Card } from '../types/Card';

const WUBRG = ['W', 'U', 'B', 'R', 'G'];

/** Union of the deck's color identity, returned in canonical WUBRG order. */
export function deckColorIdentity(cards: Card[]): string[] {
  const set = new Set<string>();
  for (const card of cards) for (const c of card.color_identity ?? []) set.add(c);
  return WUBRG.filter((c) => set.has(c));
}

/**
 * Builds a Scryfall query for cards that fit the deck: within its color
 * identity and (optionally) legal in its format, excluding basic lands.
 */
export function buildSuggestionQuery(cards: Card[], format?: string): string {
  const colors = deckColorIdentity(cards);
  const identity = colors.length > 0 ? `id<=${colors.join('').toLowerCase()}` : 'id:c';
  const legal = format ? ` legal:${format.toLowerCase()}` : '';
  return `${identity}${legal} -t:basic`;
}
