import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Calls `onEscape` when Escape is pressed anywhere in the window, while `active`.
 *
 * The callback is read from a ref so this effect depends on `active` alone. Keying it on
 * `onEscape` instead meant every call site passing an inline arrow re-registered its window
 * listener on each render — and Escape is a discrete event, so React flushes the resulting
 * state update *inside* the dispatch. One dialog's handler could therefore tear down another
 * dialog's listener while the same keypress was still travelling to it, and a listener removed
 * before the event reaches it is never invoked. The second dialog simply never heard Escape.
 */
export function useEscapeKey(onEscape: () => void, active = true) {
  const savedOnEscape = useRef(onEscape);
  // Layout, not passive: a keypress landing between render and a passive effect would
  // otherwise run the previous render's callback.
  useLayoutEffect(() => {
    savedOnEscape.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') savedOnEscape.current();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);
}
