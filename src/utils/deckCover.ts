import { Card } from '../types/Card';
import { Deck } from '../types/Deck';
import { pickHeroCard } from './deckImage';

export function cardArtCrop(card?: Card): string | undefined {
  return card?.image_uris?.art_crop ?? card?.card_faces?.[0]?.image_uris?.art_crop;
}

/** The chosen cover only wins while the card is still in the deck; removing it re-picks. */
export function resolveDeckCoverCard(deck: Pick<Deck, 'cards' | 'coverCardId'>): Card | undefined {
  if (deck.coverCardId) {
    const chosen = deck.cards.find((card) => card.id === deck.coverCardId);
    if (chosen) return chosen;
  }
  return pickHeroCard(deck.cards);
}

export function resolveDeckCoverArt(deck: Pick<Deck, 'cards' | 'coverCardId'>): string | undefined {
  return cardArtCrop(resolveDeckCoverCard(deck));
}
