import { Card } from '../types/Card';

/**
 * A deck holds one entry per copy, and `Card.id` is the *printing* — four copies of the
 * same edition share it. Group operations (add a copy, remove one, move a zone) address a
 * printing and rightly use `id`; changing one copy's art needs to address a single entry,
 * which is what `instanceId` is for.
 */

let counter = 0;

/** Unique within a session, which is all deck entries need — they are never cross-referenced. */
export function newDeckEntryId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export const deckEntryId = (card: Card): string => card.instanceId ?? card.id;

/**
 * Gives every entry an id, leaving existing ones alone. Decks saved before `instanceId`
 * existed come back without one, and two copies sharing a fallback id would bring back the
 * bug this replaced.
 */
export function withDeckEntryIds(cards: Card[]): Card[] {
  if (cards.every((card) => card.instanceId)) return cards;
  return cards.map((card) => (card.instanceId ? card : { ...card, instanceId: newDeckEntryId() }));
}
