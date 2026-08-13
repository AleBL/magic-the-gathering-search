import { memo, useState, useRef, useEffect } from 'react';
import { useDropDirection } from '../../hooks/useDropDirection';
import { useTranslation } from 'react-i18next';
import { FaEdit, FaDownload, FaTrash, FaEllipsisV, FaClone, FaPlus, FaLayerGroup, FaImage } from 'react-icons/fa';
import { Deck, DeckFormat } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';
import { validateDeck } from '../../utils/deckValidator';
import { formatLabelKey } from '../../utils/formatLabel';
import { resolveDeckCoverArt } from '../../utils/deckCover';
import DeckValidationBadge from './DeckValidationBadge';

interface DeckListItemProps {
  deck: Deck;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (deck: Deck) => void;
  /** Double-click: select and commit — the modal uses it to pick a deck and close. */
  onActivate?: (deck: Deck) => void;
  onEdit: (
    id: string,
    name: string,
    format: DeckFormat,
    cards: Deck['cards'],
    notes?: string,
    relatedTokens?: Deck['relatedTokens']
  ) => void;
  onExport: (deck: Deck) => void;
  onDuplicate: (deck: Deck) => void;
  onNewFrom: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
  onChangeCover: (deck: Deck) => void;
}

export const DeckListItem = memo(function DeckListItem({
  deck,
  isSelected,
  isEditing,
  onSelect,
  onActivate,
  onEdit,
  onExport,
  onDuplicate,
  onNewFrom,
  onDelete,
  onChangeCover
}: DeckListItemProps) {
  const { t } = useTranslation();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  // ~5 items plus padding. Enough to decide the direction; the menu is not measured because
  // it does not exist until it is open.
  const dropDirection = useDropDirection(menuTriggerRef, showExportMenu, 240);
  const boxRef = useRef<HTMLDivElement>(null);

  // Bring the selected deck into view when it becomes the selection. Without this, picking a
  // deck in the all-decks modal left the sidebar scrolled wherever it happened to be, so the
  // deck you just chose was often off-screen once the modal closed.
  //
  // Only when it is actually out of view: scrolling something already on screen is motion for
  // nothing, and a smooth scroll keeps the whole layout moving — enough to make a click land
  // on a shifting target.
  useEffect(() => {
    const node = boxRef.current;
    if (!isSelected || !node) return;

    const rect = node.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (fullyVisible) return;

    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [isSelected]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const validation = validateDeck(deck.cards, deck.format || DeckFormatType.FREEFORM);
  const coverArt = resolveDeckCoverArt(deck);

  return (
    <div
      ref={boxRef}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(deck)}
      onDoubleClick={() => onActivate?.(deck)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Enter is the keyboard equivalent of the double-click shortcut; Space just selects.
          if (e.key === 'Enter' && onActivate) onActivate(deck);
          else onSelect(deck);
        }
      }}
      className={`deck-box cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'deck-box-active' : 'deck-box-inactive'} ${showExportMenu ? 'z-50' : 'z-0'}`}
    >
      {/*
        Below lg the list sits above the deck in page flow, so a cover per deck turns choosing
        one into a long scroll past pictures — the art is dropped there and each deck is a
        compact row. From lg up it is a sidebar and the cover returns as the deck-box identity.

        The title is rendered once and repositioned, not duplicated: two copies put the deck
        name in the accessible name twice and left tests matching a hidden node.
      */}
      <div className="relative">
        <div className="deck-box-art hidden lg:block">
          {coverArt ? (
            <img src={coverArt} alt="" loading="lazy" className="deck-box-art-image" />
          ) : (
            <div className="deck-box-art-placeholder">
              <FaLayerGroup />
            </div>
          )}
          <div className="deck-box-art-scrim" />
        </div>
        <div className="deck-box-title-row-compact">
          <p className="deck-box-title-compact">{deck.name}</p>
          {isEditing && <span className="deck-list-item-editing-badge" title={t('deck.editingDeck')} />}
        </div>
      </div>

      <div className="deck-box-footer">
        <div className="deck-list-item-meta pointer-events-none">
          <span
            className={`text-xs ${isSelected ? 'text-blue-700 dark:text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {deck.cards.length} {t('common.cards')}
          </span>
          <span
            className={`format-badge deck-list-item-format-badge ${isSelected ? 'deck-list-item-format-badge-selected' : 'deck-list-item-format-badge-default'}`}
          >
            {t(formatLabelKey(deck.format))}
          </span>
          <DeckValidationBadge
            validation={validation}
            formatKey={deck.format || DeckFormatType.FREEFORM}
            variant="compact"
          />
        </div>

        <div className="deck-list-item-actions pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(
                deck.id,
                deck.name,
                deck.format || DeckFormatType.FREEFORM,
                deck.cards,
                deck.notes,
                deck.relatedTokens
              );
            }}
            className={`button-small deck-list-action-btn bg-primary hover:bg-primary-hover text-white flex items-center justify-center min-w-[32px]`}
            title={t('common.edit')}
            aria-label={`${t('common.edit')} ${deck.name}`}
          >
            <FaEdit className="text-sm" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExport(deck);
            }}
            className="button-small deck-list-action-btn bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center min-w-[32px]"
            title={t('deck.export')}
            aria-label={`${t('deck.export')} ${deck.name}`}
          >
            <FaDownload className="text-sm" />
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowExportMenu((open) => !open);
              }}
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
              className="button-small deck-list-action-btn bg-slate-500 hover:bg-slate-600 text-white flex items-center justify-center min-w-[32px]"
              title={t('common.moreActions')}
              aria-label={`${t('common.moreActions')} ${deck.name}`}
            >
              <FaEllipsisV className="text-sm" />
            </button>
            {showExportMenu ? (
              <div
                role="menu"
                className={`absolute right-0 z-[var(--z-dropdown)] min-w-[190px] rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1 ${
                  dropDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExportMenu(false);
                    onDuplicate(deck);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <FaClone className="text-xs shrink-0" />
                  {t('deck.duplicateDeck')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExportMenu(false);
                    onNewFrom(deck);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <FaPlus className="text-xs shrink-0" />
                  {t('deck.newDeckFromThis')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExportMenu(false);
                    onChangeCover(deck);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <FaImage className="text-xs shrink-0" />
                  {t('deck.setCover')}
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(deck);
            }}
            className={`button-small deck-list-action-btn danger-button flex items-center justify-center min-w-[32px]`}
            title={t('deck.delete')}
            aria-label={`${t('deck.delete')} ${deck.name}`}
          >
            <FaTrash className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
});
