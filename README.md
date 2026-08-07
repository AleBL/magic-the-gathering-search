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
- **Goldfish Mana Simulation** — Plays the deck alone a thousand times to report mulligan rate, mana screw, turns with a play, and the median turn you reach 3/4/5 lands — answering what the closed-form probability panels cannot.
- **Honest Offline Behaviour** — When the network is gone the app says so, instead of showing an empty result that reads as "nothing found".
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
npm  -v # 11.12.1
```

### Linux dependencies (Electron)

```bash
sudo apt-get install -yq --no-install-recommends libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 libnss3 libgbm-dev
```

### Install dependencies

```bash
npm install
# OR
yarn install
```

### Develop

```bash
# Electron app with hot reload
npm run dev

# Browser only (no Electron)
bash dev-web.sh
```

### Build

```bash
npm run build          # default build
npm run build:win      # Windows target
npm run build:mac      # macOS target
npm run build:linux    # Linux target
```

Distributable files are generated in `dist-vite/` and `dist-electron/`.
See [Electron Builder CLI docs](https://www.electron.build/cli.html) for additional options.

### Tests

```bash
npm run test           # unit + component tests (Vitest)
npm run test:coverage  # same, enforcing the coverage thresholds in vitest.config.ts
npm run test:e2e       # end-to-end journeys (Playwright)
npm run test:e2e:ui    # the same journeys in Playwright's interactive runner
npm run test:e2e:bench # collection scale benchmark (add BENCH_PROD=1 for the production bundle)
```

The E2E suite starts its own dev server on port 5199 and stubs every Scryfall request, so
it needs no network and will not collide with a dev server you already have running. It
drives Chrome locally; CI installs Playwright's own chromium.

### Other scripts

```bash
npm run lint           # ESLint + Prettier auto-fix
npm run type-check     # TypeScript type check only
npm run i18n:check     # verify en/es/pt share the same key set
npm run deadcode       # unused files/exports/dependencies (knip)
npm run deps:update    # interactive major dependency updates (taze)
npm run clean          # remove build output folders
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
