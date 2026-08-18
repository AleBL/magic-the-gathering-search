export const AlertVariant = {
  DANGER: 'danger',
  WARNING: 'warning',
  SUCCESS: 'success',
  INFO: 'info'
} as const;

export type AlertVariant = (typeof AlertVariant)[keyof typeof AlertVariant];

export const DeckFormatType = {
  STANDARD: 'standard',
  MODERN: 'modern',
  COMMANDER: 'commander',
  VINTAGE: 'vintage',
  PAUPER: 'pauper',
  FREEFORM: 'freeform'
} as const;

export type DeckFormatType = (typeof DeckFormatType)[keyof typeof DeckFormatType];

export const DeckZone = {
  MAIN: 'main',
  SIDEBOARD: 'sideboard',
  MAYBEBOARD: 'maybeboard',
  TOKENS: 'tokens'
} as const;

export type DeckZone = (typeof DeckZone)[keyof typeof DeckZone];

export const PrintZoneFilter = {
  ALL: 'all',
  MAIN: DeckZone.MAIN,
  SIDEBOARD: DeckZone.SIDEBOARD,
  MAYBEBOARD: DeckZone.MAYBEBOARD,
  TOKENS: DeckZone.TOKENS,
  MAIN_TOKENS: `${DeckZone.MAIN}+${DeckZone.TOKENS}`,
  SIDEBOARD_TOKENS: `${DeckZone.SIDEBOARD}+${DeckZone.TOKENS}`,
  MAYBEBOARD_TOKENS: `${DeckZone.MAYBEBOARD}+${DeckZone.TOKENS}`,
  MAIN_SIDEBOARD: `${DeckZone.MAIN}+${DeckZone.SIDEBOARD}`,
  MAIN_MAYBEBOARD: `${DeckZone.MAIN}+${DeckZone.MAYBEBOARD}`,
  SIDEBOARD_MAYBEBOARD: `${DeckZone.SIDEBOARD}+${DeckZone.MAYBEBOARD}`,
  MAIN_SIDEBOARD_MAYBEBOARD: `${DeckZone.MAIN}+${DeckZone.SIDEBOARD}+${DeckZone.MAYBEBOARD}`
} as const;

export type PrintZoneFilter = (typeof PrintZoneFilter)[keyof typeof PrintZoneFilter];

export const GroupCriteria = {
  NONE: 'none',
  TYPE: 'type',
  CMC: 'cmc',
  COLOR: 'color'
} as const;

export type GroupCriteria = (typeof GroupCriteria)[keyof typeof GroupCriteria];

export const SortCriteria = {
  NAME: 'name',
  CMC: 'cmc',
  RARITY: 'rarity'
} as const;

export type SortCriteria = (typeof SortCriteria)[keyof typeof SortCriteria];

// Position inside the library is {@link LibraryPlacement}, not a zone of its own, so every
// move stays a plain `from` one zone `to` another.
export const PlaytestZone = {
  LIBRARY: 'library',
  HAND: 'hand',
  BATTLEFIELD: 'battlefield',
  GRAVEYARD: 'graveyard',
  EXILE: 'exile'
} as const;

export type PlaytestZone = (typeof PlaytestZone)[keyof typeof PlaytestZone];

/** Where a card lands when moved into the library: the top, the bottom, or a 0-based index. */
export type LibraryPlacement = 'top' | 'bottom' | number;

export const DECK_FORMATS = ['standard', 'modern', 'commander', 'vintage', 'pauper'] as const;

export const LEGALITY = {
  LEGAL: 'legal',
  BANNED: 'banned',
  RESTRICTED: 'restricted',
  NOT_LEGAL: 'not_legal'
} as const;
