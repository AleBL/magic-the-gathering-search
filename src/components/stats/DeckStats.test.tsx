import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import DeckStats from './DeckStats';
import { makeCard } from '../../test/factories';
import { Card } from '../../types/Card';

const sampleDeck: Card[] = [
  makeCard({ name: 'Llanowar Elves', type_line: 'Creature — Elf Druid', cmc: 1, colors: ['G'], rarity: 'common' }),
  makeCard({ name: 'Lightning Bolt', type_line: 'Instant', cmc: 1, colors: ['R'], rarity: 'common' }),
  makeCard({ name: 'Forest', type_line: 'Basic Land — Forest', cmc: 0, colors: [], rarity: 'common' }),
  makeCard({ name: 'Serra Angel', type_line: 'Creature — Angel', cmc: 5, colors: ['W'], rarity: 'uncommon' })
];

describe('DeckStats', () => {
  it('renders nothing for an empty deck', () => {
    const { container } = render(<DeckStats currentDeck={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders statistics content for a real deck without crashing', () => {
    const { container } = render(<DeckStats currentDeck={sampleDeck} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
