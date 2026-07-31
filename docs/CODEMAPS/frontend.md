<!-- Generated: 2026-07-15 | Files scanned: 40+ components | Token estimate: ~1000 -->

# Frontend Component Map

## Component Hierarchy

```
App.tsx (root)
├── RootLayout
│   ├── Header
│   │   ├── SearchBar (part of CardSearch)
│   │   ├── ProfileMenu
│   │   ├── CommandPalette
│   │   └── AppShortcutsOverlay
│   │
│   ├── Tab: Search
│   │   └── CardSearch
│   │       ├── SearchFilters
│   │       ├── CardGrid
│   │       └── CardDetailsModal
│   │           ├── PrintingSelector
│   │           ├── DoubleFacedCardFlipper
│   │           └── CardLegalityBadge
│   │
│   └── Tab: Deck
│       ├── EditingDeckBanner (conditional)
│       ├── DeckManager
│       │   ├── DeckList
│       │   ├── DeckPreview
│       │   ├── DeckStats
│       │   │   └── ManaCurveChart (Recharts)
│       │   ├── DeckValidationBadge
│       │   ├── DeckSaveDialog
│       │   ├── DeckProxyPrint
│       │   └── PlaytestSimulator
│       │       ├── PlaytestTokenModal
│       │       ├── PlaytestParticles
│       │       └── ScrySurveilModal
│       └── PileExplorerModal (when exploring card piles)
```

## State Management

### **Global State (Zustand: useDeckStore)**
```
DeckStoreState {
  currentDeck: Card[]
  currentDeckRelatedTokens: DeckRelatedToken[]
  editingDeck: EditingDeckState {
    deckId: string | null
    deckName: string
    deckFormat: DeckFormat
    deckNotes?: string
  }
  pendingAction: string | null ('save-deck' | 'playtest-deck' | 'clear-deck' | null)
  
  // Mutations
  setCurrentDeck()
  addCard()
  removeCard()
  updateCard()
  toggleCommander()
  loadDeckToEdit()
  cancelEdit()
  setPendingAction()
}
```

### **Local Component State (Hooks)**
- **useCardSearch**: search query, filters, API results, debouncing
- **usePlaytestSimulator**: hand state, life total, battlefield zones, log history
- **useDeckManager**: load/save UI state, export format selection
- **useToast**: message queue, variant (success/error/info), auto-dismiss
- **useDialog**: modal open/close state, form data

## Hook Dependency Map

```
CardSearch Component
├── useCardSearch() → Scryfall API (debounced)
├── useCardPrints() → Fetch alternative printings
├── useCardRelatedTokens() → Find related tokens
├── useTranslation() → i18next
└── useToast() → Toast notifications

DeckManager Component
├── useDeckManager() → Load/save/export operations
├── useDeckActions() → Add/remove card handlers
├── useDeckTokens() → Populate related tokens
├── useDeckValidator() → Format legality checks
└── useDeckTextImport() → Parse MTG Arena format

PlaytestSimulator Component
├── usePlaytestSimulator() → Full playtest state machine
├── useProxyPrint() → Proxy sheet generation
├── useTokenHandlers() → Token summon logic
└── usePlaytestSimulator.test() → Unit tests

DeckStats Component
└── recharts for mana curve visualization
```

## Modals & Overlays

| Component | Trigger | Purpose |
|-----------|---------|---------|
| CardDetailsModal | Click card in search grid | Show card image, printing options, legality |
| DeckSaveDialog | "Save Deck" action | Format selection, name input, save to DB |
| PlaytestTokenModal | Click token button in playtest | List deck-related tokens, select quantity |
| ScrySurveilModal | Playtest "scry" action | Reorder top-deck cards |
| PileExplorerModal | Click pile stat in DeckStats | Deep-dive card grouping by type |
| AppShortcutsOverlay | Press Cmd+? | Display keyboard shortcuts |
| CommandPalette | Press Cmd+K | Quick actions (save, playtest, export) |

## Data Flow: Add Card to Deck

```
CardSearch Component
  │
  └─→ useCardSearch() fetches Scryfall data
      │
      ├─→ User clicks "Add to Deck"
      │   │
      │   └─→ useDeckActions.handleAddToDeck()
      │       │
      │       ├─→ useDeckStore.addCard()
      │       │   └─→ State update (optimistic)
      │       │
      │       ├─→ useDeckManager saves to IndexedDB
      │       │   └─→ Dexie write
      │       │
      │       ├─→ useDeckTokens scans for related tokens
      │       │   └─→ useDeckStore.setCurrentDeckRelatedTokens()
      │       │
      │       └─→ useToast shows success message
```

## Translation Architecture (i18n)

- **Plugin**: src/plugins/i18n.ts → i18next + react-i18next
- **Locales**: src/locales/
  - en.ts (English)
  - es.ts (Spanish)
  - pt.ts (Portuguese)
- **Usage**: `const { t, i18n } = useTranslation()`
- **Namespaces**: cards, deck, playtest, validation, ui

## Icon Library

- **react-icons**: Lucide and FontAwesome icons
- Used in: Header, buttons, status badges, playtest UI

## Styling

- **Tailwind CSS v4** (utility-first)
- **Dark mode**: Toggle via useDarkMode hook, persisted under `STORAGE_KEYS.darkMode`
  (`src/constants/storage.ts` — the single registry for every localStorage key)
- **Custom CSS**: src/style/ for global variables and components
- **Responsive**: Mobile-first breakpoints (sm, md, lg, xl)
