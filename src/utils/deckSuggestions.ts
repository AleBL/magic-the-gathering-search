import { Card } from '../types/Card';

const WUBRG = ['W', 'U', 'B', 'R', 'G'];

const THEME_MIN_CREATURES = 3;
const THEME_MIN_SHARE = 0.25;

/** In canonical WUBRG order, which is what Scryfall's `id<=` expects. */
export function deckColorIdentity(cards: Card[]): string[] {
  const set = new Set<string>();
  for (const card of cards) for (const c of card.color_identity ?? []) set.add(c);
  return WUBRG.filter((c) => set.has(c));
}

// Null unless the theme is strong enough to be worth biasing suggestions toward: a handful of
// Elves in a deck about something else would drag every suggestion off-topic.
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

  if (creatureCount < THEME_MIN_CREATURES) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [sub, count] of counts) {
    if (count > bestCount) {
      best = sub;
      bestCount = count;
    }
  }

  return best && bestCount >= THEME_MIN_CREATURES && bestCount / creatureCount >= THEME_MIN_SHARE ? best : null;
}

export function buildSuggestionQuery(cards: Card[], format?: string): string {
  const colors = deckColorIdentity(cards);
  const identity = colors.length > 0 ? `id<=${colors.join('').toLowerCase()}` : 'id:c';
  const legal = format ? ` legal:${format.toLowerCase()}` : '';

  // The `o:` half is what brings in the payoffs (lords, tutors, tribal spells): they name the
  // type in their text without being of it.
  const theme = dominantCreatureType(cards);
  const themeFilter = theme ? ` (t:${theme.toLowerCase()} or o:"${theme.toLowerCase()}")` : '';

  return `${identity}${legal}${themeFilter} -t:basic`;
}
