import { useMemo, useRef, useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBoxOpen, FaHeart, FaFileImport, FaFileExport, FaTrashAlt, FaChevronUp, FaSpinner } from 'react-icons/fa';
import { SearchFilters } from '../../types';
import { EMPTY_SEARCH_FILTERS } from '../../constants';
import { useCardSizePreference } from '../../hooks/useCardSizePreference';
import { useCollection, CollectionView } from '../../hooks/useCollection';
import { useCollectionImportExport } from '../../hooks/useCollectionImportExport';
import { useCollectionSettings } from '../../store/useCollectionSettings';
import { matchesFilters } from '../../utils/collectionFilter';
import { clearCollection } from '../../services/collectionService';
import CardFilterBar from '../card/CardFilterBar';
import SearchFiltersPanel from '../card/SearchFilters';
import CardDetailModal from '../card/CardDetailModal';
import { CollectionListView } from './CollectionListView';
import { CollectionChecklistView } from './CollectionChecklistView';
import { CollectionBySetView } from './CollectionBySetView';
import { CollectionBinderView } from './CollectionBinderView';
import { CollectionViewOptions, type CollectionViewMode } from './CollectionViewOptions';
import type { BinderLayout } from './CollectionBinderView';
import { STORAGE_KEYS } from '../../constants/storage';
/** The collection has one mode the deck tab does not: a tick-list for stocktaking. */
import type { Card } from '../../types/Card';
import { useSearchFilters } from '../../hooks/useSearchFilters';
import VirtualizedCardGrid from '../card/VirtualizedCardGrid';
import EmptyState from '../ui/EmptyState';
import CardSkeleton from '../card/CardSkeleton';
import CustomDialog from '../ui/CustomDialog';
import useDialog from '../../hooks/useDialog';
import { CollectionSummaryBar } from './CollectionSummaryBar';

function CollectionManager() {
  const { t } = useTranslation();
  const [view, setView] = useState<CollectionView>('owned');
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [setFilter, setSetFilter] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [cardSize, setCardSize] = useCardSizePreference();
  const [viewMode, setViewMode] = useState<CollectionViewMode>('grid');
  const [binderLayout, setBinderLayout] = useState<BinderLayout>('3x3');
  /**
   * The summary strip and the filter panel together take a good third of the height, which the
   * binder needs back. Collapsed state is remembered: someone browsing a binder wants it that
   * way every time, not once per visit.
   */
  const [areToolsOpen, setAreToolsOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.collectionToolsOpen) !== 'false';
    } catch {
      return true;
    }
  });

  const toggleTools = () => {
    setAreToolsOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(STORAGE_KEYS.collectionToolsOpen, String(next));
      } catch {
        // Ignore persistence failures (private mode); the session still honours the choice.
      }
      return next;
    });
  };
  // The grid's CardItem owns its own modal; the list and stack views do not, so the tab holds
  // the selection for them.
  const [detailCard, setDetailCard] = useState<Card | null>(null);

  const { entries, visibleEntries, summary, isLoading } = useCollection(view, filters);
  const currency = useCollectionSettings((state) => state.currency);
  const setCurrency = useCollectionSettings((state) => state.setCurrency);
  const { rarities } = useSearchFilters(filters, setFilters);
  const { isImporting, importProgress, exportCsv, importCsv } = useCollectionImportExport(entries);
  const { dialogState, showConfirm, closeDialog } = useDialog();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sets present in the current view, for the set dropdown.
  const availableSets = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of entries) {
      if (entry.set) seen.set(entry.set, entry.card.set_name || entry.set.toUpperCase());
    }
    return Array.from(seen, ([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const displayedEntries = useMemo(() => {
    const bySet = setFilter ? visibleEntries.filter((entry) => entry.set === setFilter) : visibleEntries;
    // The search tab turns these filters into a Scryfall query; here the cards are already in
    // hand, so the same predicates are applied locally and the tab keeps working offline.
    const byFilters = bySet.filter((entry) => matchesFilters(entry.card, filters));

    const term = nameQuery.trim().toLowerCase();
    if (!term) return byFilters;

    // Printed name too, so a localised collection is searched by what is on the card.
    return byFilters.filter((entry) => {
      const printed = entry.card.printed_name?.toLowerCase() ?? '';
      return entry.name.toLowerCase().includes(term) || printed.includes(term);
    });
  }, [visibleEntries, setFilter, nameQuery, filters]);

  const cards = useMemo(() => displayedEntries.map((entry) => entry.card), [displayedEntries]);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await importCsv(file);
    event.target.value = '';
  };

  const handleClear = () => {
    showConfirm(t('collection.clearTitle'), t('collection.clearConfirm'), () => clearCollection(), 'danger');
  };

  const viewTab = (value: CollectionView, icon: React.ReactNode, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setView(value)}
      aria-pressed={view === value}
      // `relative` is load-bearing: .count-badge is absolute and would escape to the page edge.
      className={`relative flex items-center gap-2 px-4 py-2 pr-5 rounded-xl text-sm font-bold transition-all ${
        view === value
          ? 'bg-primary text-white shadow-md shadow-blue-500/25'
          : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
      }`}
    >
      {icon}
      {label}
      <span className={`count-badge ${view === value ? 'bg-white/25' : ''}`}>{count}</span>
    </button>
  );

  return (
    <div className="workspace-container">
      <div ref={scrollRef} className="workspace-body">
        <div className="flex flex-col gap-4 p-4">
          <div className="panel-header relative z-10 flex-col items-start gap-3 md:flex-row md:items-center">
            <h2 className="text-gray-900 dark:text-white text-xl font-serif font-semibold flex items-center gap-2 shrink-0">
              <FaBoxOpen className="text-primary shrink-0" />
              {t('collection.title')}
            </h2>

            {/* The tabs live in the header's middle, which was empty on wide screens while they
                sat on a row of their own below. Centred at md+ so they read as the header's
                subject rather than as another toolbar; full width below, where they stack. */}
            <div className="flex w-full md:w-auto md:flex-1 md:justify-center items-center gap-2">
              {viewTab('owned', <FaBoxOpen className="text-xs" />, t('collection.owned'), summary.uniquePrintings)}
              {viewTab('wishlist', <FaHeart className="text-xs" />, t('collection.wishlist'), summary.wishlistCount)}
            </div>

            {/* Below md: three equal compact buttons filling the row. The view picker lives
                here rather than in the filter panel, so collapsing the panel cannot strand
                someone inside the binder with no way back to the grid. */}
            <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:flex md:items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center justify-center gap-2 px-2 md:px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <FaFileImport className="text-xs shrink-0" />
                <span className="truncate">{isImporting ? t('collection.importing') : t('collection.importCsv')}</span>
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center justify-center gap-2 px-2 md:px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <FaFileExport className="text-xs shrink-0" />
                <span className="truncate">{t('collection.exportCsv')}</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={entries.length === 0}
                className="flex items-center justify-center gap-2 px-2 md:px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-gray-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50"
              >
                <FaTrashAlt className="text-xs shrink-0" />
                <span className="truncate">{t('collection.clear')}</span>
              </button>

              <CollectionViewOptions
                viewMode={viewMode}
                setViewMode={setViewMode}
                cardSize={cardSize}
                onCardSizeChange={setCardSize}
                binderLayout={binderLayout}
                onBinderLayoutChange={setBinderLayout}
              />

              <button
                type="button"
                onClick={toggleTools}
                aria-expanded={areToolsOpen}
                aria-controls="collection-tools"
                title={areToolsOpen ? t('collection.hideTools') : t('collection.showTools')}
                className="flex items-center justify-center gap-2 px-2 md:px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <FaChevronUp
                  className={`text-xs shrink-0 transition-transform duration-200 ${areToolsOpen ? '' : 'rotate-180'}`}
                />
                <span className="truncate hidden lg:inline">
                  {areToolsOpen ? t('collection.hideTools') : t('collection.showTools')}
                </span>
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* A real collection file is thousands of rows and the requests are deliberately
              paced, so the import takes tens of seconds. Without this the app looked frozen:
              one disabled button and no sign that anything was happening. */}
          {isImporting && (
            <div className="modal-overlay" role="status" aria-live="polite">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-3 text-center">
                <FaSpinner className="text-3xl text-indigo-500 animate-spin" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-slate-100 uppercase tracking-wider">
                  {t('collection.importingTitle')}
                </h3>
                {importProgress && importProgress.total > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 tabular-nums">
                      {t('collection.importingProgress', {
                        done: importProgress.done,
                        total: importProgress.total
                      })}
                    </p>
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-[width] duration-300"
                        style={{
                          width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">{t('collection.importing')}</p>
                )}
                <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-snug">
                  {t('collection.importingHint')}
                </p>
              </div>
            </div>
          )}

          {/* Summary and filters collapse together: they are the "set up what I am looking at"
              block, and the binder wants that height for pockets. */}
          <div id="collection-tools" className={areToolsOpen ? 'flex flex-col gap-4' : 'hidden'}>
            <CollectionSummaryBar summary={summary} currency={currency} onCurrencyChange={setCurrency} view={view} />

            <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/60 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-700">
              {/* Mirrors the search tab exactly: the colour/type quick filters on their own row
                above, the advanced panel behind its button below. Below `sm` the quick filters
                move into the sheet, which is why they are hidden rather than duplicated. */}
              <div className="hidden sm:block">
                <CardFilterBar filters={filters} setFilters={setFilters} />
              </div>
              {/* Below sm the selects stack full-width for comfortable tapping. The advanced
                filters button joins this row rather than sitting on its own line: on a wide
                screen it was dropping below a row that had space to spare. */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                <SearchFiltersPanel
                  filters={filters}
                  setFilters={setFilters}
                  hideOracleTag
                  mobileExtras={<CardFilterBar filters={filters} setFilters={setFilters} mobileLayout />}
                />
                {/* Capped: as a `flex-1` it grew to fill the row on wide screens, which made a
                  short card name look like a form field for an essay. */}
                <label className="flex items-center justify-between sm:justify-start gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 sm:flex-1 sm:min-w-[200px] sm:max-w-[320px]">
                  <span className="sr-only sm:not-sr-only">{t('collection.searchLabel')}</span>
                  <input
                    type="search"
                    value={nameQuery}
                    onChange={(event) => setNameQuery(event.target.value)}
                    placeholder={t('collection.searchPlaceholder')}
                    className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-gray-800 dark:text-gray-100 placeholder:font-normal placeholder:text-gray-400"
                  />
                </label>
                <label className="flex items-center justify-between sm:justify-start gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {t('search.rarity')}
                  <select
                    value={filters.rarity}
                    onChange={(e) => setFilters((prev) => ({ ...prev, rarity: e.target.value }))}
                    className="flex-1 sm:flex-none max-w-[60%] sm:max-w-none rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-gray-800 dark:text-gray-100"
                  >
                    {rarities.map((rarity) => (
                      <option key={rarity.value} value={rarity.value}>
                        {rarity.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between sm:justify-start gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {t('collection.set')}
                  <select
                    value={setFilter}
                    onChange={(e) => setSetFilter(e.target.value)}
                    className="flex-1 sm:flex-none max-w-[60%] sm:max-w-[220px] rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-gray-800 dark:text-gray-100"
                  >
                    <option value="">{t('search.all')}</option>
                    {availableSets.map((set) => (
                      <option key={set.code} value={set.code}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Skeletons while IndexedDB answers, or a full collection reads as empty. */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
              {Array.from({ length: 14 }).map((_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          ) : cards.length > 0 ? (
            <>
              {viewMode === 'grid' ? (
                <VirtualizedCardGrid
                  cards={cards}
                  size={cardSize}
                  scrollRef={scrollRef}
                  showCollectionControls
                  showPrintingBadge
                />
              ) : viewMode === 'list' ? (
                <CollectionListView entries={displayedEntries} currency={currency} onSelectCard={setDetailCard} />
              ) : viewMode === 'checklist' ? (
                <CollectionChecklistView entries={displayedEntries} onSelectCard={setDetailCard} />
              ) : viewMode === 'bySet' ? (
                <CollectionBySetView entries={displayedEntries} onSelectCard={setDetailCard} />
              ) : viewMode === 'binder' ? (
                <CollectionBinderView entries={displayedEntries} onSelectCard={setDetailCard} layout={binderLayout} />
              ) : (
                <CollectionBinderView entries={displayedEntries} onSelectCard={setDetailCard} layout={binderLayout} />
              )}
            </>
          ) : (
            <EmptyState
              icon={view === 'wishlist' ? <FaHeart /> : <FaBoxOpen />}
              title={view === 'wishlist' ? t('collection.emptyWishlist') : t('collection.empty')}
              description={t('collection.emptyHint')}
              action={{
                label: t('commandPalette.goToSearch'),
                // App listens for this and switches to the search tab.
                onClick: () => window.dispatchEvent(new CustomEvent('mtg-navigate-tab', { detail: 'search' }))
              }}
            />
          )}
        </div>
      </div>

      {/* The list and stack views hand their selection up here; the grid's CardItem still
          opens its own, so this only ever has one card at a time. */}
      {detailCard ? (
        <CardDetailModal
          card={detailCard}
          imageUrl={detailCard.image_uris?.normal ?? detailCard.card_faces?.[0]?.image_uris?.normal ?? ''}
          onClose={() => setDetailCard(null)}
          showCollectionControls
        />
      ) : null}

      {dialogState.isOpen ? (
        <CustomDialog
          isOpen={dialogState.isOpen}
          type={dialogState.type}
          title={dialogState.title}
          message={dialogState.message}
          onConfirm={dialogState.onConfirm}
          onCancel={closeDialog}
          variant={dialogState.variant}
        />
      ) : null}
    </div>
  );
}

export default CollectionManager;
