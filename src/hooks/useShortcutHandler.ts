import { useEffect, useLayoutEffect, useRef } from 'react';
import { registerShortcutHandler, ShortcutHandler, ShortcutLayer } from '../services/keyboardRegistry';

interface UseShortcutHandlerOptions {
  layer: ShortcutLayer;
  /** Unregisters while false, so a closed surface never competes for a key. */
  active?: boolean;
  blocksLowerLayers?: boolean;
}

/**
 * Binds a shortcut handler to the keyboard registry while it is active. The handler is read
 * from a ref so an inline arrow does not churn the registration: re-registering every render
 * reorders the stack and can pull a handler out of a dispatch still travelling to it.
 */
export function useShortcutHandler(
  handle: ShortcutHandler,
  { layer, active = true, blocksLowerLayers = false }: UseShortcutHandlerOptions
): void {
  const savedHandle = useRef(handle);
  // Layout, not passive: a keypress landing between render and a passive effect would
  // otherwise run the previous render's handler.
  useLayoutEffect(() => {
    savedHandle.current = handle;
  });

  useEffect(() => {
    if (!active) return;
    return registerShortcutHandler((event) => savedHandle.current(event), { layer, blocksLowerLayers });
  }, [active, layer, blocksLowerLayers]);
}
