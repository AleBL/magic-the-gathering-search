import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { Deck, DeckRelatedToken } from '../../types/Deck';
import { db } from '../../db/database';
import { dispatchToast } from '../../utils/toastHelper';
import { newId } from '../../utils/id';
import { saveDeckSnapshot } from '../../services/deckVersionService';

interface DeckRecordsArgs {
  onDeckDeleted: (deckId: string) => void;
}

/** Writes to an existing deck record, each reporting its own failure to the user. */
export function useDeckRecords({ onDeckDeleted }: DeckRecordsArgs) {
  const { t } = useTranslation();

  /**
   * Runs one `db.decks` write, turning any failure into a logged reason and a toast. Dexie
   * rejects instead of throwing where the call site can see it, and an unreported rejection
   * leaves the UI showing a deck that was never written.
   */
  const write = async <T>(action: () => Promise<T>, logMessage: string, toastKey: string): Promise<T | undefined> => {
    try {
      return await action();
    } catch (error) {
      logger.error(logMessage, error);
      dispatchToast(t(toastKey), 'danger');
      return undefined;
    }
  };

  const deleteDeck = (deckId: string): Promise<Deck | undefined> =>
    write(
      async () => {
        const deckToDelete = await db.decks.get(deckId);
        if (!deckToDelete) return undefined;

        await db.decks.delete(deckId);
        onDeckDeleted(deckId);

        return deckToDelete;
      },
      'Failed to delete deck:',
      'deck.deleteError'
    );

  const restoreDeck = (deck: Deck) =>
    write(
      async () => {
        const existing = await db.decks.get(deck.id);
        if (existing) return;
        await db.decks.put(deck);
      },
      'Failed to restore deck:',
      'deck.restoreError'
    );

  const duplicateDeck = (deck: Deck): Promise<Deck | undefined> =>
    write(
      async () => {
        const copy: Deck = {
          ...deck,
          id: newId(),
          name: `${deck.name} (${t('common.copy')})`,
          createdAt: new Date().toISOString()
        };
        await db.decks.put(copy);
        await saveDeckSnapshot(copy).catch(() => undefined);
        return copy;
      },
      'Failed to duplicate deck:',
      'deck.saveError'
    );

  const saveTokensToDeck = (deckId: string, tokens: DeckRelatedToken[]) =>
    write(
      async () => {
        const existing = await db.decks.get(deckId);
        if (existing) {
          await db.decks.put({ ...existing, relatedTokens: tokens });
        }
      },
      'Failed to save tokens to deck:',
      'deck.saveError'
    );

  // The live query over db.decks re-renders the deck list on its own after this update.
  const setDeckCover = (deckId: string, coverCardId: string) =>
    write(() => db.decks.update(deckId, { coverCardId }), 'Failed to set deck cover:', 'deck.saveError');

  return { deleteDeck, restoreDeck, duplicateDeck, saveTokensToDeck, setDeckCover };
}
