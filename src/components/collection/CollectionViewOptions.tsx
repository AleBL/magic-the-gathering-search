import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaSlidersH, FaTh, FaList, FaBook, FaCheckSquare, FaFolderOpen } from 'react-icons/fa';
import { CardSize } from '../../types';
import type { BinderLayout } from './CollectionBinderView';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export type CollectionViewMode = 'grid' | 'list' | 'binder' | 'checklist' | 'bySet';

/**
 * A binder page is three columns whatever the screen. Below `sm` that gives ~95px cards —
 * too small to recognise, and the page metaphor stops paying for itself. The option is hidden
 * there rather than offered and disappointing.
 */
const BINDER_MIN_WIDTH = '(min-width: 640px)';

interface CollectionViewOptionsProps {
  viewMode: CollectionViewMode;
  setViewMode: (mode: CollectionViewMode) => void;
  cardSize: CardSize;
  onCardSizeChange: (size: CardSize) => void;
  binderLayout: BinderLayout;
  onBinderLayoutChange: (layout: BinderLayout) => void;
}

/**
 * View picker for the collection, built on the same button + portalled dropdown the deck tab
 * uses, so both tabs read as one system rather than two conventions.
 */
export function CollectionViewOptions({
  viewMode,
  setViewMode,
  cardSize,
  onCardSizeChange,
  binderLayout,
  onBinderLayoutChange
}: CollectionViewOptionsProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canUseBinder = useMediaQuery(BINDER_MIN_WIDTH);

  // Falling back rather than rendering three unreadable columns if the window shrinks.
  useLayoutEffect(() => {
    if (!canUseBinder && viewMode === 'binder') setViewMode('grid');
  }, [canUseBinder, viewMode, setViewMode]);

  // Portalled, so the dropdown is not clipped by the filter panel it sits inside.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen]);

  const modes = (
    [
      { mode: 'grid', label: t('collection.viewGrid'), icon: FaTh },
      { mode: 'list', label: t('collection.viewList'), icon: FaList },
      { mode: 'binder', label: t('collection.viewBinder'), icon: FaBook },
      { mode: 'checklist', label: t('collection.viewChecklist'), icon: FaCheckSquare },
      { mode: 'bySet', label: t('collection.viewBySet'), icon: FaFolderOpen }
    ] as const
  ).filter((entry) => entry.mode !== 'binder' || canUseBinder);

  const activeLabel = modes.find((entry) => entry.mode === viewMode)?.label ?? t('common.viewMode');

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`display-settings-btn ${isOpen ? 'display-settings-btn-active' : ''}`}
        title={t('common.viewMode')}
      >
        <FaSlidersH className="text-xs shrink-0 text-blue-500 dark:text-blue-400" />
        <span>{activeLabel}</span>
        <span
          className="text-[9px] opacity-60 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
        >
          ▼
        </span>
      </button>

      {isOpen && anchor
        ? createPortal(
            <>
              {/* Backdrop click is a mouse-only convenience; Escape covers the keyboard. */}
              <div
                className="fixed inset-0 z-[var(--z-backdrop)]"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />
              <div
                className="display-settings-dropdown"
                style={{ position: 'fixed', top: anchor.top, right: anchor.right, marginTop: 0 }}
              >
                <div className="space-y-2">
                  <span className="display-settings-section-label">{t('common.viewMode')}</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {modes.map(({ mode, label, icon: Icon }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setViewMode(mode);
                          setIsOpen(false);
                        }}
                        aria-pressed={viewMode === mode}
                        className={`option-toggle-btn ${viewMode === mode ? 'option-toggle-btn-active' : ''}`}
                        title={label}
                      >
                        <Icon className="text-sm" />
                        <span className="text-[10px] leading-none">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* The binder draws cards at a fixed, true-to-life size, so what varies is the
                    sheet: how many pockets a page holds. */}
                {viewMode === 'binder' ? (
                  <div className="space-y-2">
                    <span className="display-settings-section-label">{t('collection.binderLayout')}</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['3x3', '2x2'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => onBinderLayoutChange(option)}
                          aria-pressed={binderLayout === option}
                          className={`option-toggle-btn-compact ${binderLayout === option ? 'option-toggle-btn-compact-active' : ''}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Card size only means anything where cards are actually drawn. Rendered as a
                    compact four-up grid rather than the standalone selector, which is sized for
                    a toolbar and overflowed this dropdown off the edge of the screen. */}
                {viewMode === 'grid' ? (
                  <div className="space-y-2">
                    <span className="display-settings-section-label">{t('search.cardSize')}</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { key: 'small', label: t('search.smallInitial') },
                          { key: 'medium', label: t('search.mediumInitial') },
                          { key: 'large', label: t('search.largeInitial') },
                          { key: 'xlarge', label: t('search.xlargeInitial') }
                        ] as const
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onCardSizeChange(key)}
                          aria-pressed={cardSize === key}
                          title={t(`search.${key}`)}
                          className={`option-toggle-btn-compact ${cardSize === key ? 'option-toggle-btn-compact-active' : ''}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
