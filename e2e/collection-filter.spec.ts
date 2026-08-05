import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The search view can narrow results to cards already in the collection, or to the ones
 * still missing. Ownership is stored per printing in IndexedDB and matched by oracle id,
 * so this journey exercises the whole path: mark a card owned, then filter on it.
 */
test.describe('collection filter on search', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('textbox', { name: 'Search cards...' }).fill('bolt');
    await appPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
  });

  /**
   * The control lives in the advanced-filters panel: it narrows results, unlike the
   * card-size selector it used to sit beside, which is a view option. The panel lays a
   * backdrop over the results, so anything done to a card has to happen first.
   */
  const openCollectionFilter = (page: Page) => page.getByRole('button', { name: 'Advanced Filters' }).click();

  test('defaults to showing everything', async ({ appPage }) => {
    await openCollectionFilter(appPage);
    // Scoped to the group: the rarity filter also offers an "All" option.
    const collection = appPage.getByRole('radiogroup', { name: 'Collection' });
    await expect(collection.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
  });

  test('hides a card once it is owned and the filter asks for what is missing', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Mark as owned' }).click();
    await openCollectionFilter(appPage);

    await appPage.getByRole('radiogroup', { name: 'Collection' }).getByRole('radio', { name: "Don't own" }).click();

    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeHidden();
  });

  test('keeps an owned card when the filter asks for what is owned', async ({ appPage }) => {
    await appPage.getByRole('button', { name: 'Mark as owned' }).click();
    await openCollectionFilter(appPage);

    await appPage.getByRole('radiogroup', { name: 'Collection' }).getByRole('radio', { name: 'Owned' }).click();

    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
  });

  test('shows nothing under "owned" while the collection is empty', async ({ appPage }) => {
    await openCollectionFilter(appPage);
    await appPage.getByRole('radiogroup', { name: 'Collection' }).getByRole('radio', { name: 'Owned' }).click();

    await expect(appPage.getByRole('button', { name: 'Lightning Bolt' })).toBeHidden();
  });
});
