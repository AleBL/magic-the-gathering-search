import { describe, it, expect } from 'vitest';
import { diffDeckVersions } from './deckVersionDiff';
import { Card } from '../types/Card';

const card = (name: string, extra: Partial<Card> = {}): Card => ({ name, ...extra }) as Card;
const version = (name: string, cards: Card[]) => ({ name, cards });

describe('diffDeckVersions', () => {
  it('returns no changes for equivalent snapshots', () => {
    const a = version('Deck', [card('Bolt'), card('Bolt')]);
    expect(diffDeckVersions(a, version('Deck', [card('Bolt'), card('Bolt')]))).toEqual([]);
  });

  it('detects added and removed cards', () => {
    const changes = diffDeckVersions(version('D', [card('Bolt')]), version('D', [card('Island')]));
    expect(changes).toEqual(
      expect.arrayContaining([
        { type: 'removed', name: 'Bolt', from: 1 },
        { type: 'added', name: 'Island', to: 1 }
      ])
    );
  });

  it('detects copy count increases and decreases', () => {
    const up = diffDeckVersions(version('D', [card('Bolt')]), version('D', [card('Bolt'), card('Bolt')]));
    expect(up).toEqual([{ type: 'increased', name: 'Bolt', from: 1, to: 2 }]);

    const down = diffDeckVersions(version('D', [card('Bolt'), card('Bolt')]), version('D', [card('Bolt')]));
    expect(down).toEqual([{ type: 'decreased', name: 'Bolt', from: 2, to: 1 }]);
  });

  it('detects a swapped printing', () => {
    const changes = diffDeckVersions(
      version('D', [card('Bolt', { set: 'lea', collector_number: '1' })]),
      version('D', [card('Bolt', { set: 'm10', collector_number: '146' })])
    );
    expect(changes).toEqual([{ type: 'printing', name: 'Bolt', from: 'lea|1', to: 'm10|146' }]);
  });

  it('detects commander changes and deck renames', () => {
    const changes = diffDeckVersions(
      version('Old', [card('Codie')]),
      version('New', [card('Codie', { isCommander: true })])
    );
    expect(changes).toEqual(
      expect.arrayContaining([
        { type: 'renamed', name: 'New', from: 'Old', to: 'New' },
        { type: 'commander', name: 'Codie', from: 'false', to: 'true' }
      ])
    );
  });
});
