import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlaytestCard } from '../../types/Playtest';
import { FaTimes, FaSearch } from 'react-icons/fa';

import { PlaytestZone, LibraryPlacement } from '../../types/enums';
import { useDismissTransition } from '../../hooks/useDismissTransition';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';

export interface PileExplorerModalProps {
  title: string;
  cards: PlaytestCard[];
  onClose: () => void;
  onMoveCard: (playtestId: string, destination: PlaytestZone, placement?: LibraryPlacement) => void;
}

export default function PileExplorerModal({ title, cards, onClose, onMoveCard }: PileExplorerModalProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [contextMenu, setContextMenu] = React.useState<{ playtestId: string; x: number; y: number } | null>(null);

  const filteredCards = cards.filter((c) => {
    if (!searchTerm) return true;
    const name = (c.card.printed_name || c.card.name || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const handleContextMenu = (e: React.MouseEvent, playtestId: string) => {
    e.preventDefault();
    const menuHeight = 220;
    let y = e.clientY;
    if (window.innerHeight - y < menuHeight) {
      y -= menuHeight;
    }
    setContextMenu({ playtestId, x: e.clientX, y });
  };

  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const { isClosing, requestClose } = useDismissTransition(onClose);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(requestClose);
  const contextMenuRef = useFocusTrap<HTMLDivElement>(!!contextMenu);
  useEscapeKey(() => setContextMenu(null), !!contextMenu);
  const { onTouchStart, onTouchMove, onTouchEnd, panelStyle } = useSwipeToClose<HTMLDivElement>(requestClose);

  return (
    <div
      className={`modal-overlay modal-overlay-sheet ${isClosing ? 'motion-overlay-closing' : ''}`}
      style={{ zIndex: 'var(--z-playtest-dialog)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-sheet-panel sm:max-w-6xl bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-800 flex flex-col h-[92dvh] sm:h-[80vh] relative ${isClosing ? 'motion-dialog-closing' : 'animate-dialogEnter'}`}
        style={panelStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Grab handle: purely a visual affordance now — drag-to-close works
            from anywhere on the sheet (see useSwipeToClose), not just here. */}
        <div className="sm:hidden -mt-4 -mx-4 mb-2 flex justify-center pt-2.5 pb-1" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-slate-700" />
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            {title} <span className="text-slate-400 text-base sm:text-lg font-normal">({cards.length})</span>
          </h2>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative flex-1 sm:flex-none">
              <FaSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('common.searchCards')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
            </div>
            <button
              onClick={requestClose}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {filteredCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredCards.map((item) => (
                <div
                  key={item.playtestId}
                  className="relative group cursor-context-menu"
                  onContextMenu={(e) => handleContextMenu(e, item.playtestId)}
                >
                  <img
                    src={item.card.image_uris?.normal || item.card.card_faces?.[0]?.image_uris?.normal || ''}
                    alt={item.card.name}
                    className="w-full rounded-xl shadow-md transition-transform hover:scale-105"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p className="text-lg">{t('common.noCardsFound')}</p>
            </div>
          )}
        </div>

        {contextMenu && (
          // Only guards against bubbling to the outer close-on-click handler; the buttons inside are the real interactive surface.
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
          <div
            ref={contextMenuRef}
            className="fixed z-[var(--z-playtest-menu)] bg-slate-800 border border-slate-700 shadow-2xl rounded-xl py-1 w-48 animate-fadeIn"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              onClick={() => {
                onMoveCard(contextMenu.playtestId, PlaytestZone.HAND);
                setContextMenu(null);
              }}
            >
              {t('playtest.moveToHand')}
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              onClick={() => {
                onMoveCard(contextMenu.playtestId, PlaytestZone.BATTLEFIELD);
                setContextMenu(null);
              }}
            >
              {t('playtest.moveToBattlefield')}
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              onClick={() => {
                onMoveCard(contextMenu.playtestId, PlaytestZone.LIBRARY, 'top');
                setContextMenu(null);
              }}
            >
              {t('playtest.moveToLibraryTop')}
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              onClick={() => {
                onMoveCard(contextMenu.playtestId, PlaytestZone.LIBRARY, 'bottom');
                setContextMenu(null);
              }}
            >
              {t('playtest.moveToLibraryBottom')}
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              onClick={() => {
                onMoveCard(contextMenu.playtestId, PlaytestZone.GRAVEYARD);
                setContextMenu(null);
              }}
            >
              {t('playtest.moveToGraveyard')}
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-slate-200 transition-colors"
              onClick={() => {
                onMoveCard(contextMenu.playtestId, PlaytestZone.EXILE);
                setContextMenu(null);
              }}
            >
              {t('playtest.moveToExile')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
