import { Card } from '../types/Card';

// The format MTG Arena and MTGO importers accept: `<count> <name> (<SET>) <collector_number>`,
// one line per distinct printing. Set and collector number are emitted only when both are
// known, because a partial tail makes the line invalid for those importers.
export function deckToArenaText(cards: Card[]): string {
  const counts = new Map<string, { count: number; card: Card }>();
  for (const card of cards) {
    const key = `${card.name}|${card.set ?? ''}|${card.collector_number ?? ''}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, card });
  }

  return Array.from(counts.values())
    .map(({ count, card }) => {
      const setCode = card.set ? ` (${card.set.toUpperCase()})` : '';
      const collector = card.set && card.collector_number ? ` ${card.collector_number}` : '';
      return `${count} ${card.name}${setCode}${collector}`;
    })
    .join('\n');
}
