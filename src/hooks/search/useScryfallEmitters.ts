import { useCallback, useRef } from 'react';
import * as Scry from 'scryfall-sdk';
import MagicEmitter from 'scryfall-sdk/out/util/MagicEmitter';
import { Card } from '../../types/Card';
import { isCardLike } from '../../utils/typeGuards';
import { withGathererImage } from '../../utils/cardPrints';

const SEARCH_TIMEOUT_MS = 6000;

export interface SearchPage {
  cards: Card[];
  hasMore: boolean;
}

/**
 * Runs Scryfall page searches and keeps every emitter it started cancellable, so a search the
 * user has moved on from stops streaming instead of finishing into a screen that changed.
 * Cancelling on unmount is the caller's job: where that effect sits decides the order the
 * search effects run in, and only the hook that owns them can keep that order.
 */
export function useScryfallEmitters() {
  const activeEmittersRef = useRef<MagicEmitter<Scry.Card>[]>([]);

  const cancelActiveSearches = useCallback(() => {
    activeEmittersRef.current.forEach((emitter) => emitter?.cancel());
    activeEmittersRef.current = [];
  }, []);

  const searchPage = useCallback((baseQuery: string, page: number, language: string): Promise<SearchPage> => {
    const searchPromise = new Promise<SearchPage>((resolve, reject) => {
      const results: Card[] = [];
      const emitter = Scry.Cards.search(`${baseQuery} lang:${language}`, { page });
      activeEmittersRef.current.push(emitter);

      const cleanup = () => {
        activeEmittersRef.current = activeEmittersRef.current.filter((item) => item !== emitter);
      };

      emitter.cancelAfterPage();

      emitter.on('data', (card: Scry.Card) => {
        // The SDK hands back whatever the endpoint sent. A result with no id or no name
        // cannot be added to a deck or looked up later, so it is dropped here rather
        // than rendered as a blank tile.
        if (!isCardLike(card)) return;
        results.push(withGathererImage(card as unknown as Card));
      });

      emitter.on('done', () => {
        cleanup();
        resolve({ cards: results, hasMore: emitter.cancelled });
      });

      emitter.on('cancel', () => {
        cleanup();
        resolve({ cards: results, hasMore: true });
      });

      emitter.on('not_found', () => {
        cleanup();
        resolve({ cards: [], hasMore: false });
      });

      emitter.on('error', (error: Error & { status?: number }) => {
        cleanup();
        if (error?.status === 404 || error?.message?.includes('404')) {
          resolve({ cards: [], hasMore: false });
        } else {
          reject(error);
        }
      });
    });

    const timeoutPromise = new Promise<SearchPage>((_, reject) => {
      setTimeout(() => reject(new Error('Search request timed out')), SEARCH_TIMEOUT_MS);
    });

    return Promise.race([searchPromise, timeoutPromise]);
  }, []);

  return { searchPage, cancelActiveSearches };
}
