import { Card } from '../types/Card';
import { Deck } from '../types/Deck';
import { pickHeroCard } from './deckImage';

/** The card's key art (`art_crop`), falling back to the front face's art. */
export function cardArtCrop(card?: Card): string | undefined {
  return card?.image_uris?.art_crop ?? card?.card_faces?.[0]?.image_uris?.art_crop;
}

/**
 * The card that represents a deck on its "deck box": the user-chosen cover when
 * set and still present, otherwise the commander or the best available art.
 */
export function resolveDeckCoverCard(deck: Pick<Deck, 'cards' | 'coverCardId'>): Card | undefined {
  if (deck.coverCardId) {
    const chosen = deck.cards.find((card) => card.id === deck.coverCardId);
    if (chosen) return chosen;
  }
  return pickHeroCard(deck.cards);
}

/** The deck box art URL, or `undefined` when no card in the deck carries art. */
export function resolveDeckCoverArt(deck: Pick<Deck, 'cards' | 'coverCardId'>): string | undefined {
  return cardArtCrop(resolveDeckCoverCard(deck));
}
