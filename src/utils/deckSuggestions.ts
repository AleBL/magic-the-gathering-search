import { Card } from '../types/Card';

const WUBRG = ['W', 'U', 'B', 'R', 'G'];

/** Union of the deck's color identity, returned in canonical WUBRG order. */
export function deckColorIdentity(cards: Card[]): string[] {
  const set = new Set<string>();
  for (const card of cards) for (const c of card.color_identity ?? []) set.add(c);
  return WUBRG.filter((c) => set.has(c));
}

/**
 * The creature subtype that dominates the deck (e.g. "Elf", "Zombie"), or null
 * when the deck has no clear tribal theme. Used to bias suggestions toward
 * cards that actually synergize instead of generically popular ones.
 *
 * A theme qualifies only when its subtype covers at least a quarter of the
 * deck's creatures and appears on 3+ of them.
 */
export function dominantCreatureType(cards: Card[]): string | null {
  const counts = new Map<string, number>();
  let creatureCount = 0;

  for (const card of cards) {
    const line = card.type_line ?? '';
    if (!/creature/i.test(line)) continue;
    creatureCount += 1;
    const subtypes = line.split('—')[1];
    if (!subtypes) continue;
    for (const sub of subtypes.trim().split(/\s+/)) {
      if (sub) counts.set(sub, (counts.get(sub) ?? 0) + 1);
    }
  }

  if (creatureCount < 3) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [sub, count] of counts) {
    if (count > bestCount) {
      best = sub;
      bestCount = count;
    }
  }

  return best && bestCount >= 3 && bestCount / creatureCount >= 0.25 ? best : null;
}

/**
 * Builds a Scryfall query for cards that fit the deck: within its color
 * identity, (optionally) legal in its format, biased toward its tribal theme
 * when it has one, excluding basic lands.
 */
export function buildSuggestionQuery(cards: Card[], format?: string): string {
  const colors = deckColorIdentity(cards);
  const identity = colors.length > 0 ? `id<=${colors.join('').toLowerCase()}` : 'id:c';
  const legal = format ? ` legal:${format.toLowerCase()}` : '';

  // Members of the theme type plus its payoffs (cards that name the type in
  // their text — lords, tutors, tribal spells).
  const theme = dominantCreatureType(cards);
  const themeFilter = theme ? ` (t:${theme.toLowerCase()} or o:"${theme.toLowerCase()}")` : '';

  return `${identity}${legal}${themeFilter} -t:basic`;
}
