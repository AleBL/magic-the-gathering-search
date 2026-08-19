import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchCardsFromParsedList } from '../deckImportService';

/**
 * Import resolution against a stubbed Scryfall. What matters here is the decisions the
 * function makes — which identifiers it sends, how it reacts to each failure status, and
 * what it retries — none of which are visible from the outside once the network is real.
 */

type Body = { identifiers: Array<Record<string, string>> };

const calls: Body[] = [];

/** Builds a minimal Response-alike; only what the code under test reads. */
const reply = (status: number, body: unknown = {}, retryAfter = '0') =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name === 'Retry-After' ? retryAfter : null) },
    json: async () => body
  }) as unknown as Response;

const card = (name: string) => ({ id: name, name, lang: 'en' });

const stubFetch = (handler: (body: Body, url: string) => Response) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(init.body as string) as Body) : { identifiers: [] };
      if (String(url).includes('/cards/collection')) calls.push(body);
      return handler(body, String(url));
    })
  );
};

describe('fetchCardsFromParsedList', () => {
  beforeEach(() => {
    calls.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends set + collector number as a printing lookup', async () => {
    stubFetch(() => reply(200, { data: [card('Lightning Bolt')], not_found: [] }));

    await fetchCardsFromParsedList([{ name: 'Lightning Bolt', quantity: 1, set: 'lea', collector_number: '161' }]);

    expect(calls[0].identifiers).toEqual([{ set: 'lea', collector_number: '161' }]);
  });

  it('sends name + set when there is no collector number', async () => {
    stubFetch(() => reply(200, { data: [card('Lightning Bolt')], not_found: [] }));

    await fetchCardsFromParsedList([{ name: 'Lightning Bolt', quantity: 1, set: 'lea' }]);

    expect(calls[0].identifiers).toEqual([{ name: 'Lightning Bolt', set: 'lea' }]);
  });

  it('sends the bare name when there is no printing information', async () => {
    stubFetch(() => reply(200, { data: [card('Lightning Bolt')], not_found: [] }));

    await fetchCardsFromParsedList([{ name: 'Lightning Bolt', quantity: 1 }]);

    expect(calls[0].identifiers).toEqual([{ name: 'Lightning Bolt' }]);
  });

  // Four copies of a card is one lookup, not four — the quantity is applied later.
  it('asks for each distinct printing once', async () => {
    stubFetch(() => reply(200, { data: [card('Lightning Bolt')], not_found: [] }));

    await fetchCardsFromParsedList([
      { name: 'Lightning Bolt', quantity: 1, set: 'lea' },
      { name: 'Lightning Bolt', quantity: 1, set: 'lea' },
      { name: 'Lightning Bolt', quantity: 1, set: 'm10' }
    ]);

    expect(calls[0].identifiers).toHaveLength(2);
  });

  it('splits more than 75 cards into separate requests', async () => {
    stubFetch(() => reply(200, { data: [card('Filler')], not_found: [] }));
    const parsed = Array.from({ length: 80 }, (_, i) => ({ name: `Card ${i}`, quantity: 1 }));

    await fetchCardsFromParsedList(parsed);

    expect(calls.map((c) => c.identifiers.length)).toEqual([75, 5]);
  });

  describe('failure statuses', () => {
    it.each([
      [503, 'ScryfallOffline'],
      [504, 'ScryfallOffline'],
      [429, 'ScryfallRateLimited']
    ])('turns %i into a %s error the UI can translate', async (status, message) => {
      stubFetch(() => reply(status));

      await expect(fetchCardsFromParsedList([{ name: 'Lightning Bolt', quantity: 1 }])).rejects.toThrow(message);
    });

    it('throws when nothing at all could be resolved', async () => {
      stubFetch(() => reply(200, { data: [], not_found: [] }));

      await expect(fetchCardsFromParsedList([{ name: 'Nonexistent', quantity: 1 }])).rejects.toThrow('No cards found');
    });
  });

  // A wrong set code should not lose the card: the retry drops the printing and asks by
  // name alone, which is the difference between importing a deck and rejecting it.
  it('retries a not-found printing by name alone', async () => {
    let call = 0;
    stubFetch(() => {
      call += 1;
      if (call === 1) return reply(200, { data: [], not_found: [{ set: 'zzz', collector_number: '1' }] });
      return reply(200, { data: [card('Lightning Bolt')], not_found: [] });
    });

    const result = await fetchCardsFromParsedList([
      { name: 'Lightning Bolt', quantity: 1, set: 'zzz', collector_number: '1' }
    ]);

    expect(calls[1].identifiers).toEqual([{ name: 'Lightning Bolt' }]);
    expect(result.cards.map((c) => c.name)).toContain('Lightning Bolt');
  });

  it('retries a double-faced card by its front face only', async () => {
    let call = 0;
    stubFetch(() => {
      call += 1;
      if (call === 1)
        return reply(200, { data: [], not_found: [{ name: 'Delver of Secrets // Insectile Aberration' }] });
      return reply(200, { data: [card('Delver of Secrets')], not_found: [] });
    });

    await fetchCardsFromParsedList([{ name: 'Delver of Secrets // Insectile Aberration', quantity: 1 }]);

    expect(calls[1].identifiers).toEqual([{ name: 'Delver of Secrets' }]);
  });

  describe('malformed payloads', () => {
    // A card with no id cannot be added to a deck or looked up again; keeping it would
    // put a blank entry in the imported deck instead of reporting the name as missing.
    it('drops entries that are not usable cards and reports them as missing', async () => {
      stubFetch(() => reply(200, { data: [{ name: 'Lightning Bolt' }, card('Shock')], not_found: [] }));

      const result = await fetchCardsFromParsedList([
        { name: 'Lightning Bolt', quantity: 1 },
        { name: 'Shock', quantity: 1 }
      ]);

      expect(result.cards.map((c) => c.name)).toEqual(['Shock']);
      expect(result.missing).toEqual(['Lightning Bolt']);
    });

    it.each([
      ['data is not a list', { data: 'Lightning Bolt', not_found: [] }],
      ['data is missing entirely', { not_found: [] }],
      ['the body is not an object', 'Lightning Bolt']
    ])('treats a response where %s as nothing found', async (_label, body) => {
      stubFetch(() => reply(200, body));

      await expect(fetchCardsFromParsedList([{ name: 'Lightning Bolt', quantity: 1 }])).rejects.toThrow(
        'No cards found'
      );
    });

    // not_found drives the by-name retry; junk in there must not become a lookup for a
    // card called "undefined".
    it('ignores not_found entries that are not objects', async () => {
      let call = 0;
      stubFetch(() => {
        call += 1;
        if (call === 1) return reply(200, { data: [], not_found: [null, 'zzz', { name: 'Lightning Bolt' }] });
        return reply(200, { data: [card('Lightning Bolt')], not_found: [] });
      });

      await fetchCardsFromParsedList([{ name: 'Lightning Bolt', quantity: 1 }]);

      expect(calls[1].identifiers).toEqual([{ name: 'Lightning Bolt' }]);
    });
  });

  it('reports progress while it works', async () => {
    stubFetch(() => reply(200, { data: [card('Lightning Bolt')], not_found: [] }));
    const onProgress = vi.fn();

    await fetchCardsFromParsedList([{ name: 'Lightning Bolt', quantity: 1 }], 'en', onProgress);

    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ isImporting: true, total: 1 }));
  });
});
