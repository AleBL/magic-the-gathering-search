import { Card } from '../types/Card';
import { buildSuggestionQuery } from '../utils/deckSuggestions';
import { logger } from '../utils/logger';
import { scryfallSearchUrl } from '../constants/urls';

interface ScryfallCardJson {
  id: string;
  oracle_id: string;
  name: string;
  type_line?: string;
  rarity?: string;
  set_name?: string;
  mana_cost?: string;
  cmc?: number;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  color_identity?: string[];
  image_uris?: Card['image_uris'];
  card_faces?: Card['card_faces'];
  prices?: Card['prices'];
}

function toCard(json: ScryfallCardJson): Card {
  return {
    id: json.id,
    oracle_id: json.oracle_id,
    name: json.name,
    printed_name: json.name,
    type_line: json.type_line ?? '',
    printed_type_line: json.type_line,
    rarity: json.rarity ?? 'common',
    set_name: json.set_name ?? '',
    mana_cost: json.mana_cost,
    cmc: json.cmc,
    oracle_text: json.oracle_text,
    power: json.power,
    toughness: json.toughness,
    colors: json.colors,
    color_identity: json.color_identity,
    image_uris: json.image_uris,
    card_faces: json.card_faces,
    prices: json.prices
  };
}

/** Ordered by EDHREC popularity, and never a card the deck already holds. */
export async function fetchDeckSuggestions(cards: Card[], format?: string, limit = 12): Promise<Card[]> {
  const query = buildSuggestionQuery(cards, format);
  const url = scryfallSearchUrl(query, { order: 'edhrec', unique: 'cards' });

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: ScryfallCardJson[] };
    const existing = new Set(cards.map((c) => c.name));
    return (data.data ?? [])
      .map(toCard)
      .filter((c) => !existing.has(c.name))
      .slice(0, limit);
  } catch (error) {
    logger.error('Failed to fetch deck suggestions:', error);
    return [];
  }
}
