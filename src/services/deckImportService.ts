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

/** POSTs to Scryfall's collection endpoint, retrying lightly on 429 (rate limit) before giving up. */
const fetchCollectionWithRetry = async (
  identifiers: Array<{ name?: string; set?: string; collector_number?: string }>
): Promise<Response> => {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers })
    });

    if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) {
      return response;
    }

    const retryAfterHeader = Number(response.headers.get('Retry-After'));
    const delayMs = Number.isFinite(retryAfterHeader)
      ? Math.min(retryAfterHeader * 1000, MAX_RETRY_DELAY_MS)
      : DEFAULT_RETRY_DELAY_MS;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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

/** Lowercases and strips accents/trailing colon so headers match across languages. */
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

    // Sometimes .dec or formats include tags like *F* or *CM* or *E*. Remove those too.
    cardName = cardName.replace(/\s*\*[a-zA-Z0-9]+\*\s*$/, '').trim();

    let setCode: string | undefined;
    let collectorNumber: string | undefined;

    // Extract set and collector number e.g. "(M10) 1" or "[M10] 1" or "(PLST) WOC-166"
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

    // Remove collector number / set code from the end of the card name
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

/**
 * Scryfall's /cards/collection `name` identifier only matches English names, so
 * a deck exported in another language (e.g. Arena in pt) never resolves there.
 * The search endpoint does match localized printed names, so retry stragglers.
 */
const resolveLocalizedName = async (name: string, lang: string): Promise<Card | null> => {
  const queries = lang && lang !== 'en' ? [`!"${name}" lang:${lang}`, `"${name}" lang:${lang}`] : [`!"${name}"`];

  for (const query of queries) {
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`);
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
  t?: (key: string, options?: Record<string, unknown>) => string
): Promise<{ cards: Card[]; missing: string[] }> => {
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

    const response = await fetchCollectionWithRetry(identifiers);

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

  // Retry logic for not_found items, stripping set and collector_number, just use name
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

        // For DFCs, sending just the front face is more reliable
        let frontFace = originalName.split(/\s+\/?\/?\s+/)[0].trim();

        // Aggressive fallback cleanup for names that STILL have set info attached
        frontFace = frontFace.replace(/\s*[([].*$/, '').trim();

        return { name: frontFace };
      })
      .filter(Boolean) as { name: string }[];

    // Unique retries to avoid duplicate name lookups
    const uniqueRetries = Array.from(new Map(retryIdentifiers.map((r) => [r.name, r])).values());

    for (let chunkStartIndex = 0; chunkStartIndex < uniqueRetries.length; chunkStartIndex += CHUNK_SIZE) {
      const chunk = uniqueRetries.slice(chunkStartIndex, chunkStartIndex + CHUNK_SIZE);

      const response = await fetchCollectionWithRetry(chunk);

      if (response.ok) {
        allResolvedCards.push(...toCardList(readField(await response.json(), 'data')));
      }
    }
  }

  // Whatever /cards/collection still could not resolve is usually a localized
  // name. Retry those through search before giving up on them.
  const resolvedNames = new Set<string>();
  for (const card of allResolvedCards) {
    if (card.name) resolvedNames.add(card.name.toLowerCase());
    if (card.printed_name) resolvedNames.add(card.printed_name.toLowerCase());
  }

  const unresolved = uniqueParsed.filter((item) => !resolvedNames.has(item.name.toLowerCase()));
  if (unresolved.length > 0) {
    const lang = (currentLang || 'en').split('-')[0].toLowerCase();
    for (const item of unresolved.slice(0, LOCALIZED_LOOKUP_LIMIT)) {
      const localized = await resolveLocalizedName(item.name, lang);
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
      // Also index single slash if it's a DFC
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

    // Additional fallback for DFC names in input like "Front / Back"
    if (!foundCard && normalizedName.includes('/')) {
      const frontFace = normalizedName.split(/\s+\/?\/?\s+/)[0].trim();
      foundCard = nameLookup.get(frontFace);
    }

    if (foundCard) {
      for (let copyIndex = 0; copyIndex < item.quantity; copyIndex++) {
        // Each copy is its own deck entry, so it needs an id of its own; the printing's
        // id stays as a prefix so the origin of the entry remains readable.
        const copy: Card = { ...foundCard, id: `${foundCard.id}-${newId()}` };
        // Preserve zone / commander status when the source (e.g. a share link) carries it.
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
