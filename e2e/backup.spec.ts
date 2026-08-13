import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { seedCollection, seedDecks } from './seed';

/**
 * The round trip against a real IndexedDB and a real Dexie transaction. The unit tests
 * stand a fake database in; this is the one that would catch the transaction itself being
 * wrong — which is the failure this feature exists to prevent.
 */

const DECKS = ['Atraxa Superfriends', 'Krenko Goblins'];
const COLLECTION_SIZE = 25;

async function openBackupPanel(page: Page) {
  await page.getByRole('button', { name: 'Profile & Settings' }).click();
  await page.getByRole('menuitem', { name: 'Backup' }).click();
}

/** Scoped to the menu: the deck tab has a file input of its own. */
const backupFileInput = (page: Page) => page.getByRole('menu').locator('input[type="file"]');

test.describe('profile backup', () => {
  test('a backup restores decks and collection after the database is destroyed', async ({ appPage }) => {
    await appPage.goto('/');
    // Dexie has to create the object stores before raw IndexedDB writes can find them.
    await appPage.getByRole('button', { name: 'Collection' }).click();
    await appPage.waitForTimeout(500);
    await seedCollection(appPage, COLLECTION_SIZE);
    await seedDecks(appPage, DECKS);
    await appPage.reload();

    await openBackupPanel(appPage);
    const download = await Promise.all([
      appPage.waitForEvent('download'),
      appPage.getByRole('button', { name: 'Export backup' }).click()
    ]).then(([event]) => event);
    const backupFile = await download.path();

    // The disaster this guards against: the origin's storage is gone.
    await appPage.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase('MagicDecksDB');
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        })
    );
    await appPage.reload();

    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await expect(appPage.getByText(DECKS[0], { exact: false })).toHaveCount(0);

    await openBackupPanel(appPage);
    await backupFileInput(appPage).setInputFiles(backupFile);
    await expect(appPage.getByRole('button', { name: 'Replace everything' })).toBeVisible();
    await appPage.getByRole('button', { name: 'Replace everything' }).click();
    await appPage.getByRole('button', { name: 'Yes, delete and replace' }).click();

    await expect(appPage.getByText(/Restored 2 decks/)).toBeVisible();

    await appPage.reload();
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    for (const name of DECKS) {
      await expect(appPage.getByText(name, { exact: false }).first()).toBeVisible();
    }

    await appPage.getByRole('button', { name: 'Collection' }).click();
    await expect(appPage.getByRole('button', { name: /Owned/ })).toContainText(String(COLLECTION_SIZE));
  });

  test('a file that is not a backup is refused without touching the profile', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await appPage.waitForTimeout(500);
    await seedDecks(appPage, DECKS);
    await appPage.reload();

    await openBackupPanel(appPage);
    await backupFileInput(appPage).setInputFiles({
      name: 'not-a-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ some: 'other app' }))
    });

    await expect(appPage.getByText('That is not a Deck Forge backup file')).toBeVisible();
    // No restore controls appear, so there is nothing to click by mistake.
    await expect(appPage.getByRole('button', { name: 'Replace everything' })).toHaveCount(0);

    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await expect(appPage.getByText(DECKS[0], { exact: false }).first()).toBeVisible();
  });
});
