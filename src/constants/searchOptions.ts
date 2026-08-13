/**
 * Closed lists for the two select filters. Free text would be worse than useless here: a
 * typo returns nothing, with no way to tell a wrong spelling from a genuinely empty result.
 *
 * The slugs below are what Scryfall is sent, in English, always. Only the *label* is
 * translated — see `search.keywords.*` and `search.oracleTags.*` in the locales.
 */

/** `first strike` → `firstStrike`, `spot-removal` → `spotRemoval`: the slug owns the key. */
export const toLabelKey = (value: string): string =>
  value.replace(/[-\s]+(.)/g, (_match, char: string) => char.toUpperCase());

/** Keyword abilities (`kw:`). Common evergreen and near-evergreen ones. */
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

/**
 * Community function tags (`otag:`), from the Tagger project. Every slug below was checked
 * against `api.scryfall.com/cards/search?q=otag:<slug>` on 2026-08-06 and returned results
 * — guessed slugs are indistinguishable from a card that simply does not exist.
 *
 * Tagger is community-maintained, so a slug can in principle be renamed; a select that
 * suddenly returns nothing is the symptom.
 */
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
