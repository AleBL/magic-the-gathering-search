import { db } from '../db/database';
import { Deck, DeckVersion } from '../types/Deck';
import { pruneVersions } from '../utils/deckVersions';
import { diffDeckVersions } from '../utils/deckVersionDiff';
import { newId } from '../utils/id';

const MAX_VERSIONS_PER_DECK = 20;

export async function saveDeckSnapshot(deck: Deck): Promise<DeckVersion> {
  const version: DeckVersion = {
    id: newId(),
    deckId: deck.id,
    name: deck.name,
    format: deck.format,
    cards: deck.cards,
    relatedTokens: deck.relatedTokens,
    createdAt: new Date().toISOString()
  };
  await db.deckVersions.add(version);

  const all = await db.deckVersions.where('deckId').equals(deck.id).toArray();
  const { remove } = pruneVersions(all, MAX_VERSIONS_PER_DECK);
  if (remove.length > 0) await db.deckVersions.bulkDelete(remove.map((v) => v.id));

  return version;
}

/** Newest first. */
export async function listDeckVersions(deckId: string): Promise<DeckVersion[]> {
  const all = await db.deckVersions.where('deckId').equals(deckId).toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteDeckVersion(id: string): Promise<void> {
  await db.deckVersions.delete(id);
}

export async function saveDeckSnapshotIfChanged(deck: Deck): Promise<DeckVersion | null> {
  const [latest] = await listDeckVersions(deck.id);
  if (latest && diffDeckVersions(latest, deck).length === 0) return null;
  return saveDeckSnapshot(deck);
}
