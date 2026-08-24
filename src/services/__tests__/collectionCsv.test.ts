import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeCard } from '../../test/factories';
import { CollectionEntry } from '../../types/Collection';
import {
  CollectionCsvRow,
  parseCollectionCsv,
  ResolveCollectionCsvOptions,
  resolveCollectionCsvRows,
  serializeCollectionCsv
} from '../collectionCsv';

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

  // The serializer quotes a value containing a newline; the parser used to cut the file on
  // every newline regardless, so a file this module wrote did not survive its own round trip.
  it('keeps a quoted newline inside its field instead of splitting the record', () => {
    const card = makeCard({ name: 'Weird\nName', set: 'tst', collector_number: '1' });
    const csv = serializeCollectionCsv([entry({ card, name: card.name, quantity: 2 })]);

    const rows = parseCollectionCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Weird\nName');
    expect(rows[0].quantity).toBe(2);
  });

  it('does not split on a newline inside a quoted field when other rows follow', () => {
    const csv = [
      'Name,Set,Collector Number,Quantity,Wishlist',
      '"Two\nLines",tst,1,1,false',
      'Sol Ring,c21,263,4,false'
    ].join('\n');

    const rows = parseCollectionCsv(csv);
    expect(rows.map((row) => row.name)).toEqual(['Two\nLines', 'Sol Ring']);
    expect(rows[1].quantity).toBe(4);
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

  /** Pacing off: these cases are about resolution shape, not about the 150 ms spacing. */
  const resolve = (rows: CollectionCsvRow[], options: ResolveCollectionCsvOptions = {}) =>
    resolveCollectionCsvRows(rows, { chunkDelayMs: 0, retryBaseMs: 0, ...options });

  afterEach(() => vi.unstubAllGlobals());

  it('looks a row up by scryfall id when it has one', async () => {
    const card = makeCard({ id: 'abc-123', name: 'Sol Ring', set: 'c21', collector_number: '263' });
    const batches = stubFetch(() => reply(200, { data: [card] }));

    const result = await resolve([row({ scryfallId: 'abc-123', set: 'c21', collectorNumber: '263' })]);

    expect(batches[0]).toEqual([{ id: 'abc-123' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ id: 'abc-123', name: 'Sol Ring', quantity: 1, wishlist: false });
    expect(result.missing).toEqual([]);
  });

  it('looks a row up by set and collector number when there is no id', async () => {
    const card = makeCard({ name: 'Sol Ring', set: 'C21', collector_number: '263' });
    const batches = stubFetch(() => reply(200, { data: [card] }));

    const result = await resolve([row({ set: 'C21', collectorNumber: '263' })]);

    expect(batches[0]).toEqual([{ set: 'c21', collector_number: '263' }]);
    expect(result.entries[0].id).toBe(card.id);
  });

  it('looks a row up by name and set when there is no collector number', async () => {
    const batches = stubFetch(() => reply(200, { data: [makeCard({ name: 'Sol Ring', set: 'c21' })] }));

    await resolve([row({ set: 'c21' })]);

    expect(batches[0]).toEqual([{ name: 'Sol Ring', set: 'c21' }]);
  });

  it('falls back to the bare name when the row carries no printing information', async () => {
    const batches = stubFetch(() => reply(200, { data: [makeCard({ name: 'Sol Ring' })] }));

    await resolve([row()]);

    expect(batches[0]).toEqual([{ name: 'Sol Ring' }]);
  });

  it('matches by name when the id and set/number lookups both miss', async () => {
    const card = makeCard({ id: 'other-id', name: 'Sol Ring', set: 'lea', collector_number: '1' });
    stubFetch(() => reply(200, { data: [card] }));

    const result = await resolve([row({ scryfallId: 'abc-123', set: 'c21', collectorNumber: '263' })]);

    expect(result.entries[0].id).toBe('other-id');
    expect(result.missing).toEqual([]);
  });

  it('reports unresolved rows once, however many times they appear', async () => {
    stubFetch(() => reply(200, { data: [] }));

    const result = await resolve([row(), row({ quantity: 2 })]);

    expect(result.entries).toEqual([]);
    expect(result.missing).toEqual(['Sol Ring']);
  });

  it('tolerates a response whose data field is not an array', async () => {
    stubFetch(() => reply(200, { data: null }));

    const result = await resolve([row()]);

    expect(result.missing).toEqual(['Sol Ring']);
  });

  it('splits requests into chunks of 75 identifiers', async () => {
    const batches = stubFetch(() => reply(200, { data: [] }));

    await resolve(Array.from({ length: 76 }, (_, index) => row({ name: `Card ${index}` })));

    expect(batches.map((batch) => batch.length)).toEqual([75, 1]);
  });

  // Failure is reported, not thrown: a throw here discarded every chunk that had already
  // come back, which for a 10k-row file meant losing thousands of resolved cards to one 429.
  it.each([
    [503, 'offline'],
    [504, 'offline'],
    [429, 'rateLimited'],
    [500, 'error']
  ])('reports HTTP %i as %s without throwing', async (status, failure) => {
    stubFetch(() => reply(status));

    const result = await resolve([row()], { maxAttempts: 1 });

    expect(result.failure).toBe(failure);
    expect(result.entries).toEqual([]);
    expect(result.unreached).toBe(1);
    expect(result.missing).toEqual([]);
  });

  it('keeps the chunks that succeeded when a later one fails for good', async () => {
    const card = (index: number) => makeCard({ id: `id-${index}`, name: `Card ${index}` });
    let call = 0;
    stubFetch((identifiers) => {
      call += 1;
      // Second chunk refuses every attempt; the run stops there instead of walking the file.
      if (call > 1) return reply(429);
      return reply(200, { data: identifiers.map((_, index) => card(index)) });
    });

    const rows = Array.from({ length: 160 }, (_, index) => row({ name: `Card ${index}`, scryfallId: `id-${index}` }));
    const result = await resolve(rows, { maxAttempts: 2 });

    expect(result.entries).toHaveLength(75);
    expect(result.unreached).toBe(85);
    expect(result.failure).toBe('rateLimited');
    // Two attempts on the failing chunk, then stop: the third chunk is never requested.
    expect(call).toBe(3);
  });

  it('retries a rate-limited chunk and carries on when it succeeds', async () => {
    let call = 0;
    stubFetch((identifiers) => {
      call += 1;
      if (call === 1) return reply(429);
      return reply(200, { data: identifiers.map((_, index) => makeCard({ id: `id-${index}`, name: 'Sol Ring' })) });
    });

    const result = await resolve([row({ scryfallId: 'id-0' })], { maxAttempts: 3 });

    expect(call).toBe(2);
    expect(result.failure).toBeNull();
    expect(result.entries).toHaveLength(1);
  });

  // `mergeEntries` sums quantities, so a row already in the collection must not be resolved
  // again: that is what makes re-running a failed import a resume instead of a duplicate.
  it('skips rows whose printing the collection already holds', async () => {
    const batches = stubFetch((identifiers) =>
      reply(200, { data: identifiers.map((_, index) => makeCard({ id: `new-${index}`, name: 'Mana Crypt' })) })
    );

    const known = { ids: new Set(['owned-id']), setNumbers: new Set(['c21|263']) };
    const rows = [
      row({ name: 'Sol Ring', scryfallId: 'owned-id' }),
      row({ name: 'Arcane Signet', set: 'C21', collectorNumber: '263' }),
      row({ name: 'Mana Crypt', scryfallId: 'new-0' })
    ];

    const result = await resolve(rows, { known });

    expect(result.skipped).toBe(2);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([{ id: 'new-0' }]);
    expect(result.entries).toHaveLength(1);
  });

  // A name-only row could be a different printing of a card already owned, so it is asked
  // about rather than assumed.
  it('does not skip a row that names no specific printing', async () => {
    const batches = stubFetch(() => reply(200, { data: [] }));

    const result = await resolve([row({ name: 'Sol Ring' })], {
      known: { ids: new Set(['owned-id']), setNumbers: new Set(['c21|263']) }
    });

    expect(result.skipped).toBe(0);
    expect(batches).toHaveLength(1);
  });

  it('reports progress over the whole file, skipped rows included', async () => {
    stubFetch((identifiers) =>
      reply(200, { data: identifiers.map((_, index) => makeCard({ id: `id-${index}`, name: `Card ${index}` })) })
    );

    const seen: Array<{ done: number; total: number }> = [];
    const rows = Array.from({ length: 80 }, (_, index) => row({ name: `Card ${index}`, scryfallId: `id-${index}` }));

    await resolve(rows, { known: { ids: new Set(['id-0']), setNumbers: new Set() }, onProgress: (p) => seen.push(p) });

    // One skipped row, then two chunks of the remaining 79.
    expect(seen).toEqual([
      { done: 1, total: 80 },
      { done: 76, total: 80 },
      { done: 80, total: 80 }
    ]);
  });

  it('spaces requests out instead of emptying the file at Scryfall at once', async () => {
    stubFetch(() => reply(200, { data: [] }));

    const rows = Array.from({ length: 151 }, (_, index) => row({ name: `Card ${index}` }));
    const startedAt = Date.now();
    // 20 ms rather than the production 150 ms: what is under test is that it waits between
    // chunks at all, not the constant.
    await resolveCollectionCsvRows(rows, { chunkDelayMs: 20, retryBaseMs: 0 });

    // Three chunks, so two gaps.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(40);
  });

  it('carries the row quantity and wishlist flag onto the resolved entry', async () => {
    const card = makeCard({ name: 'Sol Ring', set: 'c21', rarity: 'uncommon' });
    stubFetch(() => reply(200, { data: [card] }));

    const result = await resolve([row({ quantity: 4, wishlist: true })]);

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
