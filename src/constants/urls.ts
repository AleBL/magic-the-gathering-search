/**
 * Every external host the app talks to, in one place.
 *
 * The endpoints were spelled out at each call site, so the same base URL appeared in a
 * dozen files: a host change (or a proxy in front of Scryfall) meant hunting for string
 * literals across services, hooks and components, and a typo in one of them only showed
 * up at runtime.
 */

const SCRYFALL_API_BASE = 'https://api.scryfall.com';

/** Scryfall's REST endpoints. Query strings belong to the caller; these are just the paths. */
export const SCRYFALL_API = {
  cardsSearch: `${SCRYFALL_API_BASE}/cards/search`,
  cardsCollection: `${SCRYFALL_API_BASE}/cards/collection`,
  cardsNamed: `${SCRYFALL_API_BASE}/cards/named`,
  symbology: `${SCRYFALL_API_BASE}/symbology`
} as const;

/** The printing identified by set and collector number, in one language. */
export const scryfallPrintingUrl = (set: string, collectorNumber: string, lang = 'en'): string =>
  `${SCRYFALL_API_BASE}/cards/${set}/${collectorNumber}/${lang}`;

/** `/cards/named` with the exact name, the lookup used when only a name is known. */
export const scryfallNamedExactUrl = (name: string): string =>
  `${SCRYFALL_API.cardsNamed}?exact=${encodeURIComponent(name)}`;

/** `/cards/named` asking for the image itself rather than the card JSON. */
export const scryfallNamedImageUrl = (name: string): string => `${scryfallNamedExactUrl(name)}&format=image`;

/**
 * `/cards/search` for a Scryfall query string, plus any extra query parameters
 * (`order`, `unique`...). Percent-encoded rather than built with `URLSearchParams`,
 * which would encode the spaces in a Scryfall query as `+`.
 */
export const scryfallSearchUrl = (query: string, params: Record<string, string> = {}): string => {
  const extra = Object.entries(params)
    .map(([key, value]) => `&${key}=${encodeURIComponent(value)}`)
    .join('');
  return `${SCRYFALL_API.cardsSearch}?q=${encodeURIComponent(query)}${extra}`;
};

/** The mana/card symbol SVGs, keyed by the symbol's own name (`t`, `w`, `2/u`...). */
export const scryfallSymbolSvgUrl = (symbol: string): string => `https://svgs.scryfall.io/card-symbols/${symbol}.svg`;

/**
 * Gatherer's card image, the only art source for printings Scryfall has no image for.
 * Keyed by multiverse id, which not every printing has.
 */
export const gathererImageUrl = (multiverseId: number): string =>
  `https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=${multiverseId}&type=card`;

/** Favicons for the outbound links on a card's detail panel. */
export const SCRYFALL_FAVICON_URL = 'https://scryfall.com/favicon.ico';
export const GATHERER_FAVICON_URL = 'https://gatherer.wizards.com/favicon.ico';
