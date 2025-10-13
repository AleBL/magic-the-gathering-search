export interface Card {
  id: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;
  power?: string;
  toughness?: string;
  rarity: string;
  set_name: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  card_faces?: Array<{
    name: string;
    type_line: string;
    oracle_text?: string;
    mana_cost?: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
    };
  }>;
}

