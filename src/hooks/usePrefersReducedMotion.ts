import { useMediaQuery } from './useMediaQuery';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Tracks the user's OS-level reduced-motion preference, live. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
