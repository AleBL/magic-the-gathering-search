export type CardSize = 'small' | 'medium' | 'large' | 'xlarge';

export type AppTab = 'search' | 'deck' | 'collection';

export interface SearchFilters {
  colors: string[];
  types: string[];
  rarity: string;
  cmc: string;
  /** Oracle text the card must contain. Scryfall matches English text only. */
  text: string;
  excludeText: string;
  /** Keyword ability, e.g. `flying`. Closed list; see KEYWORD_OPTIONS. */
  keyword: string;
  /** Community function tag, e.g. `removal`. Closed list; see ORACLE_TAG_OPTIONS. */
  oracleTag: string;
  /** Accepts a leading comparator: `4`, `>=4`, `<2`. */
  power: string;
  toughness: string;
}
export * from './enums';
