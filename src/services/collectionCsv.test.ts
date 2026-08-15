import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeCard } from '../test/factories';
import { CollectionEntry } from '../types/Collection';
import {
  CollectionCsvRow,
  parseCollectionCsv,
  resolveCollectionCsvRows,
  serializeCollectionCsv
} from './collectionCsv';

const entry = (overrides: Partial<CollectionEntry> = {}): CollectionEntry => {
  const card = makeCard({ name: 'Sol Ring', set: 'c21', collector_number: '263', ...overrides.card });
  return {
    id: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    set: card.set,
    rarity: card.rarity,
    quantity: 1,
    wishlist: false,
    card,
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides
  };
};

describe('serializeCollectionCsv', () => {
  it('writes a header and one row per owned/wishlisted entry', () => {
    const csv = serializeCollectionCsv([entry({ quantity: 2 })]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Set,Collector Number,Quantity,Wishlist,Scryfall ID');
    expect(lines[1]).toContain('Sol Ring');
    expect(lines[1]).toContain('c21');
    expect(lines[1]).toContain('263');
    expect(lines[1]).toContain('2');
  });

  it('quotes names containing commas', () => {
    const card = makeCard({ name: 'Kytheon, Hero of Akros', set: 'ori', collector_number: '23' });
    const csv = serializeCollectionCsv([entry({ card, name: card.name, quantity: 1 })]);
    expect(csv.split('\n')[1]).toContain('"Kytheon, Hero of Akros"');
  });

  it('skips entries with no copies and no wishlist flag', () => {
    const csv = serializeCollectionCsv([entry({ quantity: 0, wishlist: false })]);
    expect(csv.split('\n')).toHaveLength(1); // header only
  });

  it('keeps a wishlisted entry that has no owned copies', () => {
    const csv = serializeCollectionCsv([entry({ quantity: 0, wishlist: true })]);
    const row = csv.split('\n')[1];
    expect(row).toContain('Sol Ring');
    expect(row).toContain(',0,true,');
  });

  it('writes empty set and collector number when the entry has neither', () => {
    const card = makeCard({ name: 'Nameless Printing', collector_number: undefined });
    const csv = serializeCollectionCsv([entry({ card, name: card.name, set: undefined, quantity: 1 })]);
    expect(csv.split('\n')[1]).toBe(`Nameless Printing,,,1,false,${card.id}`);
  });

  it('doubles embedded quotes and quotes fields containing newlines', () => {
    const card = makeCard({ name: 'Say "Hi"\nTwice', set: 'tst', collector_number: '1' });
    const csv = serializeCollectionCsv([entry({ card, name: card.name, quantity: 1 })]);
    expect(csv).toContain('"Say ""Hi""\nTwice"');
  });
});

describe('parseCollectionCsv', () => {
  it('parses a well-formed file with header', () => {
    const csv = [
      'Name,Set,Collector Number,Quantity,Wishlist,Scryfall ID',
      'Sol Ring,c21,263,2,false,abc-123',
      'Mana Crypt,2xm,270,1,true,def-456'
    ].join('\n');
    const rows = parseCollectionCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      name: 'Sol Ring',
      set: 'c21',
      collectorNumber: '263',
      quantity: 2,
      wishlist: false,
      scryfallId: 'abc-123'
    });
    expect(rows[1].wishlist).toBe(true);
  });

  it('round-trips serialize -> parse', () => {
    const card = makeCard({ name: 'Kytheon, Hero of Akros', set: 'ori', collector_number: '23' });
    const csv = serializeCollectionCsv([entry({ card, name: card.name, quantity: 3, wishlist: true })]);
    const rows = parseCollectionCsv(csv);
    expect(rows[0].name).toBe('Kytheon, Hero of Akros');
    expect(rows[0].quantity).toBe(3);
    expect(rows[0].wishlist).toBe(true);
  });

  it('drops blank lines, nameless rows and empty rows', () => {
    const csv = ['Name,Set,Collector Number,Quantity,Wishlist', '', 'Sol Ring,c21,263,1,false', ',,,,'].join('\n');
    const rows = parseCollectionCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Sol Ring');
  });

  it('tolerates a headerless file and missing trailing columns', () => {
    const rows = parseCollectionCsv('Sol Ring,c21,263,4');
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(4);
    expect(rows[0].wishlist).toBe(false);
    expect(rows[0].scryfallId).toBeUndefined();
  });

  it('skips the header whatever its casing', () => {
    expect(parseCollectionCsv('name,set\nSol Ring,c21,263,1')).toHaveLength(1);
  });

  it('reads unquoted fields containing quotes and quoted fields containing doubled quotes', () => {
    const rows = parseCollectionCsv('"Say ""Hi""",tst,1,1,false\nPlain "quoted" bit,tst,2,1,false');
    expect(rows[0].name).toBe('Say "Hi"');
    expect(rows[1].name).toBe('Plain quoted bit');
  });

  it('floors fractional quantities and clamps negative or unparseable ones to zero', () => {
    const rows = parseCollectionCsv(
      ['Sol Ring,c21,263,3.7,false', 'Mana Crypt,2xm,270,-4,true', 'Black Lotus,lea,233,abc,yes'].join('\n')
    );
    expect(rows.map((row) => row.quantity)).toEqual([3, 0, 0]);
  });

  it('drops a row whose quantity is zero and wishlist flag is unset', () => {
    expect(parseCollectionCsv('Sol Ring,c21,263,0,false')).toEqual([]);
  });

  it('accepts every documented truthy spelling of the wishlist flag', () => {
    const csv = ['A,,,0,1', 'B,,,0,yes', 'C,,,0,y', 'D,,,0,x', 'E,,,0,TRUE', 'F,,,0,nope'].join('\n');
    expect(parseCollectionCsv(csv).map((row) => row.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('leaves optional columns undefined when they are blank', () => {
    const rows = parseCollectionCsv('Sol Ring,,,1,false,');
    expect(rows[0]).toEqual({
      name: 'Sol Ring',
      set: undefined,
      collectorNumber: undefined,
      quantity: 1,
      wishlist: false,
      scryfallId: undefined
    });
  });

  it('handles CRLF line endings', () => {
    expect(parseCollectionCsv('Sol Ring,c21,263,1,false\r\nMana Crypt,2xm,270,1,false')).toHaveLength(2);
  });
});

/**
 * Row -> Scryfall resolution against a stubbed network. The interesting behavior is
 * invisible from the outside: which identifier each row is looked up by, which match
 * wins when several could, and how each failure status is reported upwards.
 */
describe('resolveCollectionCsvRows', () => {
  const row = (overrides: Partial<CollectionCsvRow> = {}): CollectionCsvRow => ({
    name: 'Sol Ring',
    quantity: 1,
    wishlist: false,
    ...overrides
  });

  const reply = (status: number, body: unknown = { data: [] }) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body
    }) as unknown as Response;

  /** Records every identifier batch sent, so chunking and lookup shape stay assertable. */
  const stubFetch = (handler: (identifiers: Array<Record<string, string>>) => Response) => {
    const batches: Array<Array<Record<string, string>>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { identifiers: Array<Record<string, string>> };
        batches.push(body.identifiers);
        return handler(body.identifiers);
      })
    );
    return batches;
  };

  afterEach(() => vi.unstubAllGlobals());

  it('looks a row up by scryfall id when it has one', async () => {
    const card = makeCard({ id: 'abc-123', name: 'Sol Ring', set: 'c21', collector_number: '263' });
    const batches = stubFetch(() => reply(200, { data: [card] }));

    const result = await resolveCollectionCsvRows([row({ scryfallId: 'abc-123', set: 'c21', collectorNumber: '263' })]);

    expect(batches[0]).toEqual([{ id: 'abc-123' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ id: 'abc-123', name: 'Sol Ring', quantity: 1, wishlist: false });
    expect(result.missing).toEqual([]);
  });

  it('looks a row up by set and collector number when there is no id', async () => {
    const card = makeCard({ name: 'Sol Ring', set: 'C21', collector_number: '263' });
    const batches = stubFetch(() => reply(200, { data: [card] }));

    const result = await resolveCollectionCsvRows([row({ set: 'C21', collectorNumber: '263' })]);

    expect(batches[0]).toEqual([{ set: 'c21', collector_number: '263' }]);
    expect(result.entries[0].id).toBe(card.id);
  });

  it('looks a row up by name and set when there is no collector number', async () => {
    const batches = stubFetch(() => reply(200, { data: [makeCard({ name: 'Sol Ring', set: 'c21' })] }));

    await resolveCollectionCsvRows([row({ set: 'c21' })]);

    expect(batches[0]).toEqual([{ name: 'Sol Ring', set: 'c21' }]);
  });

  it('falls back to the bare name when the row carries no printing information', async () => {
    const batches = stubFetch(() => reply(200, { data: [makeCard({ name: 'Sol Ring' })] }));

    await resolveCollectionCsvRows([row()]);

    expect(batches[0]).toEqual([{ name: 'Sol Ring' }]);
  });

  it('matches by name when the id and set/number lookups both miss', async () => {
    const card = makeCard({ id: 'other-id', name: 'Sol Ring', set: 'lea', collector_number: '1' });
    stubFetch(() => reply(200, { data: [card] }));

    const result = await resolveCollectionCsvRows([row({ scryfallId: 'abc-123', set: 'c21', collectorNumber: '263' })]);

    expect(result.entries[0].id).toBe('other-id');
    expect(result.missing).toEqual([]);
  });

  it('reports unresolved rows once, however many times they appear', async () => {
    stubFetch(() => reply(200, { data: [] }));

    const result = await resolveCollectionCsvRows([row(), row({ quantity: 2 })]);

    expect(result.entries).toEqual([]);
    expect(result.missing).toEqual(['Sol Ring']);
  });

  it('tolerates a response whose data field is not an array', async () => {
    stubFetch(() => reply(200, { data: null }));

    const result = await resolveCollectionCsvRows([row()]);

    expect(result.missing).toEqual(['Sol Ring']);
  });

  it('splits requests into chunks of 75 identifiers', async () => {
    const batches = stubFetch(() => reply(200, { data: [] }));

    await resolveCollectionCsvRows(Array.from({ length: 76 }, (_, index) => row({ name: `Card ${index}` })));

    expect(batches.map((batch) => batch.length)).toEqual([75, 1]);
  });

  it.each([
    [503, 'ScryfallOffline'],
    [504, 'ScryfallOffline'],
    [429, 'ScryfallRateLimited'],
    [500, 'Scryfall API error']
  ])('maps HTTP %i to %s', async (status, message) => {
    stubFetch(() => reply(status));

    await expect(resolveCollectionCsvRows([row()])).rejects.toThrow(message);
  });

  it('carries the row quantity and wishlist flag onto the resolved entry', async () => {
    const card = makeCard({ name: 'Sol Ring', set: 'c21', rarity: 'uncommon' });
    stubFetch(() => reply(200, { data: [card] }));

    const result = await resolveCollectionCsvRows([row({ quantity: 4, wishlist: true })]);

    expect(result.entries[0]).toMatchObject({
      oracleId: card.oracle_id,
      set: 'c21',
      rarity: 'uncommon',
      quantity: 4,
      wishlist: true
    });
    expect(result.entries[0].updatedAt).toEqual(expect.any(String));
  });
});
