import { describe, expect, it } from 'vitest';
import { makeCard } from '../../test/factories';
import { Card } from '../../types/Card';
import { dedupeTokensByIdentity, findTokenGenerators, uniqueTokenId, withImageFallback } from '../tokenCards';

const imageUris = (url: string) => ({ small: url, normal: url, large: url, png: url });

describe('findTokenGenerators', () => {
  it('keeps cards whose text creates tokens', () => {
    const bolt = makeCard({ name: 'Bolt', oracle_text: 'Deals 3 damage.' });
    const raise = makeCard({ name: 'Raise the Alarm', oracle_text: 'Create two 1/1 white Soldier tokens.' });

    expect(findTokenGenerators([bolt, raise]).map((card) => card.name)).toEqual(['Raise the Alarm']);
  });

  it('matches localized rules text, not only English', () => {
    const pt = makeCard({ name: 'Convocar', oracle_text: 'Crie duas fichas de criatura Soldado 1/1 branca.' });

    expect(findTokenGenerators([pt])).toHaveLength(1);
  });

  it('reads the printed text when the card carries no oracle text', () => {
    const card = { ...makeCard({ name: 'Localized', oracle_text: undefined }), printed_text: 'Crie uma ficha.' };

    expect(findTokenGenerators([card as Card])).toHaveLength(1);
  });

  it('ignores lands even when their text mentions tokens', () => {
    const land = makeCard({
      name: 'Castle Ardenvale',
      type_line: 'Land',
      oracle_text: 'Create a 1/1 white Human creature token.'
    });

    expect(findTokenGenerators([land])).toHaveLength(0);
  });
});

describe('withImageFallback', () => {
  it('borrows every image size from the source when the card has none', () => {
    const translated = makeCard({ image_uris: undefined });
    const english = makeCard({ image_uris: imageUris('https://img/en.png') });

    expect(withImageFallback(translated, english).image_uris).toEqual(imageUris('https://img/en.png'));
  });

  it('keeps the card untouched when it already has an image', () => {
    const translated = makeCard({ image_uris: imageUris('https://img/pt.png') });
    const english = makeCard({ image_uris: imageUris('https://img/en.png') });

    expect(withImageFallback(translated, english)).toBe(translated);
  });

  it('leaves the card alone when neither side has an image', () => {
    const translated = makeCard({ image_uris: undefined });

    expect(withImageFallback(translated, makeCard({ image_uris: undefined }))).toBe(translated);
  });

  it('reads the first face of a double-faced source', () => {
    const translated = makeCard({ image_uris: undefined });
    const english = makeCard({
      image_uris: undefined,
      card_faces: [{ name: 'Front', type_line: 'Token Creature', image_uris: imageUris('https://img/face.png') }]
    });

    expect(withImageFallback(translated, english).image_uris?.normal).toBe('https://img/face.png');
  });

  it('does not mutate the card it is given', () => {
    const translated = makeCard({ image_uris: undefined });
    withImageFallback(translated, makeCard({ image_uris: imageUris('https://img/en.png') }));

    expect(translated.image_uris).toBeUndefined();
  });
});

describe('dedupeTokensByIdentity', () => {
  const soldier = (overrides: Partial<Card> = {}) =>
    makeCard({ name: 'Soldier', power: '1', toughness: '1', colors: ['W'], ...overrides });

  it('keeps one printing per name, size and colour', () => {
    const tokens = [soldier({ id: 'a' }), soldier({ id: 'b' })];

    expect(dedupeTokensByIdentity(tokens).map((token) => token.id)).toEqual(['a']);
  });

  it('treats a different size as a different token', () => {
    const tokens = [soldier({ id: 'a' }), soldier({ id: 'b', power: '2', toughness: '2' })];

    expect(dedupeTokensByIdentity(tokens)).toHaveLength(2);
  });

  it('treats a different colour as a different token', () => {
    const tokens = [soldier({ id: 'a' }), soldier({ id: 'b', colors: ['B'] })];

    expect(dedupeTokensByIdentity(tokens)).toHaveLength(2);
  });

  it('ignores case and surrounding spaces in the name', () => {
    const tokens = [soldier({ id: 'a', name: 'Soldier' }), soldier({ id: 'b', name: ' soldier ' })];

    expect(dedupeTokensByIdentity(tokens)).toHaveLength(1);
  });
});

describe('uniqueTokenId', () => {
  it('keeps the seed and still differs between calls', () => {
    const first = uniqueTokenId('soldier');
    const second = uniqueTokenId('soldier');

    expect(first).toMatch(/^token-soldier-/);
    expect(first).not.toBe(second);
  });

  it('generates an id even without a seed', () => {
    expect(uniqueTokenId()).toMatch(/^token-.+-.+$/);
  });
});
