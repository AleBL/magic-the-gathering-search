import { SearchFilters } from '../types';

/**
 * Turns the filter panel into Scryfall query terms.
 *
 * Derived on purpose: "are any filters active?" is `buildFilterTerms(...).length > 0`, so
 * adding a field here cannot be forgotten in a hand-maintained list somewhere else. It was
 * two such lists — one deciding whether to fall back to the default query, one driving the
 * "clear" button — and a field missing from either is a filter that silently does nothing.
 */

/** Scryfall treats an unquoted space as a second search term, so phrases must be quoted. */
const quotePhrase = (value: string): string => {
  const clean = value.trim().replace(/"/g, '');
  return /\s/.test(clean) ? `"${clean}"` : clean;
};

/**
 * Both operators, because neither alone is enough — verified against the API on
 * 2026-08-06:
 * - `fo:` covers the reminder text in brackets, which `o:` skips (`fo:flying lang:en`
 *   finds 4,704 cards against `o:`'s 4,574) but it only ever matches **English**:
 *   `fo:voar lang:pt` finds nothing.
 * - `o:` combined with the `lang:` the app always appends *does* match translated text:
 *   `o:voar lang:pt` finds 3,145.
 *
 * The union gives both, and negates correctly as `-(...)`.
 */
const oracleMatch = (value: string): string => {
  const phrase = quotePhrase(value);
  return `(o:${phrase} or fo:${phrase})`;
};

/** `4` → `pow=4`, `>=4` → `pow>=4`. Returns null for anything that is not a comparison. */
export const buildComparison = (field: string, raw: string): string | null => {
  const match = raw.trim().match(/^(>=|<=|>|<|=)?\s*([\d*]+)$/);
  if (!match) return null;
  return `${field}${match[1] ?? '='}${match[2]}`;
};

export function buildFilterTerms(filters: SearchFilters): string[] {
  const terms: string[] = [];

  if (filters.colors.length > 0) {
    // 'C' (colorless) is Scryfall's dedicated colorless keyword, not a color letter to
    // combine with WUBRG — useSearchFilters keeps the two mutually exclusive, so seeing
    // 'C' here means it is the only entry.
    terms.push(filters.colors.includes('C') ? 'c:c' : `c:${filters.colors.join('')}`);
  }
  if (filters.types.length > 0) terms.push(`t:${filters.types.join(' ')}`);
  if (filters.rarity) terms.push(`r:${filters.rarity}`);
  if (filters.cmc.trim()) terms.push(`cmc=${filters.cmc.trim()}`);

  if (filters.text.trim()) terms.push(oracleMatch(filters.text));
  if (filters.excludeText.trim()) terms.push(`-${oracleMatch(filters.excludeText)}`);
  if (filters.keyword) terms.push(`kw:${quotePhrase(filters.keyword)}`);
  if (filters.oracleTag) terms.push(`otag:${filters.oracleTag}`);

  const power = buildComparison('pow', filters.power);
  if (power) terms.push(power);
  const toughness = buildComparison('tou', filters.toughness);
  if (toughness) terms.push(toughness);

  return terms;
}

export const hasActiveFilters = (filters: SearchFilters): boolean => buildFilterTerms(filters).length > 0;
