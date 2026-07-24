import { Card } from '../types/Card';
import { DeckVersion } from '../types/Deck';

export type DeckVersionChangeType =
  | 'added'
  | 'removed'
  | 'increased'
  | 'decreased'
  | 'printing'
  | 'commander'
  | 'renamed';

export interface DeckVersionChange {
  type: DeckVersionChangeType;
  /** Card name, or the deck name for `renamed`. */
  name: string;
  from?: string | number;
  to?: string | number;
}

interface CardEntry {
  count: number;
  printing: string;
  isCommander: boolean;
}

/** Groups a flat card list by name, tracking copies, printing and commander flag. */
function groupByName(cards: Card[]): Map<string, CardEntry> {
  const map = new Map<string, CardEntry>();
  for (const card of cards) {
    const printing = `${card.set ?? ''}|${card.collector_number ?? ''}`;
    const existing = map.get(card.name);
    if (existing) {
      existing.count += 1;
      existing.isCommander = existing.isCommander || !!card.isCommander;
    } else {
      map.set(card.name, { count: 1, printing, isCommander: !!card.isCommander });
    }
  }
  return map;
}

/**
 * Describes everything that changed between two snapshots: cards added or
 * removed, copy counts up or down, a swapped printing, commander changes and
 * deck renames. Returns an empty array when the snapshots are equivalent.
 */
export function diffDeckVersions(
  previous: Pick<DeckVersion, 'name' | 'cards'>,
  next: Pick<DeckVersion, 'name' | 'cards'>
): DeckVersionChange[] {
  const changes: DeckVersionChange[] = [];

  if (previous.name !== next.name) {
    changes.push({ type: 'renamed', name: next.name, from: previous.name, to: next.name });
  }

  const before = groupByName(previous.cards);
  const after = groupByName(next.cards);

  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(name);
    const b = after.get(name);

    if (!a && b) {
      changes.push({ type: 'added', name, to: b.count });
      continue;
    }
    if (a && !b) {
      changes.push({ type: 'removed', name, from: a.count });
      continue;
    }
    if (!a || !b) continue;

    if (b.count > a.count) changes.push({ type: 'increased', name, from: a.count, to: b.count });
    else if (b.count < a.count) changes.push({ type: 'decreased', name, from: a.count, to: b.count });

    if (a.printing !== b.printing) {
      changes.push({ type: 'printing', name, from: a.printing, to: b.printing });
    }
    if (a.isCommander !== b.isCommander) {
      changes.push({ type: 'commander', name, from: String(a.isCommander), to: String(b.isCommander) });
    }
  }

  return changes;
}
