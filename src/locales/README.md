# Locales

UI translations for MTG Deck Forge. Three languages, one file each:
`en.ts`, `es.ts`, `pt.ts`. English (`en`) is the `fallbackLng`.

## Structure

Each file exports a single object under a `translations` namespace:

```ts
const en = {
  translations: {
    common: { appTitle: 'MTG Deck Forge', /* ... */ },
    deck: { savedDecks: 'Saved Decks', /* ... */ }
    // ...
  }
};
export default en;
```

`translations` is the i18next `defaultNS` (see `src/plugins/i18n.ts`), so code
references keys **without** that prefix: `t('deck.savedDecks')`, `t('common.close')`.

## Taxonomy

Keys are grouped by product domain. The top-level groups are:

| Domain | Covers |
|--------|--------|
| `common` | App-wide labels, actions, statuses (buttons, toggles, generic errors) |
| `search` | Card search, filters, rarity/type/size labels |
| `deck` | Deck builder, saved decks, deck actions and banners |
| `collection` | Collection manager, CSV import/export, price summaries |
| `commandPalette` | Command palette entries and hints |
| `validation` | Format legality and Commander partnership rules |
| `cardDetails` | Card detail modal, copies, alternate arts |
| `land` | Land / basic-land names |
| `stats` | Deck statistics, mana curve, consistency |
| `deckDoctor` | Deck Doctor analysis components, notes and ratings |
| `print` | Proxy print / PDF export |
| `tokens` | Token search, presets and token pool |
| `playtest` | Playtest simulator zones, prompts and controls |
| `strategy` | Strategy / deck notes helpers |
| `export` | Deck export dialogs and formats |

## Dynamic keys

Some keys are built at runtime and therefore never appear as a full literal in
the source. Keep these in mind before deleting anything that looks unused:

- Interpolated keys: `` t(`playtest.${zone}`) ``, `` t(`search.${rarity}`) ``,
  `` t(`land.${name}`) ``, `` t(`validation.${err.key}`) ``,
  `` t(`deckDoctor.component.${key}`) ``, `` t(`tokens.${preset.localeKey}`) ``.
- i18next plurals: `t('stats.nLands', { count })` resolves to
  `stats.nLands_one` / `stats.nLands_other` at runtime.

## Checking

`yarn i18n:check` verifies the three locales share the same key set and exits
non-zero when they drift (CI-friendly). For a deeper pass:

```bash
node scripts/i18n-check.mjs --orphans   # list keys never referenced in src
```

The orphan pass is conservative: it treats every dotted string literal as a
possible reference and skips the dynamic-key and plural patterns above, so a key
must be genuinely unreferenced before it shows up.
