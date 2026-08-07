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

  // The goldfish panel only reports once a hand can be dealt; the four-card deck above
  // exercises its empty state, so a full deck is needed to cover the reporting path.
  it('reports the goldfish simulation for a deck big enough to draw a hand', () => {
    const deck: Card[] = [
      ...Array.from({ length: 24 }, (_, i) =>
        makeCard({ id: `land-${i}`, name: 'Mountain', type_line: 'Basic Land — Mountain', cmc: 0, mana_cost: '' })
      ),
      ...Array.from({ length: 36 }, (_, i) =>
        makeCard({ id: `bolt-${i}`, name: 'Lightning Bolt', type_line: 'Instant', cmc: 1, mana_cost: '{R}' })
      )
    ];

    const { getByText, queryByText, getAllByText } = render(<DeckStats currentDeck={deck} />);

    // Tests run under the app's default locale, pt.
    expect(getByText('Simulação Solitária')).toBeTruthy();
    expect(queryByText(/ao menos sete cartas/)).toBeNull();
    expect(getByText('Taxa de mulligan')).toBeTruthy();
    // A percentage actually rendered, rather than a panel that mounted empty.
    expect(getAllByText(/^\d+%$/).length).toBeGreaterThan(0);
  });
});
