import { useMemo, useRef, useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBoxOpen, FaHeart, FaFileImport, FaFileExport, FaTrashAlt } from 'react-icons/fa';
import { SearchFilters } from '../../types';
import { EMPTY_SEARCH_FILTERS } from '../../constants';
import { useCardSizePreference } from '../../hooks/useCardSizePreference';
import { useCollection, CollectionView } from '../../hooks/useCollection';
import { useCollectionImportExport } from '../../hooks/useCollectionImportExport';
import { useCollectionSettings } from '../../store/useCollectionSettings';
import { useSearchFilters } from '../../hooks/useSearchFilters';
import { clearCollection } from '../../services/collectionService';
import CardFilterBar from '../card/CardFilterBar';
import CardGrid from '../card/CardGrid';
import CardSizeSelector from '../card/CardSizeSelector';
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

  const { entries, visibleEntries, summary, isLoading } = useCollection(view, filters);
  const currency = useCollectionSettings((state) => state.currency);
  const setCurrency = useCollectionSettings((state) => state.setCurrency);
  const { rarities } = useSearchFilters(filters, setFilters);
  const { isImporting, exportCsv, importCsv } = useCollectionImportExport(entries);
  const { dialogState, showConfirm, closeDialog } = useDialog();

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const term = nameQuery.trim().toLowerCase();
    if (!term) return bySet;

    // Matches the printed (localised) name too: a collection imported in Portuguese is
    // searched with the words actually shown on the card.
    return bySet.filter((entry) => {
      const printed = entry.card.printed_name?.toLowerCase() ?? '';
      return entry.name.toLowerCase().includes(term) || printed.includes(term);
    });
  }, [visibleEntries, setFilter, nameQuery]);

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
      // `relative` is load-bearing: .count-badge is absolutely positioned, so without a
      // positioned ancestor it resolves against the initial containing block and lands
      // past the right edge of the page instead of on this button's corner.
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
      <div className="workspace-body">
        <div className="flex flex-col gap-4 p-4">
          <div className="panel-header relative z-10 flex-col items-start gap-3 md:flex-row md:items-center">
            <h2 className="text-gray-900 dark:text-white text-xl font-serif font-semibold flex items-center gap-2">
              <FaBoxOpen className="text-primary shrink-0" />
              {t('collection.title')}
            </h2>
            {/* Below md: three equal compact buttons filling the row. */}
            <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:flex md:items-center md:ml-auto">
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

          <CollectionSummaryBar summary={summary} currency={currency} onCurrencyChange={setCurrency} view={view} />

          <div className="flex flex-wrap items-center gap-2">
            {viewTab('owned', <FaBoxOpen className="text-xs" />, t('collection.owned'), summary.uniquePrintings)}
            {viewTab('wishlist', <FaHeart className="text-xs" />, t('collection.wishlist'), summary.wishlistCount)}
          </div>

          <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/60 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-700">
            <CardFilterBar filters={filters} setFilters={setFilters} />
            {/* Below sm the selects stack full-width for comfortable tapping. */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <label className="flex items-center justify-between sm:justify-start gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 sm:flex-1 sm:min-w-[200px]">
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
              <div className="ml-auto">
                <CardSizeSelector selectedSize={cardSize} onSizeChange={setCardSize} />
              </div>
            </div>
          </div>

          {/* Skeletons while IndexedDB answers: showing the empty state here would tell
              someone with a full collection that they own nothing. */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
              {Array.from({ length: 14 }).map((_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          ) : cards.length > 0 ? (
            <CardGrid cards={cards} size={cardSize} showCollectionControls />
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
