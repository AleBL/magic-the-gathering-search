import { useEffect, useState } from 'react';

/**
 * `window.matchMedia` is missing in jsdom, so every hook built on it has to survive its
 * absence rather than assume a browser. Treated as "does not match": a preference the
 * environment cannot report is a preference the user has not expressed.
 */
const matchesQuery = (query: string): boolean => window.matchMedia?.(query).matches ?? false;

/**
 * Reactive `window.matchMedia` subscription. Keep the query aligned with the
 * Tailwind breakpoints used in markup (e.g. '(max-width: 639px)' pairs with
 * `sm:`), or the JS branch and the CSS branch will disagree.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesQuery(query));

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(query);
    if (!mediaQuery) return;

    setMatches(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}
