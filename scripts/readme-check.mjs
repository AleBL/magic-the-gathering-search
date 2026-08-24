#!/usr/bin/env node
/**
 * README command checker for MTG Deck Forge.
 *
 * Usage:
 *   node scripts/readme-check.mjs        # report only
 *   node scripts/readme-check.mjs --ci   # exit non-zero when README and package.json disagree
 *
 * Issue 07-P2.3 fixed a README full of commands that did not exist. Nothing stopped it
 * happening again: a renamed script leaves the instruction behind, and a new one lands
 * undocumented. This closes both directions.
 *
 * Two failures are reported:
 *   - broken: the README tells the reader to run a script package.json does not define.
 *   - undocumented: package.json defines a script the README never mentions.
 *
 * `node scripts/<file>` references are checked against the filesystem for the same reason.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit, stdout, stderr } from 'node:process';
import { Console } from 'node:console';

const console = new Console(stdout, stderr);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CI = argv.slice(2).includes('--ci');

/**
 * Yarn's own subcommands. `yarn install` is not a script and never will be, so seeing one
 * here is not a broken instruction. `pack` is in the list for the opposite reason: it shadows
 * any script of that name, which is why the README names the app packager `pack:app` and then
 * has to mention the builtin to explain itself.
 */
const YARN_BUILTINS = new Set([
  'install',
  'add',
  'remove',
  'up',
  'why',
  'init',
  'dlx',
  'node',
  'npm',
  'link',
  'unlink',
  'config',
  'info',
  'cache',
  'workspaces',
  'workspace',
  'set',
  'plugin',
  'pack',
  'version'
]);

/**
 * Scripts deliberately absent from the README, each because the reader reaches it through
 * another one that is documented. Keep this list short: it is the escape hatch, and every
 * entry is a command a contributor cannot discover from the docs.
 */
const INTERNAL_SCRIPTS = new Map([
  ['build:vite', 'sub-step of `yarn build`'],
  ['build:electron', 'sub-step of `yarn build`'],
  ['lint', 'alias of `yarn lint:fix`, which is documented']
]);

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const scripts = new Set(Object.keys(pkg.scripts ?? {}));

/**
 * Every `yarn <thing>` in the file, fenced or inline. `yarn run <script>` is the same command
 * as `yarn <script>`, and a leading env assignment (`ELECTRON_E2E=1 yarn test:e2e`) is still an
 * instruction to run that script.
 */
const mentioned = new Map();
for (const match of readme.matchAll(/\byarn\s+(?:run\s+)?([a-zA-Z][\w:.-]*)/g)) {
  const line = readme.slice(0, match.index).split('\n').length;
  if (!mentioned.has(match[1])) mentioned.set(match[1], line);
}

const scriptReferences = new Map();
for (const match of readme.matchAll(/\bnode\s+(scripts\/[\w.-]+)/g)) {
  const line = readme.slice(0, match.index).split('\n').length;
  if (!scriptReferences.has(match[1])) scriptReferences.set(match[1], line);
}

const broken = [...mentioned].filter(([name]) => !YARN_BUILTINS.has(name) && !scripts.has(name));
const missingFiles = [...scriptReferences].filter(([path]) => !existsSync(join(ROOT, path)));
const undocumented = [...scripts].filter((name) => !mentioned.has(name) && !INTERNAL_SCRIPTS.has(name)).sort();

console.log('README command check');
console.log(`  package.json scripts: ${scripts.size}`);
console.log(`  yarn commands cited in README: ${mentioned.size}`);

if (broken.length) {
  console.log(`\n  BROKEN, cited but not defined in package.json (${broken.length}):`);
  for (const [name, line] of broken) console.log(`    - yarn ${name}  (README.md:${line})`);
}

if (missingFiles.length) {
  console.log(`\n  MISSING FILE, cited but not on disk (${missingFiles.length}):`);
  for (const [path, line] of missingFiles) console.log(`    - ${path}  (README.md:${line})`);
}

if (undocumented.length) {
  console.log(`\n  UNDOCUMENTED, defined but never mentioned in the README (${undocumented.length}):`);
  for (const name of undocumented) console.log(`    - yarn ${name}`);
  console.log('    Document it, or add it to INTERNAL_SCRIPTS in this file with the reason.');
}

if (INTERNAL_SCRIPTS.size) {
  console.log(`\n  undocumented on purpose (${INTERNAL_SCRIPTS.size}):`);
  for (const [name, reason] of INTERNAL_SCRIPTS) console.log(`    - ${name}: ${reason}`);
}

const failures = broken.length + missingFiles.length + undocumented.length;
if (failures === 0) console.log('\n  ✓ every documented command exists and every script is documented');

if (CI && failures > 0) exit(1);
