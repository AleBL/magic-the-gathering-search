import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { seedDecks } from './seed';

/**
 * The `.dec` export writes a file through the browser's own download path, which no unit test
 * reaches: `deckToDecText` can be right while the download never fires.
 */
test.describe('deck export', () => {
  test('exporting a deck as .dec downloads the MTGO card list', async ({ appPage }) => {
    await appPage.setViewportSize({ width: 1280, height: 900 });
    await appPage.goto('/');
    // Dexie must create the stores before the seed can write to them.
    await appPage.getByRole('button', { name: 'My Decks' }).click();
    await seedDecks(appPage, ['Export Me']);
    await appPage.reload();
    await appPage.getByRole('button', { name: 'My Decks' }).click();

    const exportButton = appPage.getByRole('button', { name: /^Export Export Me$/i }).first();
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const download = await Promise.all([
      appPage.waitForEvent('download'),
      dialog.getByRole('button', { name: /DEC \(MTGO\)/i }).click()
    ]).then(([event]) => event);

    expect(download.suggestedFilename()).toBe('Export_Me.dec');

    const path = await download.path();
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('// Export Me');
    expect(content).toContain('1 Lightning Bolt');
  });
});
