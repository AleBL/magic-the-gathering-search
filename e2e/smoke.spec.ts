import { expect, test } from './fixtures';

test('the app boots and lands on the search tab', async ({ appPage }) => {
  await appPage.goto('/');
  await expect(appPage.getByRole('banner')).toBeVisible();
});
