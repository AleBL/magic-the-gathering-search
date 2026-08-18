import { describe, expect, it } from 'vitest';
import { makeCard } from '../test/factories';
import { buildPrintsQuery, sortPrintsByRelevance, tokenIdentityKey, withGathererImage } from './cardPrints';

const withImage = (url: string) => ({ small: url, normal: url, large: url, png: url });

describe('withGathererImage', () => {
  it("adds the Gatherer URL for the card's first multiverse id", () => {
    const card = withGathererImage({ ...makeCard({ image_uris: withImage('scry.png') }), multiverse_ids: [123, 456] });

    expect(card.image_uris?.gatherer).toBe(
      'https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=123&type=card'
    );
  });

  it('leaves the Gatherer URL empty when the printing has no multiverse id', () => {
    const card = withGathererImage(makeCard({ image_uris: withImage('scry.png') }));

    expect(card.image_uris?.gatherer).toBe('');
  });

  it('keeps the other image sizes untouched', () => {
    const card = withGathererImage({ ...makeCard({ image_uris: withImage('scry.png') }), multiverse_ids: [1] });

    expect(card.image_uris?.normal).toBe('scry.png');
  });

  it('stays without images when the printing has none', () => {
    const card = withGathererImage({ ...makeCard({ image_uris: undefined }), multiverse_ids: [1] });

    expect(card.image_uris).toBeUndefined();
  });
});

describe('buildPrintsQuery', () => {
  it('matches a token by exact name, since tokens share no oracle id', () => {
    expect(buildPrintsQuery({ cardName: 'Soldier', oracleId: 'token-oracle-1', isToken: true })).toBe(
      't:token name:!"Soldier" unique:prints lang:any'
    );
  });

  it('matches a real card by oracle id', () => {
    expect(buildPrintsQuery({ cardName: 'Lightning Bolt', oracleId: 'bolt-oracle' })).toBe(
      'oracle_id:bolt-oracle unique:prints lang:any'
    );
  });

  it('falls back to the exact name when the oracle id is a locally minted token id', () => {
    expect(buildPrintsQuery({ cardName: 'Treasure', oracleId: 'token-oracle-9' })).toBe(
      '!"Treasure" unique:prints lang:any'
    );
  });

  it('falls back to the exact name when there is no oracle id at all', () => {
    expect(buildPrintsQuery({ cardName: 'Lightning Bolt' })).toBe('!"Lightning Bolt" unique:prints lang:any');
  });
});

describe('tokenIdentityKey', () => {
  const soldier = () => makeCard({ name: 'Soldier', power: '1', toughness: '1', colors: ['W'], type_line: 'Token' });

  it('gives two printings of the same token the same key', () => {
    expect(tokenIdentityKey(soldier())).toBe(tokenIdentityKey(soldier()));
  });

  it('ignores the order the colours are listed in', () => {
    const first = makeCard({ colors: ['W', 'U'] });
    const second = makeCard({ ...first, colors: ['U', 'W'] });

    expect(tokenIdentityKey(first)).toBe(tokenIdentityKey(second));
  });

  it("does not reorder the card's own colours", () => {
    const card = makeCard({ colors: ['U', 'W'] });
    tokenIdentityKey(card);

    expect(card.colors).toEqual(['U', 'W']);
  });

  it('separates tokens that differ in size, colour, type or text', () => {
    const base = soldier();
    const key = tokenIdentityKey(base);

    expect(tokenIdentityKey({ ...base, power: '2' })).not.toBe(key);
    expect(tokenIdentityKey({ ...base, colors: ['B'] })).not.toBe(key);
    expect(tokenIdentityKey({ ...base, type_line: 'Token Artifact' })).not.toBe(key);
    expect(tokenIdentityKey({ ...base, oracle_text: 'Flying' })).not.toBe(key);
  });

  it('reads rules text case- and space-insensitively', () => {
    const card = makeCard({ oracle_text: '  Flying  ' });

    expect(tokenIdentityKey(card)).toBe(tokenIdentityKey(makeCard({ ...card, oracle_text: 'flying' })));
  });
});

describe('sortPrintsByRelevance', () => {
  const print = (id: string, lang: string, hasImage = true) =>
    makeCard({ id, lang, image_uris: hasImage ? withImage(`${id}.png`) : undefined });

  it('puts printings with art before printings without', () => {
    const sorted = sortPrintsByRelevance([print('no-art', 'en', false), print('art', 'en')], 'en');

    expect(sorted.map((card) => card.id)).toEqual(['art', 'no-art']);
  });

  it('puts the reader language first among printings that all have art', () => {
    const sorted = sortPrintsByRelevance([print('en', 'en'), print('pt', 'pt')], 'pt');

    expect(sorted.map((card) => card.id)).toEqual(['pt', 'en']);
  });

  it('reads a regional language tag as its base language', () => {
    const sorted = sortPrintsByRelevance([print('en', 'en'), print('pt', 'pt')], 'pt-BR');

    expect(sorted.map((card) => card.id)).toEqual(['pt', 'en']);
  });

  it('ranks art above language, so an illustrated English print beats a blank localized one', () => {
    const sorted = sortPrintsByRelevance([print('pt', 'pt', false), print('en', 'en')], 'pt');

    expect(sorted.map((card) => card.id)).toEqual(['en', 'pt']);
  });

  it('finds the art on the first face of a double-faced printing', () => {
    const dfc = makeCard({
      id: 'dfc',
      lang: 'en',
      image_uris: undefined,
      card_faces: [{ name: 'Front', type_line: 'Creature', image_uris: withImage('front.png') }]
    });
    const sorted = sortPrintsByRelevance([print('no-art', 'en', false), dfc], 'en');

    expect(sorted.map((card) => card.id)).toEqual(['dfc', 'no-art']);
  });

  it('leaves the list it was given untouched', () => {
    const prints = [print('no-art', 'en', false), print('art', 'en')];
    sortPrintsByRelevance(prints, 'en');

    expect(prints.map((card) => card.id)).toEqual(['no-art', 'art']);
  });
});
