import { describe, expect, it } from 'vitest';
import { makeCard } from '../test/factories';
import { Card } from '../types/Card';
import { deduplicateCards, mergeLanguageResults, scryfallSearchErrorKey } from './scryfallSearch';

const printing = (overrides: Partial<Card>) => makeCard({ oracle_id: 'bolt', name: 'Lightning Bolt', ...overrides });

describe('deduplicateCards', () => {
  it('keeps the printing in the reader language over the English one', () => {
    const unique = deduplicateCards([printing({ id: 'en', lang: 'en' }), printing({ id: 'pt', lang: 'pt' })], 'pt');

    expect(unique.map((card) => card.id)).toEqual(['pt']);
  });

  it('keeps English when the reader language has no printing', () => {
    const unique = deduplicateCards([printing({ id: 'en', lang: 'en' }), printing({ id: 'ja', lang: 'ja' })], 'pt');

    expect(unique.map((card) => card.id)).toEqual(['en']);
  });

  it('does not replace a printing already in the reader language', () => {
    const unique = deduplicateCards([printing({ id: 'pt-1', lang: 'pt' }), printing({ id: 'pt-2', lang: 'pt' })], 'pt');

    expect(unique.map((card) => card.id)).toEqual(['pt-1']);
  });

  it('reads a regional language tag as its base language', () => {
    const unique = deduplicateCards([printing({ id: 'en', lang: 'en' }), printing({ id: 'pt', lang: 'pt' })], 'pt-BR');

    expect(unique.map((card) => card.id)).toEqual(['pt']);
  });

  it('treats a printing with no language as English', () => {
    const unique = deduplicateCards([printing({ id: 'none' }), printing({ id: 'pt', lang: 'pt' })], 'pt');

    expect(unique.map((card) => card.id)).toEqual(['pt']);
  });

  it('keeps cards with no oracle id apart instead of collapsing them into one', () => {
    const unique = deduplicateCards(
      [makeCard({ id: 'a', oracle_id: undefined }), makeCard({ id: 'b', oracle_id: undefined })],
      'en'
    );

    expect(unique.map((card) => card.id)).toEqual(['a', 'b']);
  });

  it('defaults to English when no language is given at all', () => {
    expect(deduplicateCards([printing({ id: 'en', lang: 'en' })], '')).toHaveLength(1);
  });
});

describe('mergeLanguageResults', () => {
  it('adds only the English cards the localized search did not cover', () => {
    const preferred = [makeCard({ id: 'pt-bolt', oracle_id: 'bolt' })];
    const english = [makeCard({ id: 'en-bolt', oracle_id: 'bolt' }), makeCard({ id: 'en-shock', oracle_id: 'shock' })];

    expect(mergeLanguageResults(preferred, english).map((card) => card.id)).toEqual(['pt-bolt', 'en-shock']);
  });

  it('keeps the localized results first', () => {
    const preferred = [makeCard({ id: 'pt', oracle_id: 'a' })];
    const english = [makeCard({ id: 'en', oracle_id: 'b' })];

    expect(mergeLanguageResults(preferred, english).map((card) => card.id)).toEqual(['pt', 'en']);
  });

  it('returns the English list untouched when the localized search found nothing', () => {
    const english = [makeCard({ id: 'en', oracle_id: 'a' })];

    expect(mergeLanguageResults([], english)).toEqual(english);
  });
});

describe('scryfallSearchErrorKey', () => {
  it('reports a rate limit from the status', () => {
    expect(scryfallSearchErrorKey({ status: 429 })).toBe('search.rateLimited');
  });

  it('reports a rate limit the SDK only put in the message', () => {
    expect(scryfallSearchErrorKey(new Error('Request failed with 429'))).toBe('search.rateLimited');
  });

  it('reports an outage from either status', () => {
    expect(scryfallSearchErrorKey({ status: 503 })).toBe('search.scryfallOffline');
    expect(scryfallSearchErrorKey({ status: 504 })).toBe('search.scryfallOffline');
  });

  it('reports an outage the SDK only put in the message', () => {
    expect(scryfallSearchErrorKey(new Error('503 Service Unavailable'))).toBe('search.scryfallOffline');
    expect(scryfallSearchErrorKey(new Error('504 Gateway Timeout'))).toBe('search.scryfallOffline');
  });

  it('reads the wording Scryfall uses for maintenance, offline and timeouts', () => {
    expect(scryfallSearchErrorKey(new Error('Scryfall is OFFLINE'))).toBe('search.scryfallOffline');
    expect(scryfallSearchErrorKey(new Error('Down for Maintenance'))).toBe('search.scryfallOffline');
    expect(scryfallSearchErrorKey(new Error('Search request timed out'))).toBe('search.scryfallOffline');
  });

  it('answers null for a failure the user cannot act on', () => {
    expect(scryfallSearchErrorKey(new Error('Unexpected token < in JSON'))).toBeNull();
    expect(scryfallSearchErrorKey(undefined)).toBeNull();
  });

  it('prefers the rate limit when a message mentions both', () => {
    expect(scryfallSearchErrorKey(new Error('429 after 503'))).toBe('search.rateLimited');
  });
});
