import { useEffect, useRef } from 'react';
import { PendingAction, useDeckStore } from '../store/useDeckStore';

export type PendingActionHandlers = Partial<Record<PendingAction, () => void>>;

/** Sends a command without subscribing — dispatchers only ever write. */
export function dispatchPendingAction(action: PendingAction): void {
  useDeckStore.getState().setPendingAction(action);
}

/**
 * Runs the handler for whichever command arrives on the store's `pendingAction` channel. A
 * command with no handler here is left on the shared channel: clearing one this component
 * does not own would swallow it before its owner saw it.
 */
export function usePendingAction(handlers: PendingActionHandlers): void {
  const pendingAction = useDeckStore((state) => state.pendingAction);
  const setPendingAction = useDeckStore((state) => state.setPendingAction);

  const handlersRef = useRef(handlers);

  // In a ref, committed before the dispatcher: callers rebuild `handlers` every render, so
  // depending on it directly would re-run the dispatcher constantly.
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
