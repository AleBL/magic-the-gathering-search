import { memo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEdit, FaDownload, FaTrash, FaEllipsisV, FaClone, FaPlus, FaLayerGroup } from 'react-icons/fa';
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
}

export const DeckListItem = memo(function DeckListItem({
  deck,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onExport,
  onDuplicate,
  onNewFrom,
  onDelete
}: DeckListItemProps) {
  const { t } = useTranslation();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
      role="button"
      tabIndex={0}
      onClick={() => onSelect(deck)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(deck);
        }
      }}
      className={`deck-box cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'deck-box-active' : 'deck-box-inactive'} ${showExportMenu ? 'z-50' : 'z-0'}`}
    >
      {/* Hero art banner — the "deck box" identity (commander / chosen cover). */}
      <div className="deck-box-art">
        {coverArt ? (
          <img src={coverArt} alt="" loading="lazy" className="deck-box-art-image" />
        ) : (
          <div className="deck-box-art-placeholder">
            <FaLayerGroup />
          </div>
        )}
        <div className="deck-box-art-scrim" />
        <div className="deck-box-title-row">
          <p className="deck-box-title">{deck.name}</p>
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
                className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1"
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
