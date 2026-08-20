import { Card } from '../types/Card';
import { Deck } from '../types/Deck';
import { DeckZone } from '../types/enums';
import { ScryfallNotFoundIdentifier } from '../types/Scryfall';
import { translateCards } from '../utils/translationHelper';
import { newId } from '../utils/id';
import { readField, toCardList, toImportedDeck, toNotFoundIdentifiers } from '../utils/typeGuards';

const MAX_RATE_LIMIT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5000;

// Scryfall asks for 50 to 100 ms between requests. 150 leaves room for a slow hop, matching
// the collection CSV import (see services/collectionCsv.ts).
const SCRYFALL_REQUEST_GAP_MS = 150;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * How long to wait after a 429. `headers.get` returns `null` for an absent header and
 * `Number(null)` is `0`, which is finite: reading the header without the `> 0` test accepted
 * that zero and retried instantly, so the fallback below never applied to the case it exists
 * for. Exported because that is the whole bug, and it is worth pinning in one assertion.
 */
export function retryDelayFor(header: string | null, fallbackMs: number = DEFAULT_RETRY_DELAY_MS): number {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallbackMs;
  return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
}

/**
 * Spaces out every Scryfall request one import makes. All three loops below (the chunked
 * lookups, the not-found retry pass and the per-name localized lookups) share one clock, so
 * none of them has to remember to pace itself and the gaps hold across the boundaries between
 * them. Per import rather than per module: a run never waits on the previous one's clock, and
 * tests stay independent of each other.
 */
interface RequestPacer {
  gapMs: number;
  retryDelayMs: number;
  nextAllowedAt: number;
}

/** Pacing knobs. Tests set them to zero; nothing in the app overrides them. */
export interface ImportPacingOptions {
  requestGapMs?: number;
  retryDelayMs?: number;
}

const createPacer = ({
  requestGapMs = SCRYFALL_REQUEST_GAP_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS
}: ImportPacingOptions = {}): RequestPacer => ({
  gapMs: requestGapMs,
  retryDelayMs,
  nextAllowedAt: 0
});

// The clock is stamped before the request, not after it: the calls are sequential, so a
// request that itself took longer than the gap has already provided the spacing and adding
// another pause on top of it would only make a slow import slower.
const pacedFetch = async (pacer: RequestPacer, url: string, init?: RequestInit): Promise<Response> => {
  const waitMs = pacer.nextAllowedAt - Date.now();
  if (waitMs > 0) await sleep(waitMs);
  pacer.nextAllowedAt = Date.now() + pacer.gapMs;
  return fetch(url, init);
};

/** POSTs to Scryfall's collection endpoint, retrying lightly on 429 (rate limit) before giving up. */
const fetchCollectionWithRetry = async (
  identifiers: Array<{ name?: string; set?: string; collector_number?: string }>,
  pacer: RequestPacer
): Promise<Response> => {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await pacedFetch(pacer, 'https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers })
    });

    if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) {
      return response;
    }

    await sleep(retryDelayFor(response.headers.get('Retry-After'), pacer.retryDelayMs));
  }

  // Unreachable: the loop always returns within MAX_RATE_LIMIT_RETRIES + 1 iterations.
  throw new Error('ScryfallRateLimited');
};

/**
 * Reads an exported `.json` deck file. Accepts both shapes the app writes: a single deck,
 * and the array produced by "export all decks" — which was previously rejected on import,
 * so those files could be written but never read back.
 *
 * Ids are reissued so importing never overwrites a deck already in the profile. Returns
 * null if any entry is malformed: a file that half-imports is worse than one that refuses.
 */
export const parseDeckJson = (content: string): Deck[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  if (candidates.length === 0) return null;

  return candidates.reduce<Deck[] | null>((decks, candidate) => {
    if (!decks) return null;
    const deck = toImportedDeck(candidate);
    if (!deck) return null;
    decks.push({ ...deck, id: newId() });
    return decks;
  }, []);
};

export interface ParseResult {
  name: string;
  quantity: number;
  set?: string;
  collector_number?: string;
  /** Optional deck zone to assign the resolved copies to (share imports set this). */
  zone?: DeckZone;
  /** Optional commander flag carried through from share imports. */
  isCommander?: boolean;
}

/**
 * Section labels emitted by MTG Arena / MTGO exports (any UI language). They
 * carry no quantity, so without this list they would be parsed as card names.
 * Entries must already be lowercase and accent-stripped — they are compared
 * against `normalizeHeader` output (e.g. "Compañero" arrives as "companero").
 */
const SECTION_HEADERS = new Set([
  'deck',
  'commander',
  'comandante',
  'mazo',
  'sideboard',
  'reserva',
  'banquillo',
  'companion',
  'companheiro',
  'companero',
  'maybeboard',
  'tokens',
  'fichas',
  'about'
]);

const normalizeHeader = (value: string): string =>
  value
    .replace(/:$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const parseDeckText = (text: string): ParseResult[] => {
  const lines = text.split('\n');
  const parsedCards: ParseResult[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('//')) continue;

    const match = line.match(/^(\d+)[xX]?\s+(.+)$/) || line.match(/^([xX]\d+)\s+(.+)$/);
    let qty = 1;
    let cardName = line;

    // A line with no quantity that is a known section label is structure, not a card.
    if (!match && SECTION_HEADERS.has(normalizeHeader(line))) continue;

    if (match) {
      qty = parseInt(match[1].replace(/[xX]/g, ''), 10) || 1;
      cardName = match[2].trim();
    }

    // .dec exports tag copies with markers like *F* (foil) or *CM* (commander).
    cardName = cardName.replace(/\s*\*[a-zA-Z0-9]+\*\s*$/, '').trim();

    let setCode: string | undefined;
    let collectorNumber: string | undefined;

    // "(M10) 1", "[M10] 1" and "(PLST) WOC-166" are all in the wild.
    const setMatch = cardName.match(/\s*[([]([A-Za-z0-9]{3,5})[)\]]\s*([A-Za-z0-9-]*)$/);
    if (setMatch) {
      setCode = setMatch[1].toLowerCase();
      if (setMatch[2]) collectorNumber = setMatch[2];
    } else {
      const setMatch2 = cardName.match(/\s+([A-Za-z0-9]{3,5})\s+(\d+[a-zA-Z]?)$/);
      if (setMatch2) {
        setCode = setMatch2[1].toLowerCase();
        collectorNumber = setMatch2[2];
      }
    }

    cardName = cardName.replace(/\s*[([][A-Za-z0-9]{3,5}[)\]]\s*[A-Za-z0-9-]*$/, '').trim();
    cardName = cardName.replace(/\s+[A-Za-z0-9]{3,5}\s+\d+[a-zA-Z]?$/, '').trim();

    if (cardName) {
      parsedCards.push({ name: cardName, quantity: qty, set: setCode, collector_number: collectorNumber });
    }
  }
  return parsedCards;
};

export interface ImportProgressData {
  isImporting: boolean;
  current: number;
  total: number;
  message: string;
}

/** Cap on extra per-name lookups so a malformed list can't fan out unbounded. */
const LOCALIZED_LOOKUP_LIMIT = 40;

// Scryfall's /cards/collection `name` identifier matches English names only, so a deck
// exported from Arena in pt never resolves there. The search endpoint does match localized
// printed names, which is why the stragglers get a second pass through it.
const resolveLocalizedName = async (name: string, lang: string, pacer: RequestPacer): Promise<Card | null> => {
  const queries = lang && lang !== 'en' ? [`!"${name}" lang:${lang}`, `"${name}" lang:${lang}`] : [`!"${name}"`];

  for (const query of queries) {
    try {
      const res = await pacedFetch(
        pacer,
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`
      );
      if (!res.ok) continue;
      const cards = toCardList(readField(await res.json(), 'data'));
      if (cards.length > 0) return cards[0];
    } catch {
      // Fall through to the next, less strict query.
    }
  }
  return null;
};

export const fetchCardsFromParsedList = async (
  parsed: ParseResult[],
  currentLang: string = 'en',
  onProgress?: (progress: ImportProgressData) => void,
  t?: (key: string, options?: Record<string, unknown>) => string,
  pacing?: ImportPacingOptions
): Promise<{ cards: Card[]; missing: string[] }> => {
  const pacer = createPacer(pacing);
  const uniqueParsed = Array.from(
    new Map(parsed.map((p) => [`${p.name}|${p.set || ''}|${p.collector_number || ''}`, p])).values()
  );

  const allResolvedCards: Card[] = [];
  const initialNotFound: ScryfallNotFoundIdentifier[] = [];
  const CHUNK_SIZE = 75;

  for (let chunkStartIndex = 0; chunkStartIndex < uniqueParsed.length; chunkStartIndex += CHUNK_SIZE) {
    const chunk = uniqueParsed.slice(chunkStartIndex, chunkStartIndex + CHUNK_SIZE);

    if (onProgress) {
      onProgress({
        isImporting: true,
        current: chunkStartIndex,
        total: uniqueParsed.length,
        message: t ? t('deck.importingCardsProgress', { current: chunkStartIndex, total: uniqueParsed.length }) : ''
      });
    }

    const identifiers = chunk.map((item) => {
      if (item.set && item.collector_number) {
        return { set: item.set, collector_number: item.collector_number };
      }
      if (item.set) {
        return { name: item.name, set: item.set };
      }
      return { name: item.name };
    });

    const response = await fetchCollectionWithRetry(identifiers, pacer);

    if (!response.ok) {
      if (response.status === 503 || response.status === 504) {
        throw new Error('ScryfallOffline');
      }
      if (response.status === 429) {
        throw new Error('ScryfallRateLimited');
      }
      throw new Error('Scryfall API error');
    }

    const json: unknown = await response.json();
    allResolvedCards.push(...toCardList(readField(json, 'data')));
    initialNotFound.push(...toNotFoundIdentifiers(readField(json, 'not_found')));
  }

  // Second pass on name alone: a printing this profile asked for by set and collector number
  // may simply not exist, while the card does.
  if (initialNotFound.length > 0) {
    if (onProgress) {
      onProgress({
        isImporting: true,
        current: uniqueParsed.length,
        total: uniqueParsed.length,
        message: t ? t('deck.importingAlternativesProgress', { count: initialNotFound.length }) : ''
      });
    }

    const retryIdentifiers = initialNotFound
      .map((nf: ScryfallNotFoundIdentifier) => {
        let originalName = '';
        if (nf.set && nf.collector_number) {
          const found = uniqueParsed.find((p) => p.set == nf.set && p.collector_number == nf.collector_number);
          if (found) originalName = found.name;
        }
        if (!originalName && nf.set && nf.name) {
          const found = uniqueParsed.find((p) => p.set == nf.set && p.name == nf.name);
          if (found) originalName = found.name;
        }
        if (!originalName && nf.name) {
          originalName = nf.name;
        }

        if (!originalName) return null;

        // A double-faced card resolves by its front face far more often than by "Front // Back".
        let frontFace = originalName.split(/\s+\/?\/?\s+/)[0].trim();

        frontFace = frontFace.replace(/\s*[([].*$/, '').trim();

        return { name: frontFace };
      })
      .filter(Boolean) as { name: string }[];

    const uniqueRetries = Array.from(new Map(retryIdentifiers.map((r) => [r.name, r])).values());

    for (let chunkStartIndex = 0; chunkStartIndex < uniqueRetries.length; chunkStartIndex += CHUNK_SIZE) {
      const chunk = uniqueRetries.slice(chunkStartIndex, chunkStartIndex + CHUNK_SIZE);

      const response = await fetchCollectionWithRetry(chunk, pacer);

      if (response.ok) {
        allResolvedCards.push(...toCardList(readField(await response.json(), 'data')));
      }
    }
  }

  // Whatever /cards/collection still could not resolve is usually a localized name.
  const resolvedNames = new Set<string>();
  for (const card of allResolvedCards) {
    if (card.name) resolvedNames.add(card.name.toLowerCase());
    if (card.printed_name) resolvedNames.add(card.printed_name.toLowerCase());
  }

  const unresolved = uniqueParsed.filter((item) => !resolvedNames.has(item.name.toLowerCase()));
  if (unresolved.length > 0) {
    const lang = (currentLang || 'en').split('-')[0].toLowerCase();
    for (const item of unresolved.slice(0, LOCALIZED_LOOKUP_LIMIT)) {
      const localized = await resolveLocalizedName(item.name, lang, pacer);
      if (localized) allResolvedCards.push(localized);
    }
  }

  if (allResolvedCards.length === 0) {
    throw new Error('No cards found');
  }

  let translatedCardsList = allResolvedCards;
  if (currentLang !== 'en') {
    if (onProgress) {
      onProgress({
        isImporting: true,
        current: uniqueParsed.length,
        total: uniqueParsed.length,
        message: t ? t('deck.translatingCards') : 'Traduzindo cartas...'
      });
    }
    translatedCardsList = await translateCards(allResolvedCards, currentLang);
  }

  const exactLookup = new Map<string, Card>();
  const nameLookup = new Map<string, Card>();

  allResolvedCards.forEach((originalCard, index) => {
    const translatedCard = translatedCardsList[index] || originalCard;
    if (originalCard.set && originalCard.collector_number) {
      exactLookup.set(
        `${originalCard.set.toLowerCase()}|${originalCard.collector_number.toLowerCase()}`,
        translatedCard
      );
    }
    if (originalCard.name) {
      nameLookup.set(originalCard.name.toLowerCase(), translatedCard);
      const namePart = originalCard.name.split('//')[0].trim().toLowerCase();
      nameLookup.set(namePart, translatedCard);
      // Some exports write a double-faced card as "Front / Back" instead of "Front // Back".
      if (originalCard.name.includes('//')) {
        const singleSlashName = originalCard.name.replace('//', '/').toLowerCase();
        nameLookup.set(singleSlashName, translatedCard);
      }
    }
    if (originalCard.printed_name) nameLookup.set(originalCard.printed_name.toLowerCase(), translatedCard);
  });

  const finalCards: Card[] = [];
  const missingNames: string[] = [];

  parsed.forEach((item) => {
    const normalizedName = item.name.toLowerCase();
    let foundCard: Card | undefined;

    if (item.set && item.collector_number) {
      foundCard = exactLookup.get(`${item.set.toLowerCase()}|${item.collector_number.toLowerCase()}`);
    }

    if (!foundCard) {
      foundCard = nameLookup.get(normalizedName);
    }

    if (!foundCard && normalizedName.includes('/')) {
      const frontFace = normalizedName.split(/\s+\/?\/?\s+/)[0].trim();
      foundCard = nameLookup.get(frontFace);
    }

    if (foundCard) {
      for (let copyIndex = 0; copyIndex < item.quantity; copyIndex++) {
        // Each copy is its own deck entry and needs its own id; the printing's id stays as a
        // prefix so the origin of the entry remains readable.
        const copy: Card = { ...foundCard, id: `${foundCard.id}-${newId()}` };
        if (item.zone) copy.zone = item.zone;
        if (item.isCommander) copy.isCommander = true;
        finalCards.push(copy);
      }
    } else {
      missingNames.push(item.name);
    }
  });

  return { cards: finalCards, missing: Array.from(new Set(missingNames)) };
};
