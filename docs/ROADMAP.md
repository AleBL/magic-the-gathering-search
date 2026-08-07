# Roadmap

> Local-only by choice: `docs/ROADMAP.md` is not committed. Treat it as a working
> document, not a record of truth — the code and the test suite are the record.

This is a **forward** roadmap. The previous one tracked an audit that is finished: its
26 phases closed every P0–P3 item and are visible in the code and in git history. What
follows starts from where the app actually is and asks what would make it better.

Rules carried over, because they earned their place:

- Measure before optimising. A phase may end in "measured, not worth it" — that is a
  result, and recording it stops the idea being re-proposed every quarter.
- Confirm references before deleting; research the installed version before upgrading.
- Never rename a persisted storage key without a fallback read.
- Never lower a coverage threshold to make a red run pass.
- A test that passes whether or not the fix is present is worse than no test.

Every phase closes with `ecc:verification-loop` — lint, type-check, test, build, E2E —
before it is called done. It is not repeated per phase below.

---

## Phase 0 — where the app stands today

Measured on 2026-08-05, `staging`, app version 0.8.0. Every number below was produced by
running the command, not read from a previous note.

| Check | State |
|---|---|
| `yarn type-check` | clean |
| `yarn lint:check` | clean — 0 errors, 0 warnings |
| `yarn test` | 35 files / 341 tests |
| `yarn test:e2e` | 32 journeys (Playwright / Chromium) |
| `yarn deadcode` | clean (knip) |
| `yarn i18n:check` | 653 keys × en/es/pt, in sync |
| `yarn build:web` | entry 646 kB (198 kB gzip), CSS 320 kB (38 kB gzip) |
| `yarn build` | Electron renderer + main, passing |
| PWA precache | 17 entries / 2,337 KiB |
| Coverage (logic layer) | 50.6% statements / 45.3% branches — gate 50/44/48/50 |

**Architecture in one paragraph.** React 19 + Vite 6 + Tailwind 4, TypeScript strict, no
`any` in `src/`. State is Zustand for the working deck and Dexie/IndexedDB for everything
persisted (decks, collection, deck version history). Card data comes from Scryfall at
runtime; there is no backend. The search tab is in the entry chunk; the deck and
collection tabs are lazy and prefetched on idle. Cross-component commands travel through
one channel (`usePendingAction`). The same build ships as a PWA and as an Electron app.

**Known limits, already decided.** These are settled, not pending: no screen-reader audit
(no assistive tech available to test with); local per-file class duplication left alone;
`DeckManager` at 693 lines is where it stops. The bundle is at its floor — react-dom,
Dexie, i18next and the Scryfall SDK are 60% of it and all load on the search tab.

---

## Phase 1 — the collection at real size

**Status: done 2026-08-06.** Measured first, then fixed; the numbers for both are below.

The saved-decks list was measured at 30 decks and fixed. The collection has never been
measured at all, and it is the surface most likely to grow: a player catalogues thousands
of cards, not thirty.

Two things in the code say this will not hold:

- `useCardCollection` runs **one live query per card** (`db.collection.get(card.id)`).
  Rendering 2,000 collection rows opens 2,000 IndexedDB subscriptions.
- `CardGrid` renders every entry. There is no virtualisation anywhere in the app.

### Measured 2026-08-06

`e2e/collection-scale.bench.ts`, run with `yarn test:e2e:bench` (add `BENCH_PROD=1` for the
production bundle). Seeds entries straight into IndexedDB, counts reads by patching
`IDBObjectStore.prototype`, and samples frame intervals during a scripted scroll.

Production build (`BENCH_PROD=1`), 1280×720:

| Entries | Time to first card | IDB `get` | DOM nodes | Heap | Scroll frame (median / p95) |
|---|---|---|---|---|---|
| 500 | 6.7 s | 500 | 9,727 | 21 MB | 189 ms / 377 ms |
| 2,000 | 12.7 s | 2,000 | 38,227 | 71 MB | 241 ms / 325 ms |
| 5,000 | 12.8 s | 5,000 | 95,002 | 169 MB | 426 ms / 706 ms |

Dev server for comparison: 3.0 / 6.7 / 12.0 s to first card, same read and node counts.

**Both predictions were right, and the numbers are worse than "will not hold".** Every
metric is linear in entry count: exactly one `get` per rendered card, ~19 DOM nodes per
card, and `renderedCards` equal to the seeded total at every size — no virtualisation
anywhere. Scroll never approaches 60 fps (16.7 ms) at *any* size: 189 ms per frame at 500
entries is roughly 5 fps, and at 5,000 nearly every frame in the sample exceeded 50 ms.

Caveat kept deliberately: single runs on WSL2, so the absolute milliseconds carry noise and
the dev/production differences sit inside it. The read counts, node counts and the linear
shape are deterministic, and they are what the decision rests on.

**Decision: virtualise the grid.** It is the only option that fixes both problems at once —
an unmounted card runs no hook, so windowing removes the N live queries as a side effect.
Lifting ownership into one shared query would fix 5,000 reads and leave 95,000 DOM nodes
and 400 ms frames. Pagination would fix both but changes how the tab is used.

### Done 2026-08-06

`VirtualizedCardGrid` (`@tanstack/react-virtual`, ~4 kB gzip) used by the collection only.
The search and deck tabs keep `CardGrid`: Scryfall pages search at 175 results and decks
top out near 100, so neither has the problem, and neither carries the dependency — the
collection tab is lazy, so it lands in that chunk rather than the entry bundle.

Two details that are load-bearing rather than incidental:

- Column count and row gap are read from the **browser's resolved** `gridTemplateColumns`
  and `rowGap`, not recomputed in JS. The CSS minmax floors change at the 639 px
  breakpoint, and a second copy in TypeScript would drift from the stylesheet silently.
- Row height is measured **once** and applied to every row, rather than measuring each row
  individually. All rows hold identical cards, so one measurement is exact — and with
  per-row measurement the total height stays an estimate, so jumping to the bottom of a
  5,000-card collection lands short of the end.

Same benchmark, production build, after:

| Entries | Time to first card | IDB `get` | DOM nodes | Heap | Scroll frame (median / p95) |
|---|---|---|---|---|---|
| 500 | 0.68 s | 48 | 1,097 | 13 MB | 82 ms / 108 ms |
| 2,000 | 0.99 s | 48 | 1,097 | 16 MB | 83 ms / 107 ms |
| 5,000 | 1.10 s | 48 | 1,097 | 23 MB | 79 ms / 105 ms |

At 5,000 entries: 12.8 s → 1.10 s to first card, 5,000 reads → 48, 95,002 nodes → 1,097,
169 MB → 23 MB, 426 ms → 79 ms frames. **Every figure is now flat across collection size**,
which is the result that matters more than any single ratio.

Guarded by `e2e/collection-virtualization.spec.ts` (1,500 entries: the window stays under
200 cards, before and after scrolling, and the last entry is still reachable). Two of its
three assertions were confirmed to fail against the old `CardGrid`.

**Measured, not worth it: lifting ownership into one shared query.** With the per-card
controls removed entirely — zero IndexedDB reads — the scroll median only moved 94 ms →
72 ms on the same synthetic stress. The remaining frame cost is rendering the cards
themselves, and the benchmark scrolls 600 px per frame, far harder than any real flick.
Reworking the `useCardCollection` API for ~10% of a synthetic number is not a good trade.

Effort spent: M. Risk as predicted: the shared `CardGrid` was left untouched.

**Skills:** `ecc:benchmark` to set the measurement up before touching anything ·
`ecc:react-performance` for the render/virtualisation work · agent
`ecc:performance-optimizer` if the profile points somewhere unexpected.

---

## Phase 2 — data durability

**Status: done 2026-08-06.**

This app has no backend. Every deck, every collection row, every version snapshot exists
in exactly one place: IndexedDB in one browser profile on one machine. Nothing is
replicated anywhere. That single fact is what makes this the most important item here —
not because loss is likely, but because it is **total and silent** when it happens.

The realistic ways it goes:

- **The browser evicts it.** IndexedDB is *best-effort* storage by default. Under disk
  pressure the browser is free to discard it for the whole origin, without asking and
  without telling the user. `navigator.storage.persist()` is the documented way to opt out
  of that — it must be requested, and this app does not appear to request it.
- **"Clear browsing data" wipes it.** Routine hygiene most people do without thinking
  about which sites they are emptying. There is no undo.
- **A schema migration goes wrong.** The Dexie schema is already on version 3. A future
  upgrade that throws mid-migration can leave the database unopenable.
- **The device is gone.** Lost, stolen, reinstalled. Local-first means locally lost.

What exists today is not a backup story, it is an export story: decks go out one JSON at a
time (plus "export all"), the collection goes out as CSV, and nothing carries settings or
version history. Restoring means importing several files in the right order and accepting
that some of it does not come back. Nobody discovers that gap while things are fine — they
discover it the day the data is already gone.

A collection catalogued over months is the kind of data a user cannot recreate from
memory. Every other phase on this list makes the app nicer; this one is the difference
between an inconvenience and starting over.

### What was found in the code

Checked on 2026-08-06, not assumed:

- **`navigator.storage.persist()` is never called.** Zero occurrences in `src/` or
  `electron/`. Storage is best-effort today, which is the eviction path above.
- **Two of the three Dexie tables have no export at all.** `deckVersions` (all deck
  history) and the six `localStorage` settings leave the machine through nothing.
- **"Export all decks" produces a file the app cannot read back.** `exportAllDecks`
  writes `savedDecks` — a JSON *array*. `importDeckFile` parses the file as a single deck
  and rejects anything without `.name`, so re-importing that file fails as "invalid file".
  Whoever exported it believes they have a backup; they have a file only they can read.

That last one is a bug, not a missing feature, and it is the cheapest fix here.

### Concrete tasks

1. ~~**Fix the export-all round trip.**~~ **Done 2026-08-06.** `parseDeckJson` in
   `deckImportService` now reads both shapes, ids are reissued per deck (a shared
   millisecond would have left one deck standing), a malformed entry rejects the whole
   file rather than half-importing, and `bulkPut` writes them in one transaction. Covered
   by 11 unit tests, two of which were confirmed to fail without the fix.
2. ~~**Request persistence.**~~ **Done 2026-08-06.** `requestPersistenceOnce()` runs after
   the first deck is saved, not on boot — the browser only grants persistence to an origin
   the user has engaged with, and there is nothing to protect before then. Asked once
   (Firefox prompts; asking on every save would nag), with the state and a manual request
   in the Backup panel, because a *denied* request is what a user most needs to know.
3. ~~**One-file profile export/import.**~~ **Done 2026-08-06.** `profileBackup.ts`, envelope
   `{ format, version, exportedAt, decks, collection, deckVersions, settings }`. Restore
   runs in one Dexie transaction across all three tables; settings are written *after* it,
   so a rolled-back restore cannot leave a backup's preferences behind.
4. ~~**Show storage usage.**~~ **Done 2026-08-06.** `navigator.storage.estimate()` in the
   Backup panel.

### Decisions taken

- **Restore merges by default; replace needs two clicks.** Merge reissues deck ids so
  nothing saved is overwritten, remaps version snapshots onto the new ids (a snapshot
  pointing at the old id would be orphaned history), and takes the **higher** quantity for
  a printing owned on both sides — which makes restoring the same file twice a no-op
  instead of doubling a collection, and never lowers a count the user already has.
- **Only keys the app owns are restored** from `settings`. A backup file is not a channel
  for writing arbitrary localStorage.
- **A newer envelope version is refused**, not partially read: a build that silently drops
  fields it does not understand turns a restore into data loss.
- **Electron disk backup: not done.** `electron/preload.ts` exposes no filesystem bridge,
  so it needs new IPC. Still worth it only if the desktop build is the one you rely on.

Covered by 13 unit tests (fake Dexie, so a half-written restore is visible) plus
`e2e/backup.spec.ts`, which does the round trip against a real IndexedDB: seed, export,
**delete the database**, restore, and find the decks and collection back. The unit suite
alone could not catch the transaction itself being wrong.

Effort spent: M.

**Skills:** `ecc:tdd-workflow` — write the export→wipe→import round trip first, because
that assertion *is* the feature · agent `ecc:silent-failure-hunter` on the restore path,
where a swallowed error means silent data loss · `ecc:error-handling` for the partial-write
and quota-exceeded cases.

---

## Phase 3 — offline, honestly

**Status: done 2026-08-06.**

The PWA already caches card art aggressively and search results stale-while-revalidate,
and `OfflineIndicator` exists. What has never been checked is how the app *behaves* when
the network is gone: deck import calls Scryfall, adding a card fetches related tokens,
the printings sidebar fetches. Each of those has an error path that has never been
exercised offline.

Playwright can simulate it (`context.setOffline(true)`), so this is testable rather than
theoretical. The deliverable is a set of journeys that go offline mid-flow and assert the
app degrades to something usable instead of failing silently.

### Done 2026-08-06

`e2e/offline.spec.ts`: five journeys that abort the Scryfall routes *and* set the context
offline, because the fixtures would otherwise keep answering locally. `goOffline` waits for
the app to notice before returning — several paths branch on `navigator.onLine`, and acting
first made the journeys race the browser rather than test it.

**Three silent failures found, all of the same shape: "we could not ask" was rendered as
"there is nothing".**

- *Editions.* An aborted lookup ended as `done` with zero results — sometimes emitting
  nothing at all — so the editions control simply disappeared, which reads as "this card
  has one printing". `useCardPrints` now answers up front when the browser is offline
  instead of depending on which event the SDK emits, and `CardDetailEditControls` says so
  **where the button would have been**. A toast was tried first and rejected: a passive
  lookup failure belongs next to the missing control, not in a corner for 2.5 s.
- *Related tokens.* `useCardRelatedTokens` caught the `byName` failure, logged it, and set
  `allParts = []` — indistinguishable from a card that generates no tokens. It now
  propagates to the outer handler, which already had a message.
- *Text import.* Offline, it said **"Error importing some cards. Please check the names."**
  — blaming the user's spelling for a network that was never reached. Both the empty-result
  and the thrown-error branches now report the offline message instead.

Also confirmed working, not just assumed: the offline banner, the search error state, and
the collection — which is served from IndexedDB and stays fully queryable, filter included.

Two limits recorded rather than papered over. Switching tabs offline cannot be tested under
`vite dev`: tabs arrive as ES modules on demand and Playwright blocks the service worker
that precaches them in production, so a failure there would be the harness, not the app.
And a dynamic import still in flight when the connection drops rejects permanently —
`React.lazy` caches the rejection — which is why the journeys wait for a tab to finish
loading first.

Effort spent: S–M.

---

## Phase 4 — one definition of "owned"

**Status: done 2026-08-06.**

Ownership is currently defined twice and the two disagree on screen:

- The collection tracks **printings** — one row per edition, priced independently. You
  confirmed this is right for that tab.
- The search filter matches **cards** by `oracle_id` — you confirmed this is right there.

The contradiction is the badge: a search result shows the count for *that printing*, so
owning the M10 Lightning Bolt and searching up the LEA one shows "0 owned" while the
filter hides it as owned.

The likely fix is for a search result to say "you own another printing" rather than "0",
but that changes existing behaviour for anyone cataloguing specific editions, which is why
it is a decision and not a task.

**Bundled with it, and not blocked on any decision:** on phones the collection never shows
how many copies you own. `CardCollectionControls` is `hidden sm:flex`, so below 640px the
whole overlay — quantity included — disappears, and the count is only reachable by opening
the card modal. The collection tab is exactly where that number is the point, so it needs a
compact, always-visible count on small screens. Not the full −/+ controls, which is why
they were hidden in the first place: a read-only badge, legible at a glance, that leaves
editing to the modal.

### Decision taken 2026-08-06

**Show both.** The badge keeps counting the printing on screen — that is what the collection
tab tracks and what anyone cataloguing editions expects — and adds a second line only when
the total across other editions is higher. Neither number changes meaning; the extra line
exists so the two stop looking like a contradiction.

### Done 2026-08-06

`useCardCollection` answers both questions from **one** live query, keyed on the indexed
`oracleId`, deriving `quantity` (this printing) from the rows it already has rather than
issuing a second `get` per card. Phase 1 is why: the collection grid renders hundreds of
these, and a second read each would double what that tab asks of IndexedDB for a number
sitting in the same result set. Cards with no `oracle_id` (tokens) fall back to their own
row, so they count themselves instead of counting nothing.

`CardCollectionControls` derives `ownsOtherPrintings = totalOwned > quantity` and renders
the reconciliation line in the detail panel and the desktop overlay. On phones the overlay
is no longer hidden outright: a read-only count badge shows `Nx` — or the total, when this
printing is the one you do not have — while the −/+ cluster stays behind `sm:` for the
reason it was hidden originally, mis-taps on a dense grid.

`src/hooks/useCardCollection.test.ts` covers the four cases that matter: this printing plus
its siblings, a printing you do *not* own of a card you do, wishlist rows excluded from the
total (wanted is not owned), and the no-oracle-id fallback.

**The mobile journey had no teeth at first.** It asserted `toContainText('1x')`, which
passed against the old `hidden sm:flex` — Playwright's text matchers read `display: none`
elements, and an element hidden by CSS was exactly the bug. Rewritten as
`getByText('1x', { exact: true })` + `toBeVisible()`, then verified the way an assertion
should be: reverted the fix, watched it fail, put it back.

Effort spent: S.

---

## Phase 5 — search that rewards the power user

**Status: dropped 2026-08-06, by the test the phase set for itself.**

The phase was written with its own kill condition: worth doing only if complex queries are
actually built, worthless if the search box mostly receives a card name. Asked directly, the
answer was the latter. See *Not planned, on purpose* below.

---

## Phase 6 — the playtest simulator, deeper

**Status: proposed.**

It simulates opening hands and mulligans well. What it does not do is anything a real game
does after turn one — there is no turn structure beyond drawing, no life totals, no
opponent. Whether that matters depends on what you use it for: validating a mana base
needs only opening hands, while testing a combo needs turns.

Worth scoping only after saying which of those it is for.

Effort: L. Risk: medium — this is the largest surface in the app.

**Skills:** agent `ecc:architect` before any code — this is the one phase big enough that
the shape matters more than the implementation · `ecc:plan` to split it into shippable
slices · `ecc:feature-dev` per slice.

---

## Phase 7 — the Escape mystery

**Status: solved 2026-08-06. The suspicion in the old note was wrong.**

The note blamed "something on the `document` path" swallowing the key. Nothing swallows it.
An instrumented probe — the workaround removed, listeners recording every stage of the
propagation path — showed the event arriving at `window` trusted and unprevented, and the
overlay's own handler **firing**. It closed the overlay and the overlay stayed open anyway.

### Root cause

`useEscapeKey` listed `onEscape` in its dependency array, so every call site passing an
inline arrow re-registered its `window` listener on each render. Eight did:
`PlaytestLog`, `DeckDisplayOptions`, `PileExplorerModal`, `SearchFilters`,
`DeckManagerToolbar` and four in `PlaytestModals`.

Escape is a **discrete** event. React's root listener sits on the container, earlier in the
bubble path than `window`, so by the time a `window` listener runs React is already in a
discrete-priority context and flushes the resulting state update *synchronously, inside the
dispatch*. The first Escape listener to fire therefore re-rendered, and that render's effect
cleanup **removed the other Escape listeners from `window` while the same keypress was still
travelling toward them**. The DOM never invokes a listener removed before the event reaches
it, so the next dialog's handler was skipped in silence.

That is the whole asymmetry. A synthetic `window.dispatchEvent` "worked" only because by then
the first handler's state change was a no-op — nothing re-rendered, so nothing was pulled out
from under the event. The original debugging tested the one dispatch path that cannot fail.

### Done 2026-08-06

`useEscapeKey` now reads the callback from a ref (updated in `useLayoutEffect`, so a keypress
between render and a passive effect cannot run the previous render's closure) and keys its
effect on `active` alone. It registers once per activation, and callback identity stops
mattering — which is what all thirty call sites already assumed.

The per-dialog workaround in `PlaytestShortcutsOverlay` is deleted, along with the
`useCallback` that only existed to dodge the hook's dependency. Removing that ceremony is
what gives `e2e/keyboard.spec.ts` teeth: with an inline arrow and no workaround, reverting
the hook makes that journey fail, which was confirmed rather than assumed.

`src/hooks/useEscapeKey.test.ts` pins the registration count across renders that change the
callback identity — the testable half. The failure itself needs React's synchronous flush
inside a live dispatch, which jsdom does not reproduce; a unit test asserting it would pass
against the broken hook, so it was removed rather than kept as false coverage.

**Recorded, not fixed:** `offline › a text import that cannot resolve cards reports it` is
flaky under full-suite parallel load and passes in isolation. Verified pre-existing by
running the suite at HEAD without these changes, where it fails the same way.

Effort spent: S.

---

## Phase 8 — a deck copy is a printing, not a name

**Status: done 2026-08-06.**

Reported: changing the art of one Island and then adding another Island produced one entry
carrying the changed art. The general case is the real requirement — four copies of a
creature in four different editions must be four things in a deck, because that is how
paper decks and proxy sheets actually work.

### Root cause

A deck stores copies as separate array entries (`addCard` appends; four copies are four
`Card` objects), so the data shape is half right already. What is missing is **identity**:
an entry is identified by `Card.id`, which is the Scryfall *printing* id of whatever was
added. Every copy of the same printing shares it. Three consequences follow:

- `useDeckStore.updateCard` replaces **every** entry with a matching id
  (`currentDeck.map((c) => (c.id === updatedCard.id ? updatedCard : c))`), so an art change
  applies to all copies. Changing one is not expressible.
- `CardDetailModal.handleConfirmArtChange` deliberately keeps the original id — the comment
  says "keep original id (used to find in deck)" — and layers the new printing on as
  `selectedPrintId` / `selectedPrintImageUri` / `set` / `lang`. The chosen printing is an
  overlay on an entry still identified as the old one.
- `groupCardsByUnique` groups by `card.name`, so even correct per-copy data would collapse
  into one row on screen, taking its image from the first entry.

`removeCard`, `updateCardZone` and `toggleCommander` all look entries up by the same
colliding id, so each has the same "hits the wrong copy" hazard.

### Done 2026-08-06

Smaller than scoped, because the survey found a shortcut. The plan was a new entry id
*plus* a composite "name + printing" display key. In practice only the first was needed:

- **`Card.instanceId`** identifies one copy. `addCard` always issues a fresh one — "add
  another copy" hands back a card that already has an entry id, so reusing it would have
  recreated the bug. `updateCard` keys on it; every other mutation still addresses a
  printing and rightly keeps using `id`.
- **An art change now rewrites the entry's `id`** to the chosen printing. It was pinned to
  the original id precisely because the parent looked entries up by it — a comment in
  `CardDetailModal` said so. With `instanceId` doing that job, `id` can be truthful again,
  and the entry simply *is* the printing it shows.
- That makes **`card.id` the display group key** on its own. No composite key was needed:
  same printing groups, different printings do not. `DeckCardGrouped.key` carries it, since
  `name` no longer separates rows.
- **Back filled on load** (`setCurrentDeck` and `loadDeckToEdit`), so decks saved before
  this get entry ids without a migration that could fail.

Nothing else moved. The playtest, validators, export formats, zone moves and commander
toggles all address printings, which is what they already did — so the blast radius stayed
inside the store, the grouping helper and the detail modal.

Guarded by `e2e/deck-printings.spec.ts`: add two copies of one edition, confirm a single
pile of 2, change one copy's art, confirm two piles and a deck that still holds two cards.
Against the old code it sees **1 pile** — the reported bug, reproduced. Plus five unit
tests, three of which were confirmed to fail without the fix.

Effort spent: M.

**Skills:** agent `ecc:architect` on the identity change before any code, since the wrong
key here is expensive to undo · `ecc:tdd-workflow` — "change the art of copy 2 of 4" is a
test that fails today and must fail for the right reason · agent `ecc:react-reviewer` over
the store and grouping call sites · `ecc:type-design-analyzer` to make the new entry type
make the old collision unrepresentable.

---

## Phase 9 — text search in the advanced filters

**Status: done 2026-08-06.**

The filter sheet covers colour, type, rarity and CMC. Everything else has to be typed as
raw Scryfall syntax in the search box — which works, since the box passes the query
through untouched, but only if you already know the syntax.

### What to add

All seven are in scope, in order of value for a deckbuilding app:

| Field | Query | Notes |
|---|---|---|
| Contains text | `o:"draw a card"` | The request. Quote the phrase — an unquoted space becomes a second search term |
| Does not contain | `-o:...` | Cheap once the field above exists, and it is how you exclude a mechanic |
| Include reminder text | `fo:` instead of `o:` | A checkbox on the field above, not a field of its own |
| Keyword | `kw:flying` | A select, not free text — the list is closed and a typo returns nothing |
| Oracle tags | `otag:removal` | Function, not wording. The strongest of the seven for deckbuilding |
| Power / toughness | `pow>=4`, `tou<=2` | Comparator + value, next to the CMC field already there |
| Flavour text | `ft:"..."` | Same quoting rule as oracle text |

Three of those need a decision inside the phase rather than a field and a template:

- **Oracle tags have no list to fetch.** Scryfall Tagger has no documented public API, so
  the select has to be a curated list held in the app — twelve to twenty tags people
  actually build around (`removal`, `spot-removal`, `board-wipe`, `ramp`, `card-draw`,
  `tutor`, `counterspell`, `recursion`, `token-generation`) rather than a mirror of the
  full taxonomy. Being tags rather than text is the whole point: `otag:removal` finds cards
  that *are* removal, not cards containing the word.
- **Power and toughness need an operator**, unlike the existing CMC field, which is exact
  (`cmc=`). Either give them a comparator select (`>=`, `=`, `<=`) or accept `>=4` typed
  into the value and parse it — and note that `*` power exists, so a numeric comparison
  quietly excludes those cards.
- **Flavour text is per printing, not per card.** Two printings of the same card can carry
  different flavour text, so a hit means "some printing matches". Worth a word in the hint.

### The constraint

Scryfall matches text against **English** oracle text. The app searches with
`lang:${searchLanguage}` appended, so a user searching in Portuguese gets Portuguese
printings back — but typing Portuguese words into "contains text" returns nothing. The
field needs to say so, or it reads as broken. Confirm the exact behaviour against Scryfall
before writing the hint.

### The trap

`buildQuery` computes `hasFilters` from an explicit list (colors / types / rarity / cmc).
Any of the seven fields not added to that check means an empty search box plus that filter
falls through to `DEFAULT_QUERY` and returns unrelated cards. The same applies to
`hasActiveFilters` in `SearchFilters`, which drives the "clear" affordance. Seven new
fields make that a list worth deriving from the filter state rather than hand-maintaining
in two places.

### Done 2026-08-06

All seven shipped, behind a "Text & stats" disclosure inside the advanced panel — appending
them flat would have made the sheet unusable on a phone, and most searches never need them.

**Every operator was verified against the live Scryfall API before being used**, not
assumed: `o:` / `fo:` / `-o:` / `ft:` / `kw:` / `pow>=` / `tou<=` all return results, and
`fo:"draw a card"` returns more than `o:"draw a card"` (3,136 vs 2,542), which is the
reminder text doing its job.

**Two oracle-tag slugs I would have guessed do not exist.** `card-draw` and
`token-generation` both 404. Each of the 18 shipped slugs was checked with
`api.scryfall.com/cards/search?q=otag:<slug>` and returned cards — a wrong slug in a select
is indistinguishable from a genuinely empty result, which is the worst kind of broken.

**Corrected 2026-08-06 after review — the English constraint was wrong.** `o:voar` alone
returns nothing, but the app *always* appends `lang:<locale>`, and `o:voar lang:pt` matches
3,145 cards. The original check tested a query the app never sends. Portuguese and Spanish
words work; so do English ones (`o:flying lang:pt` → 3,470). The hint now says the filter
matches the card text in the language being browsed, and that English works too. Guarded by
a journey that asserts `lang:pt` travels with the text term.

The trap was closed by construction: `hasActiveFilters(filters)` is
`buildFilterTerms(filters).length > 0`, so both the query builder and the "clear" button
read the same derived answer and a new field cannot be forgotten in either. Verified by
restoring the old hand-written list — the "a text filter alone does not fall back to the
default query" journey fails against it.

**Review round, same day.** Six further changes:

- *Flavour text dropped.* Not wanted; the field, its type, its query term and its tests are
  all gone rather than hidden.
- *Keyword and function labels translated, slugs still English.* The label key is derived
  from the slug (`first strike` → `firstStrike`), so the value sent to Scryfall stays the
  single source of truth. **All 20 keyword translations were read out of real printed card
  text**, not guessed — four of my guesses were wrong: hexproof is *Resistência a magia*
  (not "à prova de maldições"), ward is *Salvaguarda* / *Rebatir* (not "guarda"), flashback
  is *Recapitular* / *Retrospectiva*, kicker is *Reforçar* / *Estímulo*, and scry is
  *Vidência* / *Adivina*.
- *The mobile sheet scrolls its own body.* It scrolled as one piece, taking the grab handle
  — the only affordance saying it can be dragged shut — off screen, and chained the scroll
  into the page. The panel is now `overflow-hidden` with a scrolling body and
  `overscroll-contain`; `useSwipeToClose` already anticipated exactly this shape.
- *Reminder text is no longer a choice — and that turned up a conflict.* Dropping the
  toggle in favour of `fo:` alone would have broken translated search: **`fo:` only ever
  matches English** (`fo:voar lang:pt` → 0, while `o:voar lang:pt` → 3,145), and `o:` alone
  skips the reminder text (`o:flying lang:en` → 4,574 vs `fo:`'s 4,704). Neither operator
  is sufficient. The filter now emits `(o:X or fo:X)`, negated as `-(o:X or fo:X)`, which
  was verified to return the union in both languages.
- *The desktop dropdown is twice as wide, in two columns* (`w-72` → `w-[34rem]`), nearly
  opaque (`/95` → `/98`), and bounded by the space left below the trigger
  (`max-h-[max(18rem,calc(100dvh-20rem))]`). A flat cap made tall screens scroll for no
  reason; `100dvh` alone ignored that the panel starts ~20rem down and ran off the bottom.
  The mobile sheet stays one column.
- *The mobile sheet no longer scrolls sideways.* Two causes, found in two passes. The
  scroll body carried `-mx-1 px-1`, making it wider than its parent; and the sheet's close
  button carried `p-2 -m-2`, whose negative **right** margin pushed it 8px past the sheet's
  edge. It now uses `-my-2 -ml-2`, keeping the tap target without the overflow.

  The first fix shipped with a test that passed while the bug was still there: it measured
  only the dialog element, and the culprit was a descendant. The assertion now walks every
  element inside the sheet and names the ones that scroll. Verified by restoring `-m-2` —
  it fails and prints both offenders.

Covered by 32 unit tests on the pure builder and 5 E2E journeys that read the query off the
request the app actually made.

Effort spent: M. Risk as predicted: nothing here touches persisted data.

**Skills:** `ecc:make-interfaces-feel-better` for the layout — seven more controls is the
hard part of this phase, not the queries · `ecc:design-system` so the new inputs match the
existing filter controls · `ecc:tdd-workflow` on `buildQuery`, where quoting, negation and
the comparator parsing are pure functions and cheap to pin down.

---

## Not planned, on purpose

Recorded so they are not re-proposed as if new.

| | Why not |
|---|---|
| Splitting locale bundles | Measured: 11.8 kB gzip (6%) for an async i18n init, a boot-blocking request and a flash of untranslated content |
| Quantising the PWA icons | −78% on paper (RMSE 0.021), but a 1:1 crop showed dithering across the gold gradient. Brand assets; the lossless 16→8-bit win was taken instead |
| Further `DeckManager` extraction | The save flow reads 15 values; export/cover are not one concern; the modal block would need ~25 props. Each move relocates complexity rather than reducing it |
| Deck-to-deck comparison | Proposed originally because it was *cheap*, which is not a reason. Version history already answers the common question |
| Deck folders / tags | The measured problem was density and an unbounded column, fixed directly; folders would still scroll inside the folder and charge ongoing upkeep |
| Screen-reader audit | No assistive technology available; asserting AT output without one would be theatre |
| Search history / saved queries (was Phase 5) | The phase carried its own kill condition and met it: the search box mostly receives a card name, not a built query. Storing a search now also means storing ten filter fields, so remembering only the text box would restore a search minus its filters — a worse answer than none |

---

## Suggested order

1. ~~Phase 2 (durability)~~ — done 2026-08-06. Its round-trip tests are what make Phase 8
   safe to attempt.
2. ~~Phase 8 (printing identity)~~ — done 2026-08-06.
3. ~~Phase 9 (text filters)~~ — done 2026-08-06.
4. ~~Phase 1 (collection at scale)~~ — done 2026-08-06.
5. ~~Phase 3 (offline)~~ — done 2026-08-06.
6. ~~Phase 4 (ownership)~~ — done 2026-08-06.
7. ~~Phase 5 (search memory)~~ — dropped 2026-08-06; it failed its own test.
8. ~~Phase 7 (the Escape mystery)~~ — solved 2026-08-06.
9. **Phase 6 (playtest depth)** — the only one left, and only after saying what the
   simulator is *for*.
