import { describe, it, expect } from 'vitest';
import { cardArtCrop, resolveDeckCoverCard, resolveDeckCoverArt } from './deckCover';
import { Card } from '../types/Card';

const c = (id: string, extra: Partial<Card> = {}): Card => ({ id, name: id, ...extra }) as Card;
const withArt = (id: string, art: string, extra: Partial<Card> = {}): Card =>
  c(id, { image_uris: { small: '', normal: '', large: '', png: '', art_crop: art }, ...extra });

describe('cardArtCrop', () => {
  it('reads the front face art when the card itself has none', () => {
    const card = c('x', {
      card_faces: [
        { name: 'f', type_line: '', image_uris: { small: '', normal: '', large: '', png: '', art_crop: 'face' } }
      ]
    });
    expect(cardArtCrop(card)).toBe('face');
  });

  it('returns undefined for a card with no art', () => {
    expect(cardArtCrop(c('x'))).toBeUndefined();
  });
});

describe('resolveDeckCoverCard', () => {
  it('honours a valid user-chosen cover', () => {
    const chosen = withArt('chosen', 'a');
    const card = resolveDeckCoverCard({
      cards: [withArt('hero', 'b', { isCommander: true }), chosen],
      coverCardId: 'chosen'
    });
    expect(card).toBe(chosen);
  });

  it('falls back to the hero card when the chosen cover is gone', () => {
    const commander = withArt('cmd', 'b', { isCommander: true });
    const card = resolveDeckCoverCard({ cards: [commander], coverCardId: 'deleted' });
    expect(card).toBe(commander);
  });
});

describe('resolveDeckCoverArt', () => {
  it('returns the resolved cover art url', () => {
    expect(resolveDeckCoverArt({ cards: [withArt('a', 'art-url')] })).toBe('art-url');
  });

  it('returns undefined when nothing carries art', () => {
    expect(resolveDeckCoverArt({ cards: [c('a')] })).toBeUndefined();
  });
});
