#!/usr/bin/env node
/**
 * Builds a demo profile backup: several decks that exercise different features, plus a
 * collection with overlapping printings.
 *
 * Run it, then import the file through Profile & Settings → Backup → "Restore from a file".
 * That path is deliberate: it populates everything at once *and* exercises the restore flow.
 *
 *   node scripts/seed-profile.mjs [--out seed-profile.json] [--lang pt]
 *
 * Cards are fetched from Scryfall so the decks hold real art, mana costs and legalities —
 * a deck of invented cards would not exercise validation, the mana panels or the simulator.
 */

import { writeFile } from 'node:fs/promises';

const API = 'https://api.scryfall.com';
const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const outFile = readArg('--out', 'seed-profile.json');
const lang = readArg('--lang', 'en');

/** Scryfall asks for ~100ms between requests; being a good citizen keeps this working. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cache = new Map();

async function scryfall(path, attempt = 0) {
  if (cache.has(path)) return cache.get(path);
  await sleep(2500);
  const response = await fetch(`${API}${path}`, {
    headers: { 'User-Agent': 'MTGDeckForge-Seed/1.0', Accept: 'application/json' }
  });

  // Scryfall throttles bursts; back off rather than failing a run that is 90% done.
  if (response.status === 429 && attempt < 6) {
    // Exponential: a throttle that has already tripped needs seconds, not milliseconds.
    const wait = 2000 * 2 ** attempt;
    process.stdout.write(`  … rate limit, waiting ${wait / 1000}s\n`);
    await sleep(wait);
    return scryfall(path, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${path}`);

  const json = await response.json();
  cache.set(path, json);
  return json;
}

/** Sequential map: Promise.all would fire every request at once and trip the rate limit. */
async function eachCard(names, options) {
  const out = [];
  for (const name of names) out.push(await card(name, options));
  return out;
}

/** One named card, in the requested language when a printing exists for it. */
async function card(name, { set } = {}) {
  const query = set ? `?exact=${encodeURIComponent(name)}&set=${set}` : `?exact=${encodeURIComponent(name)}`;
  const found = await scryfall(`/cards/named${query}`);
  if (lang === 'en') return found;
  try {
    const localized = await scryfall(`/cards/${found.set}/${found.collector_number}/${lang}`);
    return localized ?? found;
  } catch {
    return found; // Not every card is printed in every language; English is the honest fallback.
  }
}

/** Distinct printings of one card — for the "four copies, four editions" case. */
async function printings(name, count) {
  const result = await scryfall(`/cards/search?q=${encodeURIComponent(`!"${name}" unique:prints`)}&order=released`);
  return (result.data ?? []).slice(0, count);
}

let counter = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(counter += 1).toString(36)}`;

/** Deck cards need their own instanceId: that is what keeps copies independent. */
const copies = (base, n, mutate = (c) => c) =>
  Array.from({ length: n }, () => mutate({ ...base, instanceId: nextId('inst') }));

async function build() {
  const decks = [];
  const collection = [];
  const say = (msg) => process.stdout.write(`  ${msg}\n`);

  process.stdout.write('\nSearching cards in progress...\n');

  // 1. Burn — modern legal, low curve, healthy mana base
  const bolt = await card('Lightning Bolt');
  const guide = await card('Goblin Guide');
  const swiftspear = await card('Monastery Swiftspear');
  const skewer = await card('Skewer the Critics');
  const mountain = await card('Mountain');
  decks.push({
    id: nextId('deck'),
    name: '01 · Burn (Modern legal)',
    format: 'modern',
    createdAt: new Date().toISOString(),
    cards: [
      ...copies(bolt, 4),
      ...copies(guide, 4),
      ...copies(swiftspear, 4),
      ...copies(skewer, 4),
      ...copies(mountain, 20)
    ]
  });
  say('01 Burn — cool deck, legal in Modern, low curve, healthy mana base');

  // 2. Four editions of the same card — the bug that originated Phase 8.
  const boltPrints = await printings('Lightning Bolt', 4);
  decks.push({
    id: nextId('deck'),
    name: '02 · Four editions of the same card',
    format: 'freeform',
    createdAt: new Date().toISOString(),
    cards: [...boltPrints.map((print) => ({ ...print, instanceId: nextId('inst') })), ...copies(mountain, 16)]
  });
  say(`02 Editions — ${boltPrints.length} distinct printings of Lightning Bolt in the same deck`);

  // 3. Commander — commander marked, 4-color identity
  const commander = await card('Atraxa, Praetors’ Voice').catch(() => card('Atraxa, Praetors’ Voice'));
  const staples = await eachCard(['Sol Ring', 'Arcane Signet', 'Command Tower', 'Swords to Plowshares', 'Cultivate']);
  const basics = await eachCard(['Plains', 'Island', 'Swamp', 'Forest']);
  decks.push({
    id: nextId('deck'),
    name: '03 · Commander (Atraxa)',
    format: 'commander',
    createdAt: new Date().toISOString(),
    coverCardId: commander.id,
    cards: [
      { ...commander, instanceId: nextId('inst'), isCommander: true },
      ...staples.map((c) => ({ ...c, instanceId: nextId('inst') })),
      ...basics.flatMap((b) => copies(b, 8))
    ]
  });
  say('03 Commander — commander marked, 4-color identity');

  // 4. Invalid for the purpose (validation) — restricted in Vintage over the limit, to see the warnings.
  const ancestral = await card('Ancestral Recall');
  const lotus = await card('Black Lotus');
  decks.push({
    id: nextId('deck'),
    name: '04 · Invalid for the purpose (validation)',
    format: 'vintage',
    createdAt: new Date().toISOString(),
    cards: [...copies(ancestral, 4), ...copies(lotus, 2), ...copies(mountain, 10)]
  });
  say('04 Invalid — restricted in Vintage over the limit, to see the warnings');

  // 5. Poor mana base (simulation) — the turn-by-turn simulation should react.
  decks.push({
    id: nextId('deck'),
    name: '05 · Poor mana base (simulation)',
    format: 'freeform',
    createdAt: new Date().toISOString(),
    cards: [...copies(mountain, 8), ...copies(skewer, 26), ...copies(guide, 26)]
  });
  say('05 Poor mana base — 8 lands in 60 cards: mulligan and stall should trigger');

  // 6. Duas faces, split e cartas que geram tokens.
  const dfc = await card('Delver of Secrets // Insectile Aberration').catch(() => card('Delver of Secrets'));
  const split = await card('Fire // Ice').catch(() => null);
  const tokenMaker = await card('Young Pyromancer');
  decks.push({
    id: nextId('deck'),
    name: '06 · Face change, split and tokens',
    format: 'freeform',
    createdAt: new Date().toISOString(),
    cards: [
      ...copies(dfc, 4),
      ...(split ? copies(split, 4) : []),
      ...copies(tokenMaker, 4),
      ...copies(await card('Island'), 20)
    ]
  });
  say('06 Special — DFC (flips on modal), split (rotates), and token generator');

  // 7. Pauper — só commons.
  const pauperCards = await eachCard(['Lightning Bolt', 'Lava Spike', 'Chain Lightning']);
  decks.push({
    id: nextId('deck'),
    name: '07 · Pauper (only commons)',
    format: 'pauper',
    createdAt: new Date().toISOString(),
    cards: [...pauperCards.flatMap((c) => copies(c, 4)), ...copies(mountain, 24)]
  });
  say('07 Pauper — for checking rarity');

  // Collection: multiple printings of the same card, plus one you don't have, to see the
  // "own another edition" reconciliation in the search result.
  const collected = [...boltPrints.slice(0, 2), mountain, guide, swiftspear, ...staples.slice(0, 3)];
  collected.forEach((c, index) => {
    collection.push({
      id: c.id,
      oracleId: c.oracle_id,
      name: c.name,
      set: c.set,
      rarity: c.rarity,
      quantity: (index % 3) + 1,
      wishlist: index === collected.length - 1,
      card: c,
      updatedAt: new Date().toISOString()
    });
  });
  say(`Collection — ${collection.length} entries, including 2 editions of Lightning Bolt`);

  return {
    format: 'mtg-deckforge-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks,
    collection,
    deckVersions: [],
    settings: {}
  };
}

build()
  .then(async (backup) => {
    await writeFile(outFile, JSON.stringify(backup, null, 2), 'utf8');
    const cards = backup.decks.reduce((sum, deck) => sum + deck.cards.length, 0);
    process.stdout.write(
      `\n✅ ${outFile} generated — ${backup.decks.length} decks, ${cards} cards, ${backup.collection.length} collection items.\n\n` +
        `   Import at: Profile & Settings → Backup → "Restore from a file"\n` +
        `   Use "Add to what I have" to not delete your data.\n\n`
    );
  })
  .catch((error) => {
    process.stderr.write(`\n❌ Failed: ${error.message}\n\n`);
    process.exitCode = 1;
  });
