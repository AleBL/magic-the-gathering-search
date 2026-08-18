import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Delays an unmount long enough for a CSS exit transition to play. Call `requestClose()`
 * rather than `onClose()`: it flips `isClosing` (drive an exit class off it) and fires the
 * real `onClose` after `durationMs`. Reduced-motion users skip the wait.
 */
export function useDismissTransition(onClose: () => void, durationMs = 150) {
  const [isClosing, setIsClosing] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const requestClose = useCallback(() => {
    if (isClosing) return;
    if (prefersReducedMotion) {
      onClose();
      return;
    }
    setIsClosing(true);
    timeoutRef.current = window.setTimeout(onClose, durationMs);
  }, [isClosing, onClose, durationMs, prefersReducedMotion]);

  return { isClosing, requestClose };
}
