import { Card } from '../types/Card';
import { Deck } from '../types/Deck';

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

// The `.dec` variant, kept separate from {@link deckToArenaText} on purpose: it carries a
// header with the deck's name and format, and it drops the set entirely when the collector
// number is missing, where the Arena text keeps the set alone.
export function deckToDecText(deck: Deck): string {
  const counts = new Map<string, { count: number; card: Card }>();
  for (const card of deck.cards) {
    const key = `${card.name}|${card.set ?? ''}|${card.collector_number ?? ''}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, card });
  }

  const lines = Array.from(counts.values()).map(({ count, card }) =>
    card.set && card.collector_number
      ? `${count} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}\n`
      : `${count} ${card.name}\n`
  );

  return `// ${deck.name}\n// Format: ${deck.format}\n\n${lines.join('')}`;
}

/**
 * File name for an exported deck. The escaping matters: the previous `/\\s+/` matched a
 * literal backslash followed by an `s`, so every name kept its spaces instead of losing them.
 */
export function deckExportFileName(deck: Deck, extension: string): string {
  return `${deck.name.replace(/\s+/g, '_')}.${extension}`;
}
