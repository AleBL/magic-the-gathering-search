import { logger } from '../../utils/logger';
import { Card } from '../../types/Card';
import { Deck, DeckFormat, DeckRelatedToken } from '../../types/Deck';
import { db } from '../../db/database';
import { newId } from '../../utils/id';
import { saveDeckSnapshotIfChanged } from '../../services/deckVersionService';
import { requestPersistenceOnce } from '../../services/storagePersistence';

export interface DeckWriteResult {
  success: boolean;
  errorKey?: string;
}

export interface DeckCreateResult extends DeckWriteResult {
  createdDeck?: Deck;
}

/** Snapshots a deck after a successful save; never fails the save itself. */
async function snapshotQuietly(deck: Deck): Promise<void> {
  try {
    await saveDeckSnapshotIfChanged(deck);
  } catch (error) {
    logger.error('Failed to snapshot deck version:', error);
  }
}

interface DeckSavingArgs {
  /** Runs after a brand-new deck reaches the database, to clear the save form. */
  onDeckSaved: () => void;
}

/** Creating and updating decks, the two writes that answer with a result instead of a toast. */
export function useDeckSaving({ onDeckSaved }: DeckSavingArgs) {
  const saveDeck = async (
    name: string,
    format: DeckFormat,
    cards: Card[],
    notes?: string,
    relatedTokens?: DeckRelatedToken[]
  ): Promise<DeckCreateResult> => {
    if (!name.trim()) {
      return { success: false, errorKey: 'deckNamePlaceholder' };
    }
    if (cards.length === 0) {
      return { success: false, errorKey: 'addCardsMessage' };
    }

    const newDeck: Deck = {
      id: newId(),
      name: name.trim(),
      cards,
      format,
      notes,
      relatedTokens,
      createdAt: new Date().toISOString()
    };

    try {
      await db.decks.put(newDeck);
    } catch (error) {
      logger.error('Failed to save deck:', error);
      return { success: false, errorKey: 'deck.saveError' };
    }
    await snapshotQuietly(newDeck);
    // Asked here rather than on boot: the browser only grants persistent storage to an
    // origin the user has engaged with, and there is nothing to protect until now.
    void requestPersistenceOnce();
    onDeckSaved();
    return { success: true, createdDeck: newDeck };
  };

  const saveEditedDeck = async (
    id: string,
    name: string,
    format: DeckFormat,
    cards: Card[],
    notes?: string,
    relatedTokens?: DeckRelatedToken[]
  ): Promise<DeckWriteResult> => {
    try {
      const existing = await db.decks.get(id);
      if (existing) {
        const updated: Deck = {
          ...existing,
          name: name.trim(),
          format,
          cards,
          notes,
          relatedTokens: relatedTokens || existing.relatedTokens
        };
        await db.decks.put(updated);
        await snapshotQuietly(updated);
      }
      return { success: true };
    } catch (error) {
      logger.error('Failed to save edited deck:', error);
      return { success: false, errorKey: 'deck.saveError' };
    }
  };

  return { saveDeck, saveEditedDeck };
}
