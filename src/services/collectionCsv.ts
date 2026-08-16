import { Card } from '../types/Card';
import { CollectionEntry } from '../types/Collection';
import { ScryfallCollectionResponse } from '../types/Scryfall';

/** A single decoded CSV line, before Scryfall resolution. */
export interface CollectionCsvRow {
  name: string;
  set?: string;
  collectorNumber?: string;
  quantity: number;
  wishlist: boolean;
  scryfallId?: string;
}

const HEADER = ['Name', 'Set', 'Collector Number', 'Quantity', 'Wishlist', 'Scryfall ID'];

/** Wraps a value in quotes and escapes embedded quotes when needed (RFC 4180). */
const escapeCsv = (value: string): string => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

/** Serializes owned/wishlisted entries to CSV text. Entries with quantity 0 and no wishlist are skipped. */
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

/** Splits one CSV line into fields, honoring quoted fields with embedded commas/quotes. */
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

/**
 * Splits CSV text into records. Not `text.split(/\r?\n/)`: `escapeCsv` quotes a value that
 * contains a newline, and cutting on every newline tore such a record into two malformed
 * ones — a file this module had just written did not survive its own round trip.
 */
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

/**
 * Parses collection CSV text into rows. Tolerant of an optional header, blank
 * lines, missing trailing columns and either `,`-separated column order shown
 * in {@link HEADER}. Rows without a name are dropped.
 */
export function parseCollectionCsv(text: string): CollectionCsvRow[] {
  const rows: CollectionCsvRow[] = [];

  for (const rawLine of splitCsvRecords(text)) {
    const line = rawLine.trim();
    if (!line) continue;

    const fields = parseCsvLine(line).map((field) => field.trim());
    // `parseCsvLine` always pushes at least one field, so there is no absent-name case
    // distinct from the empty one.
    const name = fields[0];
    if (!name) continue;
    // Skip the header row (matched case-insensitively on the first column).
    if (name.toLowerCase() === 'name') continue;

    const quantity = Math.max(0, Math.floor(Number(fields[3]) || 0));
    const wishlist = truthy.has((fields[4] ?? '').toLowerCase());
    // A row with neither owned copies nor a wishlist flag carries no information.
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

/** POSTs identifiers to Scryfall's collection endpoint in one chunk. */
const fetchChunk = async (identifiers: Array<Record<string, string>>): Promise<ScryfallCollectionResponse> => {
  const response = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers })
  });
  if (!response.ok) {
    if (response.status === 503 || response.status === 504) throw new Error('ScryfallOffline');
    if (response.status === 429) throw new Error('ScryfallRateLimited');
    throw new Error('Scryfall API error');
  }
  return (await response.json()) as ScryfallCollectionResponse;
};

export interface ResolvedCollectionCsv {
  entries: CollectionEntry[];
  missing: string[];
}

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

/**
 * Resolves parsed CSV rows into full {@link CollectionEntry} records by looking
 * up card data on Scryfall. Rows are matched back to results by id, then by
 * set+number, then by name. Unresolved names are returned in `missing`.
 */
export async function resolveCollectionCsvRows(rows: CollectionCsvRow[]): Promise<ResolvedCollectionCsv> {
  const resolved: Card[] = [];

  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    const json = await fetchChunk(chunk.map(buildIdentifier));
    if (Array.isArray(json.data)) resolved.push(...json.data);
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

  for (const row of rows) {
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

  return { entries, missing: Array.from(new Set(missing)) };
}
