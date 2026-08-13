<!-- Generated: 2026-07-15 | Files scanned: 50+ | Token estimate: ~1200 -->

# MTG Deck Forge — Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React UI Layer                         │
│  (Components: Search, Deck, Playtest, Stats, Modals)       │
└──────────────┬──────────────────────────────────────────────┘
               │
        ┌──────┴──────┬──────────────┐
        │             │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼──────┐
   │  Zustand│   │  Hooks   │   │ Services  │
   │  Store  │   │ (Custom) │   │ (APIs)    │
   └────┬────┘   └────┬────┘   └────┬──────┘
        │             │             │
        │        ┌────┴─────────────┴──┐
        │        │                     │
   ┌────▼────────▼─┐            ┌──────▼──────┐
   │   IndexedDB   │            │  Scryfall   │
   │   (Dexie)     │            │  API        │
   │  - Decks      │            │             │
   │  - Cards      │            └─────────────┘
   └───────────────┘
```

## Core Layers

### **Presentation Layer (React Components)**
- **Card**: Search, Grid, VirtualizedCardGrid, Details Modal, Printing Selector, DFC Flip, SearchFilters, CollectionFilterSelector
- **Collection**: CollectionManager — owned printings + wishlist, windowed grid
- **Deck**: DeckManager, DeckEditWorkspace (two-pane editor), DeckList, SavedDecksPanel, AllDecksModal, DeckPreview, DeckCoverModal, DeckVersionHistoryModal, DeckSuggestionsModal, DeckValidationBadge
- **Stats**: DeckStats + panels (ManaCurve, ColorDistribution, TypesBreakdown, ManaBaseOptimizer, ManaPipAnalysis, DeckDoctor, Playout, BudgetEstimator, Rarity)
- **Playtest**: PlaytestSimulator, Battlefield, Hand, TokenModal, Particles, PileExplorer, ScrySurveil
- **Settings**: BackupPanel — storage usage, persistence request, export/restore
- **UI**: Dialogs, Toasts, Command Palette, Shortcuts Overlay, BottomSheet, ErrorBoundary
- **Layout**: RootLayout, Header, ProfileMenu

### **State Management Layer (Zustand)**
- **useDeckStore** → Deck state (currentDeck, editingDeck, tokens, format, name, notes)
- Immutable updates: addCard, removeCard, updateCard, toggleCommander, clearDeck

### **Custom Hooks Layer**
- **Deck ops**: useDeckManager, useDeckActions, useDeckTokens, useDeckTextImport, useDeckInfoEditor, useSelectedDeckSync
- **Search/Cards**: useCardSearch, useCardPrints, useCardRelatedTokens, useSearchFilters, useCardSizePreference
- **Collection**: useCollection, useCardCollection (printing + all-printings totals), useCollectionOwnership
- **Playtest**: usePlaytestSimulator, useProxyPrint, useTokenHandlers
- **Cross-cutting**: usePendingAction (command channel), useProfileBackup, useEscapeKey, useFocusTrap, useAnimatedList
- **UI**: useShortcuts, useDialog, useToast, useDarkMode

### **Services Layer**
- **deckImportService** → Parse MTG Arena / .DEC / JSON imports, normalize card names
- **profileBackup** → Whole-profile export/restore (merge or replace) in one transaction
- **deckVersionService** → Snapshot a deck on save; powers version history
- **suggestionService** → Card suggestions for the deck being edited
- **storagePersistence** → `navigator.storage.persist()` / `estimate()`
- **fileDownload** → JSON export, proxy print download
- **Scryfall API** (via scryfall-sdk) → Card search, legality checks, image fetching

### **Persistence Layer (Dexie/IndexedDB — `MagicDecksDB`, v3)**
- `decks: 'id, name, format, createdAt'` — cards[] and tokens[] ride along as JSON
- `collection: 'id, oracleId, name, set, rarity, updatedAt'` — one row per **printing**;
  `oracleId` is indexed so all printings of a card come back in one query
- `deckVersions: 'id, deckId, createdAt'` — point-in-time deck snapshots
- Full offline support; Dexie version bumps migrate and leave unlisted stores untouched

### **Utilities & Helpers**
- **deckValidator** → Commander rules, format legality, partner validation
- **deckEntry** → Per-copy identity (`instanceId`), so copies can differ by printing
- **searchQuery** → Builds the Scryfall query; `hasActiveFilters` is derived from it
- **playoutSimulation** → Turn-by-turn Monte Carlo (distinct from deckDoctor's opening-hand one)
- **deckDoctor** → Consistency score, opening-hand goldfish, color-source diagnosis
- **deckVersions / deckVersionDiff** → Snapshot storage and change summaries
- **deckImage / deckCover** → Shareable PNG render and deck-box art selection
- **budgetPlanner / deckSuggestions** → Budget cut planning and card suggestions
- **symbolHelper** → Scryfall symbol rendering (mana, loyalty, icons)
- **deckStatistics** → Mana curve, color distribution, card type breakdown
- **translationHelper** → Multi-language support (en, es, pt)
- **contextMenuPosition** → Smart popup placement

## Data Flow

```
User Input
   │
   ├─→ CardSearch Hook
   │   └─→ Scryfall API (debounced)
   │       └─→ CardDetails Modal (user selects printing)
   │           └─→ useDeckStore.addCard()
   │
   ├─→ DeckManager
   │   ├─→ useDeckManager (load/save/export)
   │   │   └─→ Dexie (IndexedDB persist)
   │   └─→ useDeckValidator
   │       └─→ Legality check vs Scryfall
   │
   └─→ PlaytestSimulator
       ├─→ usePlaytestSimulator
       │   └─→ Hand draw, life total, battlefield state
       └─→ Auto-token analyzer
           └─→ useDeckTokens (populate related tokens)
```

## Integration Points

| Layer | Integration | Purpose |
|-------|-----------|---------|
| UI → Zustand | useDeckStore hooks | State mutations |
| Zustand → Dexie | useDeckManager | Save/load decks |
| UI → Scryfall | useCardSearch | Card data, legality |
| Scryfall → Card Details | fetchSymbols | Render mana symbols |
| Deck → Validator | deckValidator.ts | Enforce format rules |

## Deployment Targets

- **Electron**: Native desktop (Windows, macOS, Linux) via electron-builder
- **Web**: Browser sandbox via Vite, PWA support
- Single codebase, dual entry: `main.tsx` (web), `electron/` (native)
