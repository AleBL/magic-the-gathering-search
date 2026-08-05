import { expect, test, stubCard, mockScryfall } from './fixtures';

/**
 * The collection tab's totals strip used to print the same value on both tabs, because it
 * always reported owned value regardless of which was open. These journeys pin the two
 * apart, and cover the name filter added alongside.
 */
test.describe('collection tab', () => {
  test.beforeEach(async ({ appPage }) => {
    await mockScryfall(appPage, [
      stubCard({ name: 'Lightning Bolt', id: 'bolt' }),
      stubCard({ name: 'Counterspell', id: 'counterspell' })
    ]);
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('a');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
  });

  test('reports owned value and wishlist value as different figures', async ({ appPage }) => {
    // One card owned, a different one wanted, so the two totals cannot coincide.
    await appPage.getByRole('button', { name: 'Mark as owned' }).first().click();
    await appPage.getByRole('button', { name: 'Wishlist' }).last().click();

    await appPage.getByRole('button', { name: 'My Collection' }).click();

    // The label names what is being summed, so the two tabs are not mistaken for one another.
    await expect(appPage.getByText(/value of owned copies/i)).toBeVisible();

    // The tab carries a count badge in its accessible name; the per-card toggle does not.
    await appPage.getByRole('button', { name: /^Wishlist \d+$/ }).click();
    await expect(appPage.getByText(/value of the wishlist/i)).toBeVisible();
  });

  test('narrows the collection by card name', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Mark as owned' }).first().click();
    await appPage.getByRole('button', { name: 'Mark as owned' }).last().click();

    await appPage.getByRole('button', { name: 'My Collection' }).click();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Counterspell' })).toBeVisible();

    await appPage.getByPlaceholder(/card name/i).fill('counter');

    await expect(appPage.getByRole('button', { name: 'Counterspell' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeHidden();
  });

  test('says nothing matched when the name filter excludes everything', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Mark as owned' }).first().click();
    await appPage.getByRole('button', { name: 'My Collection' }).click();

    await appPage.getByPlaceholder(/card name/i).fill('zzzzz');

    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeHidden();
  });
});
