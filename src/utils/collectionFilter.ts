import { Card } from '../types/Card';
import { SearchFilters } from '../types';

/**
 * Applies the search panel's filters to cards already in hand.
 *
 * The search tab turns these same filters into a Scryfall query; the collection cannot, because
 * it works offline against IndexedDB. So the predicates are reimplemented locally, and where a
 * filter has no local equivalent it is left out of the panel rather than silently ignored:
 *
 * - **Oracle tags** are community metadata that only exists server-side. Not offered here.
 * - **Keywords** are matched against the rules text. Scryfall keeps a curated `keywords` array
 *   that the stored card does not carry, so "flying" finds cards whose text says flying — close
 *   enough to be useful, and it never claims to be the curated list.
 */

/** `4`, `>=4`, `<2`, `>3`. Returns null when the input is not a usable comparison. */
export function parseComparison(raw: string): { op: string; value: number } | null {
  const match = raw.trim().match(/^(>=|<=|>|<|=)?\s*(\d+)$/);
  if (!match) return null;
  return { op: match[1] || '=', value: Number(match[2]) };
}

function compare(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case '>':
      return actual > expected;
    case '<':
      return actual < expected;
    case '>=':
      return actual >= expected;
    case '<=':
      return actual <= expected;
    default:
      return actual === expected;
  }
}

/** Power/toughness are strings on purpose: `*` and `1+*` are real values and never numeric. */
function matchesStat(raw: string, value: string | undefined): boolean {
  const wanted = parseComparison(raw);
  if (!wanted) return true;
  const actual = Number(value);
  if (!Number.isFinite(actual)) return false;
  return compare(actual, wanted.op, wanted.value);
}

const textOf = (card: Card): string =>
  [card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const typeLineOf = (card: Card): string =>
  [card.type_line, ...(card.card_faces ?? []).map((face) => face.type_line)].filter(Boolean).join(' ').toLowerCase();

export function matchesFilters(card: Card, filters: SearchFilters): boolean {
  if (filters.rarity && card.rarity !== filters.rarity) return false;

  if (filters.colors.length > 0) {
    const cardColors = card.colors ?? card.color_identity ?? [];
    // Colorless is its own thing: it means "no colored mana", not "any of these colors".
    if (filters.colors.includes('C')) {
      if (cardColors.length > 0) return false;
    } else if (!filters.colors.some((color) => cardColors.includes(color))) {
      return false;
    }
  }

  if (filters.types.length > 0) {
    const line = typeLineOf(card);
    if (!filters.types.some((type) => line.includes(type.toLowerCase()))) return false;
  }

  if (filters.cmc) {
    const wanted = parseComparison(filters.cmc);
    if (wanted && !compare(Math.floor(card.cmc ?? 0), wanted.op, wanted.value)) return false;
  }

  const text = textOf(card);
  if (filters.text && !text.includes(filters.text.trim().toLowerCase())) return false;
  if (filters.excludeText && text.includes(filters.excludeText.trim().toLowerCase())) return false;
  if (filters.keyword && !text.includes(filters.keyword.trim().toLowerCase())) return false;

  if (filters.power && !matchesStat(filters.power, card.power)) return false;
  if (filters.toughness && !matchesStat(filters.toughness, card.toughness)) return false;

  return true;
}
