import { db } from '../db/database';
import { Deck, DeckVersion } from '../types/Deck';
import { pruneVersions } from '../utils/deckVersions';
import { diffDeckVersions } from '../utils/deckVersionDiff';

/** How many snapshots to retain per deck before the oldest are dropped. */
const MAX_VERSIONS_PER_DECK = 20;

/** Snapshots the deck's current state, then trims old versions past the cap. */
export async function saveDeckSnapshot(deck: Deck): Promise<DeckVersion> {
  const version: DeckVersion = {
    id: `${deck.id}-${Date.now()}`,
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

/** Lists a deck's snapshots, newest first. */
export async function listDeckVersions(deckId: string): Promise<DeckVersion[]> {
  const all = await db.deckVersions.where('deckId').equals(deckId).toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteDeckVersion(id: string): Promise<void> {
  await db.deckVersions.delete(id);
}

/**
 * Snapshots the deck only when it actually differs from the most recent
 * snapshot, so repeated saves don't pile up identical versions.
 */
export async function saveDeckSnapshotIfChanged(deck: Deck): Promise<DeckVersion | null> {
  const [latest] = await listDeckVersions(deck.id);
  if (latest && diffDeckVersions(latest, deck).length === 0) return null;
  return saveDeckSnapshot(deck);
}
