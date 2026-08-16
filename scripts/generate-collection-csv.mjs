#!/usr/bin/env node
/**
 * Builds a large, real collection CSV in the format the app's Collection importer accepts.
 *
 *   node scripts/generate-collection-csv.mjs [--rows 10000] [--out collection-large.csv]
 *                                            [--query "game:paper"]
 *
 * Real printings, not invented rows: RR-18 in docs/issues-roadmap/16-RESIDUAL-RISK-REGISTER.md
 * is about what the import does to Scryfall when the file is big, and identifiers that
 * resolve to nothing would exercise the miss path instead of the fan-out. Each row carries
 * a real name, set code, collector number and Scryfall id, so every one of them resolves.
 *
 * The file is written to the repo root and is gitignored: 10k rows is ~700 KB of data that
 * belongs in a run, not in history.
 */

import { writeFile } from 'node:fs/promises';

const API = 'https://api.scryfall.com';
const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const rows = Number(readArg('--rows', '10000'));
const outFile = readArg('--out', 'collection-large.csv');
const query = readArg('--query', 'game:paper');

/** Scryfall asks for ~100ms between requests; being a good citizen keeps this working. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Same rule as `escapeCsv` in src/services/collectionCsv.ts (RFC 4180). */
const escapeCsv = (value) => (/[",\r\n]/.test(value) ? `"${String(value).replace(/"/g, '""')}"` : String(value));

/**
 * `unique=prints` is the point: a collection holds printings, and several copies of the
 * same card across editions is exactly the shape that makes the importer resolve by
 * set+number rather than by name.
 */
async function fetchPrintings(total) {
  const cards = [];
  let page = 1;

  while (cards.length < total) {
    const url = `${API}/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=released&page=${page}`;
    // Scryfall answers 400 to a request with no User-Agent, which is what Node's fetch sends
    // by default.
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MTGDeckForge-CollectionCsv/1.0', Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Scryfall answered ${response.status} for page ${page}`);

    const json = await response.json();
    for (const card of json.data ?? []) {
      // A printing with no collector number cannot be looked up by set+number later.
      if (!card.id || !card.name || !card.set) continue;
      cards.push(card);
    }

    process.stdout.write(`\r  page ${page}, ${cards.length} printings`);
    if (!json.has_more) break;
    page += 1;
    await sleep(120);
  }

  process.stdout.write('\n');
  return cards.slice(0, total);
}

/**
 * Quantities and wishlist flags follow the index rather than `Math.random`, so two runs over
 * the same query produce the same file and a measurement can be repeated.
 */
function toCsv(cards) {
  const lines = ['Name,Set,Collector Number,Quantity,Wishlist,Scryfall ID'];
  cards.forEach((card, index) => {
    lines.push(
      [
        escapeCsv(card.name),
        escapeCsv(card.set),
        escapeCsv(card.collector_number ?? ''),
        String((index % 4) + 1),
        index % 7 === 0 ? 'true' : 'false',
        escapeCsv(card.id)
      ].join(',')
    );
  });
  return lines.join('\n');
}

async function main() {
  console.log(`Fetching ${rows} real printings from Scryfall (${query})`);
  const cards = await fetchPrintings(rows);

  const csv = toCsv(cards);
  await writeFile(outFile, csv, 'utf8');

  const bytes = Buffer.byteLength(csv, 'utf8');
  const distinctSets = new Set(cards.map((card) => card.set)).size;
  console.log(`Wrote ${outFile}`);
  console.log(`  rows: ${cards.length}`);
  console.log(`  distinct sets: ${distinctSets}`);
  console.log(`  size: ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`  chunks the importer will POST (75 per request): ${Math.ceil(cards.length / 75)}`);
  console.log(`\nImport it through Collection → tools → import CSV.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
