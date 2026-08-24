import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardItem from '../CardItem';
import i18n from '../../../plugins/i18n';
import { makeCard } from '../../../test/factories';

describe('CardItem', () => {
  it('renders the card art labelled with the card name', () => {
    render(<CardItem card={makeCard({ name: 'Serra Angel' })} size="small" />);

    expect(screen.getByRole('img', { name: 'Serra Angel' })).toBeInTheDocument();
  });

  it('adds the card to the deck when the add button is clicked', async () => {
    const user = userEvent.setup();
    const onAddToDeck = vi.fn();
    const card = makeCard({ name: 'Llanowar Elves' });

    render(<CardItem card={card} size="small" onAddToDeck={onAddToDeck} />);

    await user.click(screen.getByRole('button', { name: i18n.t('cardDetails.addCopy') }));

    expect(onAddToDeck).toHaveBeenCalledTimes(1);
    expect(onAddToDeck).toHaveBeenCalledWith(card);
  });

  it('shows a commander badge for a designated commander', () => {
    render(<CardItem card={makeCard({ name: 'Atraxa', isCommander: true })} size="small" />);

    expect(screen.getByText(i18n.t('cardDetails.commanderBadge'))).toBeInTheDocument();
  });
});
