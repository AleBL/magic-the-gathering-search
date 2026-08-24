import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface AnimatedEntry<T> {
  key: string;
  item: T;
  isLeaving: boolean;
}

/**
 * Holds items that just left `items` for `exitMs` (isLeaving: true) so a row can animate out
 * instead of the list flickering; reduced-motion users skip the hold. One instance per
 * rendered list: calling it inside a `.map()` would make the number of hook calls vary.
 */
export function useAnimatedList<T>(items: T[], getKey: (item: T) => string, exitMs = 200): AnimatedEntry<T>[] {
  const [entries, setEntries] = useState<AnimatedEntry<T>[]>(() =>
    items.map((item) => ({ key: getKey(item), item, isLeaving: false }))
  );
  const prefersReducedMotion = usePrefersReducedMotion();
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  // Through refs so an inline getKey does not retrigger the sync effect every render: it
  // used to re-run after its own setEntries, looping to "Maximum update depth exceeded".
  const getKeyRef = useRef(getKey);
  getKeyRef.current = getKey;
  const exitMsRef = useRef(exitMs);
  exitMsRef.current = exitMs;

  useEffect(() => {
    const remaining = new Map(items.map((item) => [getKeyRef.current(item), item]));

    setEntries((current) => {
      const next: AnimatedEntry<T>[] = [];
      let changed = false;

      for (const entry of current) {
        const item = remaining.get(entry.key);
        if (item !== undefined) {
          if (item === entry.item && !entry.isLeaving) {
            next.push(entry);
          } else {
            next.push({ key: entry.key, item, isLeaving: false });
            changed = true;
          }
          remaining.delete(entry.key);
        } else if (entry.isLeaving) {
          next.push(entry);
        } else if (!prefersReducedMotion) {
          next.push({ ...entry, isLeaving: true });
          changed = true;
          const timeoutId = window.setTimeout(() => {
            setEntries((curr) => curr.filter((e) => e.key !== entry.key));
            timeoutsRef.current.delete(entry.key);
          }, exitMsRef.current);
          timeoutsRef.current.set(entry.key, timeoutId);
        } else {
          // Reduced motion: dropped immediately (not pushed to next).
          changed = true;
        }
      }

      for (const item of remaining.values()) {
        next.push({ key: getKeyRef.current(item), item, isLeaving: false });
        changed = true;
      }

      // Same reference when nothing changed, since `items` is often rebuilt every render.
      return changed ? next : current;
    });
  }, [items, prefersReducedMotion]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return entries;
}
