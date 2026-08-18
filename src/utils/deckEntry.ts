import { Card } from '../types/Card';

// `Card.id` is the printing, shared by all four copies of an edition. Group operations (add
// a copy, remove one, move a zone) address a printing and rightly use it; changing one copy's
// art has to address a single entry, which is what `instanceId` is for.

let counter = 0;

/** Unique within a session, which is all a deck entry needs: they are never cross-referenced. */
export function newDeckEntryId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export const deckEntryId = (card: Card): string => card.instanceId ?? card.id;

// Decks saved before `instanceId` existed come back without one, and two copies sharing a
// fallback id bring back the bug the field was added to kill.
export function withDeckEntryIds(cards: Card[]): Card[] {
  if (cards.every((card) => card.instanceId)) return cards;
  return cards.map((card) => (card.instanceId ? card : { ...card, instanceId: newDeckEntryId() }));
}
