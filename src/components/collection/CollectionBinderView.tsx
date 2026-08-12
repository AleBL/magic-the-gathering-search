import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { CollectionEntry } from '../../types/Collection';
import { Card } from '../../types/Card';

interface CollectionBinderViewProps {
  entries: CollectionEntry[];
  onSelectCard: (card: Card) => void;
}

/** A binder page is nine pockets. Not configurable: it is the physical object being imitated. */
const SLOTS_PER_PAGE = 9;

const artOf = (card: Card): string | undefined =>
  card.image_uris?.normal ?? card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.normal;

/**
 * The collection as a ring binder: pages of 3×3 pockets, filed by set and collector number.
 *
 * Two rules come from the physical object rather than from convenience. Every page always draws
 * **nine slots**, even the last one — an empty pocket is information, and reflowing would break
 * "page 3, second row" as a way to find a card. And the order is set then collector number,
 * because that is how a binder gets filled.
 */
export function CollectionBinderView({ entries, onSelectCard }: CollectionBinderViewProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const ordered = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          (a.set || '').localeCompare(b.set || '') ||
          Number(a.card.collector_number ?? 0) - Number(b.card.collector_number ?? 0) ||
          a.name.localeCompare(b.name)
      ),
    [entries]
  );

  const pageCount = Math.max(1, Math.ceil(ordered.length / SLOTS_PER_PAGE));

  // Filtering shrinks the binder under the reader's feet; clamp rather than show a blank page.
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const slots = useMemo(() => {
    const start = page * SLOTS_PER_PAGE;
    return Array.from({ length: SLOTS_PER_PAGE }, (_, index) => ordered[start + index]);
  }, [ordered, page]);

  return (
    <div className="flex flex-col gap-3">
      {/* Named so the page can be identified without matching on layout classes. */}
      <div data-binder-page className="grid grid-cols-3 gap-2 sm:gap-3">
        {slots.map((entry, index) =>
          entry ? (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectCard(entry.card)}
              className="relative aspect-[5/7] rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-primary transition-all"
              aria-label={`${entry.card.printed_name || entry.name} — ${entry.quantity}x`}
            >
              {artOf(entry.card) ? (
                <img
                  src={artOf(entry.card)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover pointer-events-none select-none"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center p-2 text-[10px] font-bold text-center text-gray-600 dark:text-gray-300">
                  {entry.card.printed_name || entry.name}
                </span>
              )}
              {entry.quantity > 1 ? (
                <span className="absolute bottom-1 right-1 rounded-full bg-black/75 text-white text-[10px] font-extrabold px-1.5 py-0.5 tabular-nums">
                  {entry.quantity}x
                </span>
              ) : null}
            </button>
          ) : (
            // An empty pocket, drawn on purpose: it shows the gap in the page.
            <div
              key={`empty-${index}`}
              aria-hidden="true"
              className="aspect-[5/7] rounded-lg border border-dashed border-gray-200 dark:border-slate-700/70 bg-gray-50/60 dark:bg-slate-900/40"
            />
          )
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0}
          aria-label={t('collection.binderPrevious')}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <FaChevronLeft className="text-xs" />
        </button>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 tabular-nums">
          {t('collection.binderPage', { page: page + 1, total: pageCount })}
        </span>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          disabled={page >= pageCount - 1}
          aria-label={t('collection.binderNext')}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <FaChevronRight className="text-xs" />
        </button>
      </div>
    </div>
  );
}
