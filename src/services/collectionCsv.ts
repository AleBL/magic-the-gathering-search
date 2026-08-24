import { Card } from '../types/Card';
import { CollectionEntry } from '../types/Collection';
import { ScryfallCollectionResponse } from '../types/Scryfall';
import { SCRYFALL_API } from '../constants/urls';

export interface CollectionCsvRow {
  name: string;
  set?: string;
  collectorNumber?: string;
  quantity: number;
  wishlist: boolean;
  scryfallId?: string;
}

const HEADER = ['Name', 'Set', 'Collector Number', 'Quantity', 'Wishlist', 'Scryfall ID'];

/** RFC 4180 quoting. */
const escapeCsv = (value: string): string => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export function serializeCollectionCsv(entries: CollectionEntry[]): string {
  const lines = [HEADER.join(',')];
  for (const entry of entries) {
    if (entry.quantity <= 0 && !entry.wishlist) continue;
    lines.push(
      [
        escapeCsv(entry.name),
        escapeCsv(entry.set ?? ''),
        escapeCsv(entry.card.collector_number ?? ''),
        String(entry.quantity),
        entry.wishlist ? 'true' : 'false',
        escapeCsv(entry.id)
      ].join(',')
    );
  }
  return lines.join('\n');
}

const parseCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
};

// Not `text.split(/\r?\n/)`: `escapeCsv` quotes a value containing a newline, and cutting on
// every newline tore such a record in two. A file this module had just written did not
// survive its own round trip.
const splitCsvRecords = (text: string): string[] => {
  const records: string[] = [];
  let record = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      // A doubled quote inside a quoted field is an escaped quote, not the end of it.
      if (inQuotes && text[i + 1] === '"') {
        record += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      record += char;
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      // CRLF ends one record, not two.
      if (char === '\r' && text[i + 1] === '\n') i++;
      records.push(record);
      record = '';
    } else {
      record += char;
    }
  }

  records.push(record);
  return records;
};

const truthy = new Set(['true', '1', 'yes', 'y', 'x']);

/** Tolerates an optional header, blank lines and missing trailing columns; column order is {@link HEADER}. */
export function parseCollectionCsv(text: string): CollectionCsvRow[] {
  const rows: CollectionCsvRow[] = [];

  for (const rawLine of splitCsvRecords(text)) {
    const line = rawLine.trim();
    if (!line) continue;

    const fields = parseCsvLine(line).map((field) => field.trim());
    const name = fields[0];
    if (!name) continue;
    if (name.toLowerCase() === 'name') continue;

    const quantity = Math.max(0, Math.floor(Number(fields[3]) || 0));
    const wishlist = truthy.has((fields[4] ?? '').toLowerCase());
    // Neither owned copies nor a wishlist flag: the row says nothing worth importing.
    if (quantity === 0 && !wishlist) continue;

    rows.push({
      name,
      set: fields[1] || undefined,
      collectorNumber: fields[2] || undefined,
      quantity,
      wishlist,
      scryfallId: fields[5] || undefined
    });
  }

  return rows;
}

const CHUNK_SIZE = 75;

// Scryfall asks for 50 to 100 ms between requests. Unpaced, this loop measured ~107 requests
// per second (134 chunks in 1,25 s for a 10k-row file): not a borderline case of their rate
// limit, a collision. 150 ms leaves room for a slow hop and still imports 10k rows in ~20 s.
const CHUNK_DELAY_MS = 150;
const RETRY_BASE_MS = 1000;
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Carries Scryfall's own `Retry-After` when it sends one, so the backoff obeys the server. */
interface ChunkError extends Error {
  retryAfterMs?: number;
}

const fetchChunk = async (identifiers: Array<Record<string, string>>): Promise<ScryfallCollectionResponse> => {
  const response = await fetch(SCRYFALL_API.cardsCollection, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers })
  });
  if (!response.ok) {
    if (response.status === 503 || response.status === 504) throw new Error('ScryfallOffline');
    if (response.status === 429) {
      const error: ChunkError = new Error('ScryfallRateLimited');
      const header = Number(response.headers?.get?.('Retry-After'));
      if (Number.isFinite(header) && header > 0) error.retryAfterMs = header * 1000;
      throw error;
    }
    throw new Error('Scryfall API error');
  }
  return (await response.json()) as ScryfallCollectionResponse;
};

/** Printings the collection already holds, so their rows never reach the network. */
export interface KnownPrintings {
  ids: Set<string>;
  /** `set|collector_number`, lowercased, for rows that carry no id. */
  setNumbers: Set<string>;
}

export interface ResolveCollectionCsvOptions {
  known?: KnownPrintings;
  onProgress?: (progress: { done: number; total: number }) => void;
  /** Pacing knobs. Tests set them to zero; nothing in the app overrides them. */
  chunkDelayMs?: number;
  retryBaseMs?: number;
  maxAttempts?: number;
}

export interface ResolvedCollectionCsv {
  entries: CollectionEntry[];
  missing: string[];
  /** Rows the collection already had, skipped without a request and without a write. */
  skipped: number;
  /** Rows never asked about, because the run stopped at a failing chunk. */
  unreached: number;
  failure: 'offline' | 'rateLimited' | 'error' | null;
}

const classifyFailure = (error: unknown): 'offline' | 'rateLimited' | 'error' => {
  if (error instanceof Error && error.message === 'ScryfallOffline') return 'offline';
  if (error instanceof Error && error.message === 'ScryfallRateLimited') return 'rateLimited';
  return 'error';
};

/**
 * One chunk, retried on the two statuses that mean "ask again later". A 400 or a 404 is an
 * answer about the identifiers and retrying it just doubles the load.
 */
const fetchChunkWithRetry = async (
  identifiers: Array<Record<string, string>>,
  maxAttempts: number,
  retryBaseMs: number
): Promise<ScryfallCollectionResponse> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchChunk(identifiers);
    } catch (error) {
      const kind = classifyFailure(error);
      if (kind === 'error' || attempt >= maxAttempts) throw error;
      const suggested = (error as ChunkError).retryAfterMs;
      await sleep(suggested ?? retryBaseMs * 2 ** (attempt - 1));
    }
  }
};

// Skipping these rows is what makes a failed import resumable: `mergeEntries` *sums*
// quantities, so re-importing the same file would double every copy that had already landed.
// Only a row naming a specific printing counts as known, because a name-only row may be a
// different edition of a card already owned and skipping it would drop it silently.
const isAlreadyOwned = (row: CollectionCsvRow, known: KnownPrintings): boolean => {
  if (row.scryfallId && known.ids.has(row.scryfallId)) return true;
  if (row.set && row.collectorNumber) {
    return known.setNumbers.has(`${row.set.toLowerCase()}|${row.collectorNumber.toLowerCase()}`);
  }
  return false;
};

const buildIdentifier = (row: CollectionCsvRow): Record<string, string> => {
  if (row.scryfallId) return { id: row.scryfallId };
  if (row.set && row.collectorNumber) return { set: row.set.toLowerCase(), collector_number: row.collectorNumber };
  if (row.set) return { name: row.name, set: row.set.toLowerCase() };
  return { name: row.name };
};

const toEntry = (card: Card, row: CollectionCsvRow): CollectionEntry => ({
  id: card.id,
  oracleId: card.oracle_id,
  name: card.name,
  set: card.set,
  rarity: card.rarity,
  quantity: row.quantity,
  wishlist: row.wishlist,
  card,
  updatedAt: new Date().toISOString()
});

// Rows are matched back to Scryfall results by id, then set+number, then name.
export async function resolveCollectionCsvRows(
  rows: CollectionCsvRow[],
  options: ResolveCollectionCsvOptions = {}
): Promise<ResolvedCollectionCsv> {
  const {
    known,
    onProgress,
    chunkDelayMs = CHUNK_DELAY_MS,
    retryBaseMs = RETRY_BASE_MS,
    maxAttempts = MAX_ATTEMPTS
  } = options;

  const pending = known ? rows.filter((row) => !isAlreadyOwned(row, known)) : rows;
  const skipped = rows.length - pending.length;

  const resolved: Card[] = [];
  let failure: ResolvedCollectionCsv['failure'] = null;
  let unreached = 0;
  let done = skipped;
  onProgress?.({ done, total: rows.length });

  for (let start = 0; start < pending.length; start += CHUNK_SIZE) {
    // Between chunks, never before the first: the pause is there to space requests out, and
    // one request needs no spacing.
    if (start > 0 && chunkDelayMs > 0) await sleep(chunkDelayMs);

    const chunk = pending.slice(start, start + CHUNK_SIZE);
    try {
      const json = await fetchChunkWithRetry(chunk.map(buildIdentifier), maxAttempts, retryBaseMs);
      if (Array.isArray(json.data)) resolved.push(...json.data);
    } catch (error) {
      // Stop here. Retrying the remaining chunks against a wall that just refused three
      // attempts turns one failure into hundreds of requests, and the user waits for all of
      // them to fail. What resolved so far is kept and reported.
      failure = classifyFailure(error);
      unreached = pending.length - start;
      break;
    }

    done += chunk.length;
    onProgress?.({ done, total: rows.length });
  }

  const byId = new Map<string, Card>();
  const bySetNumber = new Map<string, Card>();
  const byName = new Map<string, Card>();
  for (const card of resolved) {
    byId.set(card.id, card);
    if (card.set && card.collector_number) {
      bySetNumber.set(`${card.set.toLowerCase()}|${card.collector_number.toLowerCase()}`, card);
    }
    if (card.name) byName.set(card.name.toLowerCase(), card);
  }

  const entries: CollectionEntry[] = [];
  const missing: string[] = [];

  // Only rows that were actually asked about. A row in an unreached chunk is not missing from
  // Scryfall, it is missing an answer, and reporting it as "could not be found" would blame
  // the file for a network failure.
  for (const row of pending.slice(0, pending.length - unreached)) {
    let card: Card | undefined;
    if (row.scryfallId) card = byId.get(row.scryfallId);
    if (!card && row.set && row.collectorNumber) {
      card = bySetNumber.get(`${row.set.toLowerCase()}|${row.collectorNumber.toLowerCase()}`);
    }
    if (!card) card = byName.get(row.name.toLowerCase());

    if (card) {
      entries.push(toEntry(card, row));
    } else {
      missing.push(row.name);
    }
  }

  return { entries, missing: Array.from(new Set(missing)), skipped, unreached, failure };
}
