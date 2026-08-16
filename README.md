<div align="center">
<h1>MTG Deck Forge</h1>

Search Magic: The Gathering cards, build and manage decks with [Scryfall](https://scryfall.com/) API integration. Built with **TypeScript**, **React 19**, **Electron**, **Vite 6**, and **Tailwind CSS v4**.
</div>

## Features

- **Card Search** — Advanced filtering by name, colors, types, rarity, and converted mana cost (CMC) using debounced Scryfall search.
- **Oracle Text & Stat Filters** — Search by rules text ("contains" / "doesn't contain"), keyword abilities, community function tags (removal, ramp, tutor, ...), and power/toughness with comparators (`4`, `>=4`, `<2`). Keywords and tags are shown in your language and sent to Scryfall in English; text searches carry your language, so Portuguese and Spanish rules text match too.
- **Personal Collection** — Track how many copies of each printing you own, plus a wishlist, and filter search results by ownership. Virtualized rendering keeps thousands of entries smooth.
- **Per-Copy Printings** — Each copy in a deck is its own entry, so four copies of a card can carry four different editions without merging.
- **Profile Backup & Restore** — Export decks, collection, version history, and settings as a single JSON envelope, and restore it by replacing or merging.
- **Turn-by-Turn Simulation** — Plays the deck alone a thousand times through turn 8, taking London mulligans and tracking colors in play, to report mulligan rate, how often you stall on two lands, turns with a castable play, and the median turn you reach 3/4/5 lands. Complements the Deck Doctor, which scores the opening hand instead.
- **Honest Offline Behaviour** — When the network is gone the app says so, instead of showing an empty result that reads as "nothing found".
- **Two-Pane Deck Editor** — Build with search and decklist side by side, dragging results straight into the deck.
- **Deck Version History** — Every save snapshots the deck; browse past versions with a summary of what changed and restore any of them.
- **Deck Doctor & Card Suggestions** — A consistency score with colour-source diagnosis, plus suggestions that fit the deck being edited.
- **Budget Planner** — Estimate deck price and get a cut list to reach a target budget.
- **Shareable Deck Image** — Render the decklist as a PNG with hero art and stats.
- **Deck Box Covers** — Pick which card's art represents each deck.
- **Isolated Error Recovery** — A failing section renders its own retry instead of taking the whole app down.
- **Card Art & Printing Selector** — Select alternative printings, sets, and artist illustrations for cards directly from the details modal, updating the specific card artwork inside your deck list.
- **Deck Builder & Organizer** — Add, remove, edit, and organize cards in a dedicated workspace deck.
- **Deck Manager** — Save, load, edit, import, and export decks locally via IndexedDB or JSON files (MTG Arena and `.DEC` file exports included).
- **Double-Faced / Transforming Cards** — Flip cards dynamically in the card details modal to see their reverse side with interactive visual rotations and re-calculated attributes (image, P/T, text).
- **Actual-Size MTG Proxy Printing** — Print proxy sheets for offline playtesting. Supports standard sizes (A4, A5, Letter, Legal), orientations (Portrait/Landscape), custom card spacing, cutting guide lines/dotted guides, page yield estimation, and true-to-life size scaling (63mm x 88mm).
- **Dynamic Scryfall API Legality Check** — Real-time validation for Standard, Modern, Vintage, Pauper, and Commander querying the Scryfall API directly, with custom Vintage restricted 1-copy limit checks.
- **Multi-Language Deck Token Management** — Visual deck token organizer. Automatic analyzer scans deck lists for token generators to auto-populate required token sheets. Includes localized search, quick presets for common tokens, and localized oracle card text.
- **Interactive Playtest Simulator** — Realistic playground playmat workspace supporting card drawing, life total tracker, graveyard rescue, battlefield token summoning, and drag-less battlefield positioning (Combat Zone, Support Zone, Spells, and Resource Lands).
- **Active Deck Statistics & Mana Curve** — High-fidelity visual breakdown of your deck's mana curve chart, average CMC (excluding lands), color distribution, and card types division.
- **Fully Localized Interface & Validation** — 100% internationalized UI and validation rules (Commander validation, "Partner", "Friends Forever", "Doctor's Companion", and "Choose a Background") in English, Spanish, and Portuguese.
- **Dark Mode** — Modern dark-mode toggle with automatic local storage persistence.
- **Cross-Platform** — Runs as a native desktop shell (Electron) or in a fast browser sandbox.

## Built With

* [![React][React]][React-url]
* [![Vite][Vite.js]][Vite-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![Electron][Electron.js]][Electron-url]
* [![TailwindCSS][TailwindCSS]][TailwindCSS-url]
* [![ESLint][ESLint]][ESLint-url]

<!-- MARKDOWN LINKS & IMAGES -->
[React]: https://img.shields.io/badge/react-%2320232a.svg\?style\=for-the-badge\&logo\=react\&logoColor\=%2361DAFB
[React-url]: https://react.dev/
[Vite.js]: https://img.shields.io/badge/vite-%23646CFF.svg\?style\=for-the-badge\&logo\=vite\&logoColor\=white
[Vite-url]: https://vitejs.dev
[TypeScript]: https://img.shields.io/badge/typescript-%23007ACC.svg\?style\=for-the-badge\&logo\=typescript\&logoColor\=white
[TypeScript-url]: https://www.typescriptlang.org/
[Electron.js]: https://img.shields.io/badge/Electron-191970\?style\=for-the-badge\&logo\=Electron\&logoColor\=white
[Electron-url]: https://www.electronjs.org/
[TailwindCSS]: https://img.shields.io/badge/tailwindcss-%2338B2AC.svg\?style\=for-the-badge\&logo\=tailwind-css\&logoColor\=white
[TailwindCSS-url]: https://tailwindcss.com/
[ESLint]: https://img.shields.io/badge/ESLint-4B3263\?style\=for-the-badge\&logo\=eslint\&logoColor\=white
[ESLint-url]: https://eslint.org/

## Getting Started

***Installed versions:***

```bash
node -v # 24.15.0
yarn -v # 4.17.1
```

Yarn 4 is pinned through `packageManager` in `package.json`; run `corepack enable` once so the
right version is used. The repository ships a `yarn.lock` only, so use Yarn (not npm) to install.

### Linux dependencies (Electron)

```bash
sudo apt-get install -yq --no-install-recommends libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 libnss3 libgbm-dev
```

### Install dependencies

```bash
corepack enable
yarn install
```

### Develop

```bash
# Electron app with hot reload
yarn dev

# Browser only (no Electron)
yarn dev:web
```

### Build

```bash
yarn build             # renderer + Electron main (dist-vite/ and dist-electron/)
yarn build:web         # browser/PWA bundle
yarn build:win         # Windows installer
yarn build:mac         # macOS installer
yarn build:linux       # Linux installer
yarn dist              # installer for the current platform
yarn run pack          # unpacked desktop app, no installer
```

`pack` needs the explicit `run`: plain `yarn pack` is Yarn's own tarball command, which shadows the
script and silently builds nothing.

`yarn build` compiles into `dist-vite/` and `dist-electron/`. The platform targets and `pack` run
Electron Builder on top of that and write into `dist/`, which is also where `yarn build:web`
publishes; each of them clears `dist/` first, so a desktop package and a web bundle never coexist
there.
See [Electron Builder CLI docs](https://www.electron.build/cli.html) for additional options.

### Tests

```bash
yarn test              # unit + component tests (Vitest)
yarn test:watch        # the same suite in watch mode
yarn test:coverage     # same, enforcing the coverage thresholds in vitest.config.ts
yarn test:e2e          # end-to-end journeys (Playwright)
yarn test:e2e:ui       # the same journeys in Playwright's interactive runner
yarn test:e2e:bench    # collection scale benchmark (add BENCH_PROD=1 for the production bundle)
yarn test:e2e:electron # desktop boot journeys against the real Electron process
```

The E2E suite starts its own dev server on port 5199 and stubs every Scryfall request, so
it needs no network and will not collide with a dev server you already have running. It
drives Chrome locally; CI installs Playwright's own chromium.

`test:e2e:electron` is the exception: it runs the built desktop app instead of a browser, so
it needs `yarn build` first and a display. Without one (Linux with no `DISPLAY` nor
`WAYLAND_DISPLAY`) the project skips itself, and a skip is not evidence.

### Other scripts

```bash
yarn lint:check        # ESLint + Prettier, report only (the gate CI runs)
yarn lint:fix          # the same rules with auto-fix applied
yarn type-check        # TypeScript type check only
yarn i18n:check        # verify en/es/pt share the same key set
yarn readme:check      # verify this file's commands match package.json
yarn deadcode          # unused files/exports/dependencies (knip)
yarn seed:profile      # generate a demo profile (7 decks + collection) to import via Backup
yarn collection:csv    # generate a large real collection CSV (--rows 10000) to import
yarn deps:update       # interactive major dependency updates (taze)
yarn clean             # remove build output folders
```

## Project Structure

```
src/
├── components/   # UI components organized by domain
│   ├── card/     # Card-related components (Search, Grid, Detail Modal, ...)
│   ├── collection/ # Personal collection tab
│   ├── deck/     # Deck management components (List, Editor, Stats, ...)
│   ├── playtest/ # Playtest simulator components (Battlefield, Hand, Log, ...)
│   ├── stats/    # Deck analysis panels (mana curve, mana base, goldfish, ...)
│   └── ui/       # Reusable base components (Dialogs, Toasts, EmptyStates, ...)
├── db/           # Local database configuration (IndexedDB)
├── hooks/        # Custom React hooks (useDeckManager, usePlaytestSimulator, ...)
├── locales/      # i18n translations (en, es, pt)
├── services/     # External integrations and file utilities (Deck imports, etc)
├── store/        # Global state management (Zustand)
├── style/        # Modular CSS (variables, layout, components, ...)
├── types/        # TypeScript types (Card, Deck, Playtest, ...)
└── utils/        # Deck validator, mana symbol helpers
electron/         # Electron main process & preload script
```

## Contributing

Contributions are welcome! To contribute:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request
