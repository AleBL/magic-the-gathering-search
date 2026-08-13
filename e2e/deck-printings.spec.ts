import { expect, test } from './fixtures';
import { mockScryfall, stubCard } from './fixtures';

/** The deck opens in list view: one row per pile. */
const DECK_ROW = '.deck-list-compact > *';

/**
 * Reported bug: changing one Island's art and adding another Island produced a single pile
 * wearing the changed art. A deck copy is a printing — four copies of a creature across
 * four editions are four things, each with its own art.
 */

const UNF = { ...stubCard({ name: 'Island', id: 'island-unf' }), set: 'unf', set_name: 'Unfinity' };
const ZNR = { ...stubCard({ name: 'Island', id: 'island-znr' }), set: 'znr', set_name: 'Zendikar Rising' };
// Same card, two printings: `oracle_id` is what makes the prints sidebar offer both.
const PRINTINGS = [
  { ...UNF, oracle_id: 'oracle-island' },
  { ...ZNR, oracle_id: 'oracle-island' }
];

test.describe('printings inside a deck', () => {
  test.beforeEach(async ({ appPage }) => {
    await mockScryfall(appPage, PRINTINGS);
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('island');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(appPage.getByRole('button', { name: 'Island' }).first()).toBeVisible();
  });

  test('two copies of one printing stack, and changing one copy splits them', async ({ appPage }) => {
    // Two copies of the same printing: the first result is the Unfinity Island.
    const addCopy = appPage.getByRole('button', { name: 'Add copy' }).first();
    await addCopy.click();
    await addCopy.click();

    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await expect(appPage.getByRole('button', { name: /Save Deck \(2 Cards?\)/ })).toBeVisible();

    // One pile of two, because both copies are the same edition.
    await expect(appPage.locator(DECK_ROW)).toHaveCount(1);
    await expect(appPage.locator(DECK_ROW).first()).toContainText('2');

    // Change the art of that pile's card to the other printing.
    await appPage.locator(DECK_ROW).first().click();
    const modal = appPage.getByRole('dialog');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Show editions' }).click();

    // Whichever edition is not the current one — the buttons are labelled by set code,
    // and aria-pressed is what marks the printing this copy already uses.
    const editions = modal.getByLabel('Card editions');
    await expect(editions).toBeVisible();
    await editions.locator('button[aria-pressed="false"]').first().click();
    await modal.getByRole('button', { name: 'Update Art' }).click();
    await appPage.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // Two piles now — one copy each — and the deck still holds two cards.
    await expect(appPage.locator(DECK_ROW)).toHaveCount(2);
    await expect(appPage.getByRole('button', { name: /Save Deck \(2 Cards?\)/ })).toBeVisible();
  });
});
