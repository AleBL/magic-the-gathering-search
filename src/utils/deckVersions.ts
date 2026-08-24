/** Both halves come back newest first. */
export function pruneVersions<T extends { createdAt: string }>(
  versions: T[],
  limit: number
): { keep: T[]; remove: T[] } {
  const sorted = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { keep: sorted.slice(0, limit), remove: sorted.slice(limit) };
}
