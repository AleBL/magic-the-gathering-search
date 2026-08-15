import { useEffect, useLayoutEffect, useRef } from 'react';
import { registerShortcutHandler, ShortcutHandler, ShortcutLayer } from '../services/keyboardRegistry';

interface UseShortcutHandlerOptions {
  layer: ShortcutLayer;
  /** Unregisters while false, so a closed surface never competes for a key. */
  active?: boolean;
  blocksLowerLayers?: boolean;
}

/**
 * Binds a component's shortcut handler to the keyboard registry for as long as it is active.
 *
 * The handler is read from a ref, so call sites can pass an inline arrow without churning
 * their registration: re-registering on every render would both reorder the stack and, since
 * Escape is a discrete event, let one surface's re-render pull another's handler out of a
 * dispatch that was still travelling to it.
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
