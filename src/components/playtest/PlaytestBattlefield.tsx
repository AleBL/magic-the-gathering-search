import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSync, FaInbox, FaSkull, FaInfoCircle, FaBan, FaEllipsisH } from 'react-icons/fa';
import cardBack from '../../assets/card-back.jpg';
import { usePlaytestContext } from './PlaytestContext';
import { Card } from '../../types/Card';
import { PlaytestCard, PlaytestDragData } from '../../types/Playtest';
import { PLAYTEST_CARD_SIZE_CLASSES, PLAYTEST_CONTEXT_MENU_EDGE_MARGIN_PX } from '../../constants';
import { clampMenuYToViewport } from '../../utils/contextMenuPosition';

const PlaytestBattlefieldCard = memo(
  ({
    playtestCard,
    imageUrl,
    onTap,
    onContextMenu,
    onShowDetails,
    onReturnToHand,
    onSendToGraveyard,
    onSendToExile
  }: {
    playtestCard: PlaytestCard;
    imageUrl: string;
    onTap: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onShowDetails: (card: Card) => void;
    onReturnToHand: (id: string, from: 'battlefield' | 'graveyard') => void;
    onSendToGraveyard: (id: string) => void;
    onSendToExile: (id: string) => void;
  }) => {
    const { t } = useTranslation();
    const { playtestId, card, isTapped, isFaceDown, counters } = playtestCard;

    return (
      <div
        className="group relative transition-all duration-300 flex items-center justify-center"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', JSON.stringify({ id: playtestId, source: 'battlefield' }));
          event.dataTransfer.effectAllowed = 'move';
          (event.currentTarget as HTMLElement).style.opacity = '0.4';
        }}
        onDragEnd={(event) => {
          (event.currentTarget as HTMLElement).style.opacity = '1';
        }}
      >
        <div className={`relative ${PLAYTEST_CARD_SIZE_CLASSES} flex items-center justify-center`}>
          <div
            role="button"
            tabIndex={0}
            aria-label={card.printed_name || card.name}
            onClick={() => onTap(playtestId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTap(playtestId);
              }
            }}
            onContextMenu={(event) => onContextMenu(event, playtestId)}
            className={`absolute w-full h-full rounded-xl overflow-hidden shadow-lg border bg-slate-900 cursor-pointer select-none transition-all duration-300 ${isTapped ? 'border-amber-500/80 ring-2 ring-amber-500/30 rotate-90 scale-90' : 'border-slate-800 hover:scale-105 hover:border-indigo-500'}`}
          >
            {isFaceDown ? (
              <img src={cardBack} alt="Card Back" className="w-full h-full object-cover pointer-events-none" />
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={card.name}
                className="w-full h-full object-cover pointer-events-none"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full p-2 flex flex-col justify-between text-left bg-slate-800">
                <span className="text-[11px] font-black text-white bg-black/50 p-1 rounded leading-tight line-clamp-3 shadow-md">
                  {card.printed_name || card.name}
                </span>
                <span className="text-[9px] font-bold text-slate-400 capitalize">
                  {t(`search.${card.rarity}`, { defaultValue: card.rarity })}
                </span>
              </div>
            )}

            {isTapped && (
              <div className="absolute top-1.5 right-1.5 bg-amber-500 text-slate-950 text-[6px] font-extrabold px-1 rounded shadow uppercase tracking-wider animate-pulse">
                {t('playtest.tapped').toUpperCase()}
              </div>
            )}
            {counters !== undefined && counters > 0 && (
              <div className="absolute bottom-1.5 right-1.5 bg-indigo-500/90 text-white text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full shadow border border-indigo-300 backdrop-blur-sm">
                {counters}
              </div>
            )}
          </div>
        </div>

        <div className="absolute -top-5 sm:-top-4 left-1/2 -translate-x-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 sm:gap-1.5 z-30 bg-slate-900/95 border border-slate-700/80 rounded-full px-1.5 sm:px-2 py-1 shadow-2xl backdrop-blur-sm no-active-scale">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onShowDetails(card);
            }}
            title={t('cardDetails.viewCardDetails')}
            className="relative touch-hitarea w-8 h-8 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-slate-800 text-blue-400 border border-slate-700 hover:bg-blue-500 hover:text-white transition-all text-[10px] sm:text-[9px] cursor-pointer"
          >
            <FaInfoCircle />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTap(playtestId);
            }}
            title={t('playtest.tapUntap')}
            className="relative touch-hitarea w-8 h-8 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-slate-800 text-amber-400 border border-slate-700 hover:bg-amber-500 hover:text-slate-950 transition-all text-[10px] sm:text-[9px] cursor-pointer"
          >
            <FaSync />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReturnToHand(playtestId, 'battlefield');
            }}
            title={t('playtest.returnToHand')}
            className="relative touch-hitarea w-8 h-8 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-slate-800 text-indigo-400 border border-slate-700 hover:bg-indigo-500 hover:text-white transition-all text-[10px] sm:text-[9px] cursor-pointer"
          >
            <FaInbox />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSendToGraveyard(playtestId);
            }}
            title={t('playtest.sendToGraveyard')}
            className="relative touch-hitarea w-8 h-8 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-slate-800 text-red-400 border border-slate-700 hover:bg-red-500 hover:text-white transition-all text-[10px] sm:text-[9px] cursor-pointer"
          >
            <FaSkull />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSendToExile(playtestId);
            }}
            title={t('playtest.moveToExile')}
            className="relative touch-hitarea w-8 h-8 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-slate-800 text-gray-300 border border-slate-700 hover:bg-gray-500 hover:text-white transition-all text-[10px] sm:text-[9px] cursor-pointer"
          >
            <FaBan />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onContextMenu(event, playtestId);
            }}
            title={t('common.moreActions')}
            className="relative touch-hitarea w-8 h-8 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-600 hover:text-white transition-all text-[10px] sm:text-[9px] cursor-pointer"
          >
            <FaEllipsisH />
          </button>
        </div>
      </div>
    );
  }
);

PlaytestBattlefieldCard.displayName = 'PlaytestBattlefieldCard';

export function PlaytestBattlefield() {
  const { t } = useTranslation();
  const {
    battlefield,
    dragOverZone,
    setDragOverZone,
    handlePlayCard,
    handleToggleTapCard,
    getCardImageUrl,
    setSelectedDetailCard,
    handleReturnToHand,
    handleSendToGraveyard,
    handleSendToExile,
    setContextMenu
  } = usePlaytestContext();

  const handleContextMenu = (e: React.MouseEvent, playtestId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const y = clampMenuYToViewport(e.clientY, 250, PLAYTEST_CONTEXT_MENU_EDGE_MARGIN_PX);
    setContextMenu({ playtestId, x: e.clientX, y, zone: 'battlefield' });
  };

  return (
    <div
      className={`flex-1 border rounded-2xl p-3 sm:p-4 min-h-[200px] sm:min-h-[300px] flex flex-col transition-all duration-300 ${
        dragOverZone === 'battlefield'
          ? 'border-2 border-dashed border-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-400/30'
          : 'border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/10'
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dragOverZone !== 'battlefield') setDragOverZone('battlefield');
      }}
      onDragLeave={() => setDragOverZone(null)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOverZone(null);
        try {
          const data = JSON.parse(event.dataTransfer.getData('text/plain')) as PlaytestDragData;
          if (data.source === 'hand') handlePlayCard(data.id);
        } catch {
          const playtestId = event.dataTransfer.getData('text/plain');
          if (playtestId) handlePlayCard(playtestId);
        }
      }}
    >
      <div className="text-xs uppercase font-extrabold tracking-widest text-slate-500 mb-3 flex items-center justify-between select-none">
        <div>{t('playtest.battlefield')}</div>
      </div>

      {battlefield.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 pointer-events-none w-full mx-auto">
          <p className="text-sm text-slate-500 font-semibold italic">{t('playtest.emptyBattlefieldMessage')}</p>
          <p className="text-xs text-slate-600 mt-1">{t('playtest.playCardsHint')}</p>
        </div>
      ) : (
        <div className="w-full h-full flex flex-wrap gap-4 items-center justify-center p-2 relative z-10">
          {battlefield.map((playtestCard) => (
            <PlaytestBattlefieldCard
              key={playtestCard.playtestId}
              playtestCard={playtestCard}
              imageUrl={getCardImageUrl(playtestCard.card)}
              onTap={handleToggleTapCard}
              onContextMenu={handleContextMenu}
              onShowDetails={setSelectedDetailCard}
              onReturnToHand={handleReturnToHand}
              onSendToGraveyard={handleSendToGraveyard}
              onSendToExile={handleSendToExile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
