import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Which way a dropdown should open. Inside a scrollable modal a menu anchored below its
 * trigger grows the scroll area instead of overlaying it, pushing itself off-screen, so it
 * flips up when the space below is short. Measured against the viewport, not the scroll
 * container: the menu is positioned in the container's space but must not escape the window.
 */
export function useDropDirection(
  triggerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  estimatedHeight: number
): 'down' | 'up' {
  const [direction, setDirection] = useState<'down' | 'up'>('down');

  useLayoutEffect(() => {
    if (!isOpen) return;

    const measure = () => {
      const node = triggerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      // Only flip when going up is genuinely roomier; a cramped menu above is no better.
      setDirection(below < estimatedHeight && above > below ? 'up' : 'down');
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isOpen, estimatedHeight, triggerRef]);

  return direction;
}
