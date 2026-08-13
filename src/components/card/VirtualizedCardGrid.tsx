import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import CardItem from './CardItem';
import { Card } from '../../types/Card';
import { CardSize } from '../../types';

/**
 * Windowed version of {@link CardGrid} for the collection, which is the only surface that
 * can hold thousands of cards. Measured at 5,000 entries: 95,000 DOM nodes, one IndexedDB
 * read per card (`useCardCollection` runs per rendered card) and ~426 ms scroll frames.
 * An unmounted card runs no hook, so windowing removes both costs at once.
 */

interface VirtualizedCardGridProps {
  cards: Card[];
  size: CardSize;
  /** The scrolling ancestor — `.workspace-body`, not the window. */
  scrollRef: RefObject<HTMLElement | null>;
  showCollectionControls?: boolean;
  showPrintingBadge?: boolean;
}

const GRID_CLASSES: Record<CardSize, string> = {
  small: 'card-grid-small',
  medium: 'card-grid-medium',
  large: 'card-grid-large',
  xlarge: 'card-grid-xlarge'
};

/** Rough card height as a multiple of its width, until a real row is measured. */
const CARD_ASPECT = 1.45;

interface GridMetrics {
  columns: number;
  rowGap: number;
  trackWidth: number;
}

export default function VirtualizedCardGrid({
  cards,
  size,
  scrollRef,
  showCollectionControls = false,
  showPrintingBadge = false
}: VirtualizedCardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<GridMetrics>({ columns: 1, rowGap: 16, trackWidth: 180 });

  // Read the layout the browser resolved instead of recomputing the CSS minmax floors in
  // JS: they differ per breakpoint (see the max-width:639px block in layout.css) and a
  // second copy here would silently drift from the stylesheet.
  useLayoutEffect(() => {
    const element = gridRef.current;
    if (!element) return;

    const read = () => {
      const style = getComputedStyle(element);
      const tracks = style.gridTemplateColumns.split(' ').filter(Boolean);
      setMetrics({
        columns: Math.max(1, tracks.length),
        rowGap: Math.round(parseFloat(style.rowGap) || 0),
        trackWidth: Math.round(parseFloat(tracks[0]) || 180)
      });
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [size]);

  const { columns, rowGap, trackWidth } = metrics;
  const rowCount = Math.ceil(cards.length / columns);

  /**
   * Every row holds identical cards, so one measurement describes all of them — measured, not
   * assumed: at any one card size every row comes back the same height, because names are
   * truncated rather than wrapped. Measuring rows individually would keep the total height an
   * estimate and the scrollbar would drift, so jumping to the bottom would land short.
   *
   * The measurement is only valid for the layout that produced it. Switching card size (or a
   * resize that changes the track width) makes rows taller or shorter, and a stale height left
   * the virtualizer spacing rows by the old value: at 223px spacing with 437px rows, every row
   * overlapped the one above by 214px — cards drawn on top of each other. Tagging the
   * measurement with the layout that produced it discards it exactly when it stops applying.
   */
  const layoutKey = `${size}:${trackWidth}:${rowGap}`;
  const [measured, setMeasured] = useState({ key: layoutKey, height: 0 });
  const rowHeight = measured.key === layoutKey ? measured.height : 0;
  const measuredHeight = rowHeight || Math.round(trackWidth * CARD_ASPECT) + rowGap;

  const rowObserverRef = useRef<ResizeObserver | null>(null);

  const measureRow = useCallback(
    (element: HTMLDivElement | null) => {
      rowObserverRef.current?.disconnect();
      rowObserverRef.current = null;
      if (!element) return;

      const update = () => {
        const height = Math.round(element.getBoundingClientRect().height);
        // A row measured before its cards have laid out is just its own bottom padding.
        // Accepting that (the old check was only `> 0`) set the pitch to 8px and drew every
        // row on top of the next. Keep waiting until the row is taller than its padding.
        if (height <= rowGap) return;
        setMeasured((current) =>
          current.key === layoutKey && current.height === height ? current : { key: layoutKey, height }
        );
      };

      update();
      // Observed rather than measured once: card art loading, a font swap or a card-size
      // change all resize the row after the ref first fires.
      const observer = new ResizeObserver(update);
      observer.observe(element);
      rowObserverRef.current = observer;
    },
    [layoutKey, rowGap]
  );

  useEffect(() => () => rowObserverRef.current?.disconnect(), []);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(() => measuredHeight, [measuredHeight]),
    overscan: 3
  });

  // The virtualizer caches each item's measurement, so a new `estimateSize` alone does not
  // reposition rows already in that cache — they keep the previous pitch and overlap.
  useEffect(() => {
    virtualizer.measure();
  }, [measuredHeight, virtualizer]);

  return (
    <div
      ref={gridRef}
      className={GRID_CLASSES[size]}
      // Rows are positioned out of flow, so this element contributes only its resolved
      // track list (read above) and the total scroll height.
      style={{ position: 'relative', height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const start = row.index * columns;
        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={row.index === 0 ? measureRow : undefined}
            className={GRID_CLASSES[size]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`,
              // The gutter between rows belongs to the measured height; without it rows
              // stack flush and the grid loses its vertical rhythm.
              paddingBottom: `${rowGap}px`
            }}
          >
            {cards.slice(start, start + columns).map((card, index) => (
              <div key={`${card.id}-${start + index}`} className="animate-fadeIn">
                <CardItem
                  card={card}
                  size={size}
                  showCollectionControls={showCollectionControls}
                  showPrintingBadge={showPrintingBadge}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
