import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * `DeckDoctorPanel` is the largest component in the tree with no test of any kind: it renders
 * a diagnosis (consistency score, opening-hand simulation, land odds, recommendations) that a
 * player acts on, and a wrong number there looks exactly like a right one. `deckDoctor.ts` is
 * unit-tested, but nothing proved the report reaches the screen, so a broken prop or a lazy
 * chunk that never resolves would have shipped silently.
 *
 * These pin the panel's three observable states: too little data, a diagnosis rendered, and a
 * recommendation that reacts to the deck rather than being static text.
 */

/** analyzeDeck only reports once a deck holds a full opening hand (7 cards). */
const OPENING_HAND = 7;

type SeedCard = { name: string; type_line: string; cmc: number; mana_cost: string };

const spell = (index: number): SeedCard => ({
  name: `Goblin Recruit ${index}`,
  type_line: 'Creature — Goblin',
  cmc: 2,
  mana_cost: '{1}{R}'
});

const mountain = (index: number): SeedCard => ({
  name: `Mountain ${index}`,
  type_line: 'Basic Land — Mountain',
  cmc: 0,
  mana_cost: ''
});

async function seedDeckWithCards(page: Page, deckName: string, cards: SeedCard[]) {
  await page.evaluate(
    async ({ deckName: name, cards: seedCards }) => {
      const database: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open('MagicDecksDB');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('decks', 'readwrite');
        transaction.objectStore('decks').put({
          id: 'doctor-deck',
          name,
          format: 'freeform',
          cards: seedCards.map((card, index) => ({
            ...card,
            id: `doctor-card-${index}`,
            instanceId: `doctor-instance-${index}`
          })),
          createdAt: new Date(2026, 0, 1).toISOString()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    },
    { deckName, cards }
  );
}

/** Dexie must create the stores before the seed can write, so the tab is opened first. */
async function openDoctorFor(page: Page, deckName: string, cards: SeedCard[]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'My Decks' }).click();
  await seedDeckWithCards(page, deckName, cards);
  await page.reload();
  await page.getByRole('button', { name: 'My Decks' }).click();

  await page.getByText(deckName, { exact: true }).first().click();
  await page.getByRole('button', { name: /Deck Statistics/i }).click();
}

test.describe('Deck Doctor', () => {
  test('renders the full diagnosis for a deck with a complete opening hand', async ({ appPage }) => {
    const cards = [
      ...Array.from({ length: 14 }, (_, index) => spell(index)),
      ...Array.from({ length: 10 }, (_, index) => mountain(index))
    ];
    await openDoctorFor(appPage, 'Doctor Full', cards);

    // By role, not by text: the Playout panel names the Deck Doctor in its own description,
    // so a text query matches two nodes and the heading is the one that identifies the panel.
    await expect(appPage.getByRole('heading', { name: 'Deck Doctor' })).toBeVisible();

    // The four sections a diagnosis is made of. Their absence is how a broken report hides:
    // the panel still renders its heading while the body silently collapses.
    await expect(appPage.getByText('Consistency score')).toBeVisible();
    await expect(appPage.getByText('Opening-hand simulation')).toBeVisible();
    await expect(appPage.getByText(/Land odds/i)).toBeVisible();
    await expect(appPage.getByText('Recommendations')).toBeVisible();

    // A score is a percentage, not a blank frame.
    await expect(appPage.getByText(/\d+%/).first()).toBeVisible();
  });

  test('asks for more cards when the deck cannot fill an opening hand', async ({ appPage }) => {
    const cards = Array.from({ length: OPENING_HAND - 1 }, (_, index) => spell(index));
    await openDoctorFor(appPage, 'Doctor Thin', cards);

    await expect(appPage.getByRole('heading', { name: 'Deck Doctor' })).toBeVisible();
    await expect(appPage.getByText(/Add more cards to run a full diagnosis/i)).toBeVisible();

    // The diagnosis must not be half-rendered next to the empty state.
    await expect(appPage.getByText('Opening-hand simulation')).toBeHidden();
  });

  test('recommends adding lands to a deck that has none', async ({ appPage }) => {
    const cards = Array.from({ length: 20 }, (_, index) => spell(index));
    await openDoctorFor(appPage, 'Doctor Landless', cards);

    // The point of the panel: the advice reacts to this deck. A landless deck that gets
    // "balanced" back is the failure this test exists to catch, and it is invisible without it.
    await expect(appPage.getByText(/more lands/i)).toBeVisible();
  });
});
