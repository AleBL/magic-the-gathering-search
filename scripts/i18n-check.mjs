#!/usr/bin/env node
/**
 * i18n hygiene checker for MTG Deck Forge.
 *
 * Usage:
 *   node scripts/i18n-check.mjs            # sync check (en/es/pt must share the same keys)
 *   node scripts/i18n-check.mjs --orphans  # additionally list keys never referenced in src
 *   node scripts/i18n-check.mjs --ci       # exit non-zero when the locales are out of sync
 *
 * The locale files are plain object literals (`const en = {...}; export default en;`),
 * so they are loaded by re-exporting them through a data: URL — no TS build step needed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit, stdout, stderr } from 'node:process';
import { Console } from 'node:console';

const console = new Console(stdout, stderr);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOCALES_DIR = join(ROOT, 'src/locales');
const SRC_DIR = join(ROOT, 'src');
const LANGS = ['en', 'es', 'pt'];

const args = new Set(argv.slice(2));
const WANT_ORPHANS = args.has('--orphans');
const CI = args.has('--ci');

/** Load a locale `.ts` object literal without a TS build step. */
async function loadLocale(lang) {
  const code = readFileSync(join(LOCALES_DIR, `${lang}.ts`), 'utf8')
    .replace(/export\s+default\s+\w+;?\s*$/, '')
    .replace(/^const\s+\w+\s*=/, 'export default');
  const url = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code);
  return (await import(url)).default;
}

/** Flatten a nested object into a map of dot-path -> leaf value. */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out);
    else out.set(path, v);
  }
  return out;
}

/** Recursively collect source files, skipping the locale definitions themselves. */
function collectSources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full === LOCALES_DIR) continue;
    if (statSync(full).isDirectory()) collectSources(full, out);
    else if (['.ts', '.tsx'].includes(extname(entry))) out.push(full);
  }
  return out;
}

async function main() {
  const flat = {};
  for (const lang of LANGS) flat[lang] = flatten((await loadLocale(lang)).translations);
  const keys = Object.fromEntries(LANGS.map((l) => [l, new Set(flat[l].keys())]));

  const union = new Set();
  for (const l of LANGS) for (const k of keys[l]) union.add(k);

  // --- Sync check --------------------------------------------------------
  let outOfSync = false;
  console.log('i18n sync check');
  for (const l of LANGS) console.log(`  ${l}: ${keys[l].size} keys`);
  for (const l of LANGS) {
    const missing = [...union].filter((k) => !keys[l].has(k)).sort();
    if (missing.length) {
      outOfSync = true;
      console.log(`\n  MISSING in ${l} (${missing.length}):`);
      for (const k of missing) console.log(`    - ${k}`);
    }
  }
  if (!outOfSync) console.log('  ✓ all locales share the same key set');

  // --- Orphan check ------------------------------------------------------
  if (WANT_ORPHANS) {
    const sources = collectSources(SRC_DIR).map((f) => readFileSync(f, 'utf8'));
    const blob = sources.join('\n');

    // Any dotted string literal anywhere in src counts as a possible reference.
    // Conservative on purpose: over-keeping a key is safe, wrongly removing one is not.
    const literals = new Set();
    for (const m of blob.matchAll(/['"]([a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+)['"]/g)) literals.add(m[1]);

    // Static prefixes of dynamically built keys, e.g. t(`playtest.${zone}`).
    const dynamicPrefixes = new Set();
    for (const m of blob.matchAll(/[^.\w]t\(`([a-zA-Z][\w.]*?)\.\$\{/g)) dynamicPrefixes.add(m[1]);

    const isDynamic = (key) => [...dynamicPrefixes].some((p) => key === p || key.startsWith(p + '.'));

    // i18next resolves plurals by appending a suffix to the base key at runtime,
    // so `t('stats.nLands', { count })` reaches `stats.nLands_one`/`_other`.
    // Treat a suffixed key as used when its base is referenced.
    const PLURAL_SUFFIXES = /_(zero|one|two|few|many|other|plural)$/;
    const isPluralOf = (key) => {
      if (!PLURAL_SUFFIXES.test(key)) return false;
      const base = key.replace(PLURAL_SUFFIXES, '');
      return literals.has(base);
    };

    const orphans = [...union].filter((k) => !literals.has(k) && !isDynamic(k) && !isPluralOf(k)).sort();

    console.log(`\ni18n orphan check`);
    console.log(`  dynamic prefixes (kept): ${[...dynamicPrefixes].sort().join(', ') || '(none)'}`);
    if (orphans.length) {
      console.log(`  orphan candidates (${orphans.length}):`);
      for (const k of orphans) console.log(`    - ${k}`);
    } else {
      console.log('  ✓ no orphan keys found');
    }
  }

  if (CI && outOfSync) exit(1);
}

main().catch((err) => {
  console.error(err);
  exit(2);
});
