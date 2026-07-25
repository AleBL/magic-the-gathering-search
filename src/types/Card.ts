import { DeckZone } from './enums';

export interface CardFace {
  name: string;
  printed_name?: string;
  type_line: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  mana_cost?: string;
  power?: string;
  toughness?: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop?: string;
  };
}

export interface Card {
  printed_name: string;
  id: string;
  oracle_id: string;
  name: string;
  printed_text?: string;
  type_line: string;
  printed_type_line?: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;
  power?: string;
  toughness?: string;
  rarity: string;
  set?: string;
  set_name: string;
  all_parts?: {
    id: string;
    object: string;
    component: string;
    name: string;
    type_line: string;
    uri: string;
  }[];

  // Scryfall standard fields
  scryfall_uri?: string;
  related_uris?: {
    gatherer?: string;
    [key: string]: string | undefined;
  };
  purchase_uris?: {
    tcgplayer?: string;
    [key: string]: string | undefined;
  };
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop?: string;
    gatherer?: string;
  };
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    tix?: string | null;
  };
  legalities?: {
    standard: string;
    modern: string;
    legacy: string;
    commander: string;
    pauper: string;
    vintage: string;
    pioneer: string;
  };
  card_faces?: CardFace[];
  /** Scryfall frame layout: 'normal', 'split', 'aftermath', 'flip', 'transform',
   *  'modal_dfc', 'adventure', 'meld', etc. Distinguishes same-side multi-face
   *  cards (split/aftermath — read sideways) from genuine double-faced cards. */
  layout?: string;
  colors?: string[];
  color_identity?: string[];
  isCommander?: boolean;
  zone?: DeckZone;
  selectedPrintId?: string;
  selectedPrintImageUri?: string;
  collector_number?: string;
  artist?: string;
  lang?: string;
  isActive?: boolean;
}
