<!-- Generated: 2026-08-18 | Files scanned: 40+ components | Token estimate: ~1000 -->

# Frontend Component Map

## Component Hierarchy

```
App.tsx (root)
├── RootLayout
│   ├── Header
│   │   ├── SearchBar (part of CardSearch)
│   │   ├── ProfileMenu
│   │   │   ├── ProfileMenuBackHeader
│   │   │   ├── ProfileMenuMainSection
│   │   │   ├── ProfileMenuLanguageSection
│   │   │   ├── ProfileMenuBackupSection
│   │   │   ├── ProfileMenuAboutSection
│   │   │   └── ProfileMenuHelpSection
│   │   ├── CommandPalette
│   │   └── AppShortcutsOverlay
│   │
│   ├── Tab: Search
│   │   └── CardSearch
│   │       ├── SearchFilters
│   │       ├── CardGrid
│   │       └── CardDetailModal
│   │           ├── CardDetailImagePanel
│   │           ├── CardDetailData
│   │           ├── CardDetailActions
│   │           ├── CardDetailEditControls
│   │           ├── CardDetailRelatedTokens
│   │           ├── CardDetailPrintsSidebar   (printing/language picker)
│   │           └── FlipCard                  (double-faced card flip)
│   │
│   └── Tab: Deck
│       ├── EditingDeckBanner (conditional)
│       ├── DeckManager
│       │   ├── DeckManagerToolbar
│       │   ├── DeckManagerDeckListLayout
│       │   ├── DeckManagerModals
│       │   ├── DeckList
│       │   ├── DeckPreview
│       │   │   ├── DeckPreviewNoteTabs
│       │   │   └── DeckPreviewZoneCards
│       │   ├── DeckStats
│       │   │   └── ManaCurveChart (Recharts)
│       │   ├── DeckValidationBadge
│       │   ├── DeckSaveDialog
│       │   ├── DeckProxyPrint
│       │   └── PlaytestSimulator
│       │       ├── PlaytestModals
│       │       │   └── PlaytestBattlefieldContextMenu
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

Components depend on orchestrating hooks only. A hook folder (`hooks/deck/`,
`hooks/playtest/`, …) is that hook's insides and is not imported from a component.

```
CardSearch Component
├── useCardSearch() → Scryfall API (debounced)
│   └── hooks/search/: useCardSearchPaging, useScryfallEmitters
├── useCardPrints() → Fetch alternative printings (utils/cardPrints)
├── useCardRelatedTokens() → Find related tokens
├── useTranslation() → i18next
└── useToast() → Toast notifications

DeckManager Component
├── useDeckManager() → Load/save/export operations
│   └── hooks/deck/: useDeckExport, useDeckFileImport, useDeckRecords,
│                    useDeckSaving, useDeckValidation, useImportProgressModal
├── useDeckActions() → Add/remove card handlers
├── useDeckTokens() → Populate related tokens
│   └── hooks/tokens/: useDeckTokenAnalysis, useDeckTokenList,
│                      useTokenPresets, useTokenSearch
├── useDeckTextImport() → Parse MTG Arena format
├── useDeckInfoEditor() → Name/format/notes editing
├── useSuggestedLands() → Mana base suggestions
└── usePendingAction() → Command channel

PlaytestSimulator Component
├── usePlaytestSimulator() → Full playtest state machine
│   └── hooks/playtest/: Zones, Library, Battlefield, CardMoves, Mulligan,
│                        Turn, Life, Log, History, FaceChoice
│       └── utils/playtestBoard → pure zone transitions
├── useProxyPrint() → Proxy sheet generation
│   └── hooks/print/useProxyPrintRoutine → utils/proxyPrintLayout
└── useTokenHandlers() → Token summon logic

DeckStats Component
└── recharts for mana curve visualization
```

## Modals & Overlays

| Component | Trigger | Purpose |
|-----------|---------|---------|
| CardDetailModal | Click card in search grid | Show card image, printing options, legality |
| DeckSaveDialog | "Save Deck" action | Format selection, name input, save to DB |
| PlaytestTokenModal | Click token button in playtest | List deck-related tokens, select quantity |
| ScrySurveilModal | Playtest "scry" action | Reorder top-deck cards |
| PileExplorerModal | Click pile stat in DeckStats | Deep-dive card grouping by type |
| AppShortcutsOverlay | Press Cmd+? | Display keyboard shortcuts |
| CommandPalette | Press Cmd+K | Quick actions (save, playtest, export) |
| DeckCoverModal | Deck box → cover picker | Choose which card's art represents the deck |
| DeckVersionHistoryModal | Deck actions → history | Restore or compare past snapshots |
| DeckSuggestionsModal | Deck actions → suggestions | Cards that fit the deck being edited |
| DeckStatsModal | Deck actions → stats | All analysis panels in a wide modal |
| AllDecksModal | "View all decks" | Grid of every saved deck |
| DeckTextImportModal | Import / Export → text | Paste an Arena/.DEC list |
| BottomSheet | Filters on a phone | Drag-to-close sheet; body scrolls, handle stays |

Every modal traps focus (`useFocusTrap`), is dismissed by Escape (`useEscapeKey`) and carries
`role="dialog"` + `aria-modal`. Escape is read from a ref so one dialog's re-render cannot
unhook another's listener mid-dispatch.

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
