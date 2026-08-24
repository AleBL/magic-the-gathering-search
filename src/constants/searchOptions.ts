// Closed lists, because a typo in free text returns nothing and reads exactly like a
// genuinely empty result. Slugs go to Scryfall in English always; only the label is localized.

/** `first strike` → `firstStrike`, `spot-removal` → `spotRemoval`: the slug owns the key. */
export const toLabelKey = (value: string): string =>
  value.replace(/[-\s]+(.)/g, (_match, char: string) => char.toUpperCase());

export const KEYWORD_OPTIONS = [
  'flying',
  'trample',
  'haste',
  'vigilance',
  'first strike',
  'double strike',
  'deathtouch',
  'lifelink',
  'menace',
  'reach',
  'hexproof',
  'ward',
  'indestructible',
  'flash',
  'defender',
  'prowess',
  'cycling',
  'flashback',
  'kicker',
  'scry'
] as const;

// Community tags from Tagger, each verified against `cards/search?q=otag:<slug>` on
// 2026-08-06: a guessed slug returns nothing and looks exactly like a tag with no cards.
// Tagger can rename one, and a select that suddenly comes back empty is the symptom.
export const ORACLE_TAG_OPTIONS = [
  'removal',
  'spot-removal',
  'board-wipe',
  'ramp',
  'mana-rock',
  'mana-dork',
  'draw',
  'card-advantage',
  'cantrip',
  'tutor',
  'counterspell',
  'recursion',
  'graveyard-hate',
  'protection',
  'sacrifice-outlet',
  'lands-matter',
  'extra-turn',
  'win-condition'
] as const;
