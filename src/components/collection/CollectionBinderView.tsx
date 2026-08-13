import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { CollectionEntry } from '../../types/Collection';
import { Card } from '../../types/Card';

interface CollectionBinderViewProps {
  entries: CollectionEntry[];
  onSelectCard: (card: Card) => void;
  layout: BinderLayout;
}

/**
 * Pocket layouts a real binder page comes in. 3×3 is the standard sheet; 2×2 exists for
 * oversized sleeves and is useful when the screen is narrow.
 */
const LAYOUTS = {
  '3x3': { columns: 3, slots: 9 },
  '2x2': { columns: 2, slots: 4 }
} as const;

export type BinderLayout = keyof typeof LAYOUTS;

/**
 * A card is 63×88mm. At ~96dpi that is roughly 240px wide, which is what "actual size" means
 * here: pockets stay this size instead of stretching, because a binder page does not grow with
 * the desk it sits on. Spare width goes to showing more pages side by side.
 */
const POCKET_WIDTH_PX = 172;

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
export function CollectionBinderView({ entries, onSelectCard, layout }: CollectionBinderViewProps) {
  const { columns, slots: slotsPerPage } = LAYOUTS[layout];
  const sheetRef = useRef<HTMLDivElement>(null);
  // How many pages fit side by side at actual size. Recomputed on resize, never guessed.
  const [pagesPerSpread, setPagesPerSpread] = useState(1);
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

  useLayoutEffect(() => {
    const element = sheetRef.current;
    if (!element) return;
    const measure = () => {
      const pageWidth = columns * POCKET_WIDTH_PX + (columns - 1) * 8;
      const available = element.clientWidth;
      setPagesPerSpread(Math.max(1, Math.floor((available + 24) / (pageWidth + 24))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [columns]);

  const pageCount = Math.max(1, Math.ceil(ordered.length / slotsPerPage));
  const spreadCount = Math.max(1, Math.ceil(pageCount / pagesPerSpread));
  const spread = Math.floor(page / pagesPerSpread);

  // Filtering shrinks the binder under the reader's feet; clamp rather than show a blank page.
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  /** The pages visible together, each still a full sheet of pockets. */
  const visiblePages = useMemo(() => {
    const first = spread * pagesPerSpread;
    return Array.from({ length: Math.min(pagesPerSpread, pageCount - first) }, (_, offset) => {
      const start = (first + offset) * slotsPerPage;
      return {
        number: first + offset + 1,
        slots: Array.from({ length: slotsPerPage }, (_, index) => ordered[start + index])
      };
    });
  }, [ordered, spread, pagesPerSpread, pageCount, slotsPerPage]);

  return (
    <div ref={sheetRef} className="flex flex-col gap-3">
      <div className="flex flex-wrap justify-center gap-6">
        {visiblePages.map((binderPage) => (
          <div key={binderPage.number} className="flex flex-col gap-1.5">
            <div
              data-binder-page
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${columns}, ${POCKET_WIDTH_PX}px)` }}
            >
              {binderPage.slots.map((entry, index) =>
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
            {/* Each sheet says which page it is, so a spread of three is not a puzzle. */}
            <span className="text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500 tabular-nums">
              {t('collection.binderSheet', { page: binderPage.number })}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(0, current - pagesPerSpread))}
          disabled={spread === 0}
          aria-label={t('collection.binderPrevious')}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <FaChevronLeft className="text-xs" />
        </button>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 tabular-nums">
          {/* Counts spreads, not pages: with three sheets on screen, "page 1 of 12" would be a lie. */}
          {t('collection.binderSpread', { spread: spread + 1, total: spreadCount, pages: visiblePages.length })}
        </span>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min((spreadCount - 1) * pagesPerSpread, current + pagesPerSpread))}
          disabled={spread >= spreadCount - 1}
          aria-label={t('collection.binderNext')}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <FaChevronRight className="text-xs" />
        </button>
      </div>
    </div>
  );
}
