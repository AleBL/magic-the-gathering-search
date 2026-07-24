import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch } from 'react-icons/fa';
import CardGrid from './CardGrid';
import CardSizeSelector from './CardSizeSelector';
import SearchFilters from './SearchFilters';
import CardFilterBar from './CardFilterBar';
import CardSkeleton from './CardSkeleton';
import { Card } from '../../types/Card';
import { CardSize } from '../../types';
import { DeckFormat } from '../../types/Deck';
import { useCardSearch } from '../../hooks/useCardSearch';
import { useDeckStore } from '../../store/useDeckStore';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';

interface CardSearchProps {
  onAddToDeck?: (card: Card) => void;
  onAddTokenToDeck?: (token: Card) => void;
  activeFormat?: DeckFormat;
  /** Makes results draggable into the deck editor's drop zone (two-pane mode). */
  enableAddDrag?: boolean;
}

function CardSearch({ onAddToDeck, onAddTokenToDeck, activeFormat, enableAddDrag = false }: CardSearchProps) {
  const { i18n, t } = useTranslation();
  const [cardSize, setCardSize] = useState<CardSize>('medium');

  const {
    searchQuery,
    setSearchQuery,
    cards,
    isLoadingInitial,
    isLoadingMore,
    error,
    filters,
    setFilters,
    hasMore,
    loadFirstPage,
    loadNextPage,
    buildQuery
  } = useCardSearch(i18n.language || 'en');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pendingAction = useDeckStore((state) => state.pendingAction);
  const setPendingAction = useDeckStore((state) => state.setPendingAction);

  useEffect(() => {
    if (pendingAction === 'focus-search') {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      setPendingAction(null);
    }
  }, [pendingAction, setPendingAction]);

  useEffect(() => {
    const handleEscape = () => {
      searchInputRef.current?.blur();
    };
    window.addEventListener('mtg-escape', handleEscape);
    return () => window.removeEventListener('mtg-escape', handleEscape);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadNextPage]);

  return (
    <div className="flex flex-col h-full bg-gray-50/30 dark:bg-slate-900/30">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 px-4 sm:px-6 py-3 sm:py-4 shadow-sm transition-all duration-300">
        <div className="w-full space-y-2 sm:space-y-4">
          {/* Main Search Input */}
          <div className="flex flex-row gap-2 sm:gap-3">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <FaSearch className="text-lg" />
              </div>
              <input
                ref={searchInputRef}
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadFirstPage(buildQuery(searchQuery));
                  }
                }}
                placeholder={t('search.searchPlaceholder')}
                className="w-full pl-11 pr-4 py-3.5 bg-gray-100 dark:bg-slate-800/50 border border-transparent dark:border-slate-700 rounded-2xl text-base font-medium text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300 shadow-sm"
              />
            </div>
            <button
              onClick={() => loadFirstPage(buildQuery(searchQuery))}
              className="px-5 sm:px-8 py-3.5 bg-primary hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 active:scale-95 whitespace-nowrap"
            >
              {t('search.searchButton')}
            </button>
          </div>

          {/* Secondary Controls: Filters & View Options. Hidden below `sm` —
              the same breakpoint that shows the navbar page-menu button —
              where all of these controls live inside the filters bottom
              sheet instead (see mobileExtras). SearchFilters stays mounted
              (not conditionally rendered) so its pendingAction listener keeps
              working; its BottomSheet portals to <body>, escaping this
              hidden container. */}
          <div className="hidden sm:flex flex-col xl:flex-row xl:items-center justify-between gap-2 xl:gap-4">
            <div className="flex-1 overflow-hidden">
              <CardFilterBar filters={filters} setFilters={setFilters} />
            </div>
            <div className="flex flex-row flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 shrink-0 pb-1 sm:pb-3 xl:pb-0 w-full xl:w-auto">
              <SearchFilters
                filters={filters}
                setFilters={setFilters}
                mobileExtras={
                  <div className="space-y-3">
                    <CardFilterBar filters={filters} setFilters={setFilters} mobileLayout />
                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                      <span className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        {t('search.cardSize')}
                      </span>
                      <CardSizeSelector selectedSize={cardSize} onSizeChange={setCardSize} />
                    </div>
                  </div>
                }
              />
              <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
              <CardSizeSelector selectedSize={cardSize} onSizeChange={setCardSize} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-slate-900/50 p-4 sm:p-6 transition-colors duration-300">
        <div className="w-full">
          {isLoadingInitial && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
              {Array.from({ length: 21 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isLoadingInitial && error && (
            <ErrorState
              title={t('common.errorTitle')}
              message={error}
              onRetry={() => loadFirstPage(buildQuery(searchQuery))}
            />
          )}

          {!isLoadingInitial && !error && cards.length === 0 && (
            <EmptyState
              icon={<FaSearch />}
              title={t('search.noResults')}
              description={t('search.tryAdjustingFilters')}
              suggestions={[
                {
                  label: 't:dragon',
                  onClick: () => {
                    setSearchQuery('t:dragon');
                    loadFirstPage(buildQuery('t:dragon'));
                    searchInputRef.current?.focus();
                  }
                },
                {
                  label: 'c:red cmc=3',
                  onClick: () => {
                    setSearchQuery('c:red cmc=3');
                    loadFirstPage(buildQuery('c:red cmc=3'));
                    searchInputRef.current?.focus();
                  }
                },
                {
                  label: 'o:"draw a card"',
                  onClick: () => {
                    setSearchQuery('o:"draw a card"');
                    loadFirstPage(buildQuery('o:"draw a card"'));
                    searchInputRef.current?.focus();
                  }
                }
              ]}
            />
          )}

          {!isLoadingInitial && !error && cards.length > 0 && (
            <div className="animate-in fade-in duration-500">
              <CardGrid
                cards={cards}
                size={cardSize}
                onAddToDeck={onAddToDeck}
                onAddTokenToDeck={onAddTokenToDeck}
                activeFormat={activeFormat}
                showCollectionControls
                isAddDraggable={enableAddDrag}
              />
            </div>
          )}

          {!isLoadingInitial && hasMore && (
            <div ref={sentinelRef} className="mt-8 mb-12">
              {isLoadingMore && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4 opacity-50">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CardSearch;
