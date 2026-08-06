import { describe, it, expect } from 'vitest';
import { pruneVersions } from './deckVersions';

const v = (id: string, createdAt: string) => ({ id, createdAt });

describe('pruneVersions', () => {
  it('keeps the newest entries up to the limit and marks the rest for removal', () => {
    const versions = [v('a', '2026-01-01'), v('b', '2026-01-03'), v('c', '2026-01-02')];
    const { keep, remove } = pruneVersions(versions, 2);
    expect(keep.map((x) => x.id)).toEqual(['b', 'c']);
    expect(remove.map((x) => x.id)).toEqual(['a']);
  });

  it('removes nothing when under the limit', () => {
    const { keep, remove } = pruneVersions([v('a', '2026-01-01')], 5);
    expect(keep.map((x) => x.id)).toEqual(['a']);
    expect(remove).toEqual([]);
  });
});
