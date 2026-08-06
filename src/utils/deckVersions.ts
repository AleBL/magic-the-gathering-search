/**
 * Splits version snapshots into the newest `limit` to keep and the older ones
 * to discard, so a deck's history never grows without bound. Newest first.
 */
export function pruneVersions<T extends { createdAt: string }>(
  versions: T[],
  limit: number
): { keep: T[]; remove: T[] } {
  const sorted = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { keep: sorted.slice(0, limit), remove: sorted.slice(limit) };
}
