import { useEffect, useRef } from 'react';
import { PendingAction, useDeckStore } from '../store/useDeckStore';

export type PendingActionHandlers = Partial<Record<PendingAction, () => void>>;

/**
 * Sends a command on the channel from an event handler. Not a hook: dispatchers only
 * ever write, so subscribing them to the store would re-render them for a value they
 * never read. Paired here with {@link usePendingAction} so both halves of the channel
 * live in one module instead of every caller reaching into the store on its own.
 */
export function dispatchPendingAction(action: PendingAction): void {
  useDeckStore.getState().setPendingAction(action);
}

/**
 * Subscribes to the store's `pendingAction` command channel and runs the handler for
 * whichever command arrives, clearing the channel afterwards so it cannot fire twice.
 *
 * Commands with no handler here are left untouched: the channel is shared, and each
 * command is owned by exactly one mounted component (`focus-search` by CardSearch,
 * `playtest-deck` by DeckPreview, and so on). Clearing an unowned command would
 * swallow it before its owner ever saw it.
 *
 * `handlers` is read through a ref rather than listed as a dependency. Callers rebuild
 * the object every render, so depending on it would re-run the effect constantly; and
 * spelling out what each handler closes over produces a dependency list long enough
 * that it stops being reviewable. The effect must fire when a *command arrives* — not
 * when unrelated state changes — so `pendingAction` is the only real trigger, and the
 * ref guarantees the handler that runs is the one from the latest committed render.
 */
export function usePendingAction(handlers: PendingActionHandlers): void {
  const pendingAction = useDeckStore((state) => state.pendingAction);
  const setPendingAction = useDeckStore((state) => state.setPendingAction);

  const handlersRef = useRef(handlers);

  // Declared before the dispatch effect so it commits first: within one render both
  // run, and the dispatcher below must see this render's handlers, not the last one's.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!pendingAction) return;
    const handler = handlersRef.current[pendingAction];
    if (!handler) return;
    handler();
    setPendingAction(null);
  }, [pendingAction, setPendingAction]);
}
