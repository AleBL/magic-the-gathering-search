import { CSSProperties, useRef, useState } from 'react';

const DISMISS_THRESHOLD_PX = 150;

/**
 * Walks up from the touch target, not the element the handlers sit on: those are often
 * different (an `overflow-hidden` panel wrapping an `overflow-y-auto` body). Stops at the
 * dialog so it never reads the page behind the modal.
 */
function isAtScrollTop(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el) {
    if (el.scrollHeight > el.clientHeight + 1) {
      return el.scrollTop <= 0;
    }
    if (el.getAttribute('role') === 'dialog') break;
    el = el.parentElement;
  }
  return true;
}

/**
 * Drag-to-dismiss for a bottom sheet. Attach the handlers and `panelStyle` to the
 * `role="dialog"` panel so the whole sheet is draggable. The gesture only engages when the
 * touched content is already scrolled to the top, so scrolling and dismissing coexist.
 *
 * Two settings in `panelStyle` are load-bearing:
 * - `touch-action: pan-y` — `none` kills scrolling, `auto` lets the browser's own
 *   pull-to-refresh race these handlers for the same touch.
 * - `translate`, not `transform` — the panel's enter animation animates `transform`, and a
 *   CSS animation beats an inline style on the same property, so the drag would do nothing.
 */
export function useSwipeToClose<T extends HTMLElement>(onClose: () => void) {
  const startY = useRef<number | null>(null);
  const startedAtTop = useRef(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onTouchStart = (e: React.TouchEvent<T>) => {
    startY.current = e.touches[0].clientY;
    startedAtTop.current = isAtScrollTop(e.target);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent<T>) => {
    if (startY.current === null || !startedAtTop.current) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };

  const onTouchEnd = (e: React.TouchEvent<T>) => {
    if (startY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - startY.current;
    const shouldClose = startedAtTop.current && deltaY > DISMISS_THRESHOLD_PX;
    startY.current = null;
    setIsDragging(false);
    setDragY(0);
    if (shouldClose) onClose();
  };

  const panelStyle: CSSProperties = {
    translate: dragY ? `0 ${dragY}px` : undefined,
    transition: isDragging ? 'none' : 'translate 200ms ease-out',
    touchAction: 'pan-y'
  };

  return { onTouchStart, onTouchMove, onTouchEnd, panelStyle };
}
