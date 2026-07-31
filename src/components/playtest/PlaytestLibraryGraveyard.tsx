import { useTranslation } from 'react-i18next';
import { FaSkull, FaBan } from 'react-icons/fa';
import cardBack from '../../assets/card-back.jpg';
import { usePlaytestContext } from './PlaytestContext';
import { PlaytestDragData } from '../../types/Playtest';
import { PLAYTEST_PILE_SIZE_CLASSES } from '../../constants';

export function PlaytestLibraryGraveyard() {
  const { t } = useTranslation();
  const {
    library,
    graveyard,
    exile,
    dragOverZone,
    setDragOverZone,
    handleDrawCard,
    handleSendToLibraryPosition,
    setPileExplorerConfig,
    handleSendToGraveyard,
    handleSendToExile,
    handleDiscardFromHand,
    handleLibraryToGraveyard,
    getCardImageUrl,
    setLibraryContextMenu
  } = usePlaytestContext();

  return (
    <div className="flex flex-row lg:flex-col gap-4 items-center justify-center p-3 sm:p-4 border-2 border-dashed border-slate-300 dark:border-slate-700/60 rounded-xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm w-full lg:w-48 shrink-0">
      {/* Library Pile */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t('playtest.draw')}
        onClick={handleDrawCard}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDrawCard();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          if (dragOverZone !== 'library') setDragOverZone('library');
        }}
        onDragLeave={() => setDragOverZone(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setLibraryContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOverZone(null);
          try {
            const data = JSON.parse(event.dataTransfer.getData('text/plain')) as PlaytestDragData;
            if (data.source === 'hand' || data.source === 'battlefield')
              handleSendToLibraryPosition(data.id, 0, data.source); // Put to top
          } catch {
            // Do nothing for unknown drops
          }
        }}
        className={`group relative ${PLAYTEST_PILE_SIZE_CLASSES} rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-2 flex flex-col items-center justify-center cursor-pointer shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 select-none ${library.length === 0 ? 'opacity-30 border-slate-300 dark:border-slate-700' : dragOverZone === 'library' ? 'border-dashed border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-400/30 scale-105' : 'border-indigo-500/30 hover:border-indigo-500'}`}
        draggable={library.length > 0}
        onDragStart={(event) => {
          if (library.length === 0) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.setData('text/plain', JSON.stringify({ id: library[0].playtestId, source: 'library' }));
        }}
      >
        {library.length > 0 ? (
          <>
            <img
              src={library[0].isFaceDown !== false ? cardBack : getCardImageUrl(library[0].card)}
              alt={library[0].isFaceDown !== false ? 'MTG Card Back' : library[0].card.name}
              className="absolute inset-1.5 w-[calc(100%-12px)] h-[calc(100%-12px)] object-cover rounded-[10px]"
            />
            <span className="absolute bottom-3 text-[10px] uppercase font-black tracking-widest text-white bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur-xs group-hover:bg-slate-950/90 transition-colors shadow shadow-black/30">
              {t('playtest.draw').toUpperCase()}
            </span>
            <div className="absolute -top-2 -right-2 bg-indigo-600 text-white font-extrabold text-[9px] w-5 h-5 rounded-full flex items-center justify-center border border-slate-900 shadow shadow-indigo-500/40 z-10">
              {library.length}
            </div>
          </>
        ) : (
          <span className="text-[10px] font-black uppercase text-slate-500">{t('common.empty').toUpperCase()}</span>
        )}
      </div>

      {/* Graveyard Pile */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t('playtest.graveyard')}
        onClick={() => setPileExplorerConfig({ title: t('playtest.graveyard'), pile: 'graveyard' })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPileExplorerConfig({ title: t('playtest.graveyard'), pile: 'graveyard' });
          }
        }}
        className={`group relative ${PLAYTEST_PILE_SIZE_CLASSES} rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 select-none ${
          dragOverZone === 'graveyard'
            ? 'border-dashed border-red-400 bg-red-500/10 shadow-lg shadow-red-500/10 ring-2 ring-red-400/30 scale-105'
            : graveyard.length > 0
              ? 'border-slate-300 dark:border-slate-700 hover:border-red-500/60 hover:shadow-red-500/5 bg-slate-100 dark:bg-slate-950 hover:-translate-y-1 cursor-pointer'
              : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/20 cursor-pointer'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          if (dragOverZone !== 'graveyard') setDragOverZone('graveyard');
        }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOverZone(null);
          try {
            const data = JSON.parse(event.dataTransfer.getData('text/plain')) as PlaytestDragData;
            if (data.source === 'battlefield') handleSendToGraveyard(data.id);
            else if (data.source === 'hand') handleDiscardFromHand(data.id);
            else if (data.source === 'library') handleLibraryToGraveyard(data.id);
          } catch {
            const playtestId = event.dataTransfer.getData('text/plain');
            if (playtestId) handleSendToGraveyard(playtestId);
          }
        }}
      >
        {graveyard.length > 0 ? (
          <>
            <img
              src={getCardImageUrl(graveyard[0].card)}
              alt="Graveyard Top"
              className="w-full h-full object-cover rounded-2xl opacity-40 group-hover:opacity-30 group-hover:scale-98 transition-all"
              loading="lazy"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
              <FaSkull className="text-red-500/70 text-lg mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] uppercase font-black tracking-widest text-slate-350">
                {t('playtest.graveyard').toUpperCase()}
              </span>
            </div>
            <div className="absolute -top-2 -right-2 bg-slate-800 text-slate-300 font-extrabold text-[9px] w-5 h-5 rounded-full flex items-center justify-center border border-slate-900 shadow">
              {graveyard.length}
            </div>
          </>
        ) : (
          <>
            <FaSkull className="text-slate-800 text-lg mb-1" />
            <span className="text-[8px] uppercase font-black tracking-widest text-slate-650">
              {t('playtest.graveyard').toUpperCase()}
            </span>
          </>
        )}
      </div>
      {/* Exile Pile */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t('playtest.exile')}
        onClick={() => setPileExplorerConfig({ title: t('playtest.exile'), pile: 'exile' })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPileExplorerConfig({ title: t('playtest.exile'), pile: 'exile' });
          }
        }}
        className={`group relative ${PLAYTEST_PILE_SIZE_CLASSES} rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 select-none ${
          dragOverZone === 'exile'
            ? 'border-dashed border-gray-400 bg-gray-500/10 shadow-lg shadow-gray-500/10 ring-2 ring-gray-400/30 scale-105'
            : exile.length > 0
              ? 'border-slate-300 dark:border-slate-700 hover:border-gray-500/60 hover:shadow-gray-500/5 bg-slate-100 dark:bg-slate-950 hover:-translate-y-1 cursor-pointer'
              : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/20 cursor-pointer'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          if (dragOverZone !== 'exile') setDragOverZone('exile');
        }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOverZone(null);
          try {
            const data = JSON.parse(event.dataTransfer.getData('text/plain')) as PlaytestDragData;
            handleSendToExile(data.id, data.source);
          } catch {
            const playtestId = event.dataTransfer.getData('text/plain');
            if (playtestId) handleSendToExile(playtestId);
          }
        }}
      >
        {exile.length > 0 ? (
          <>
            <img
              src={getCardImageUrl(exile[0].card)}
              alt="Exile Top"
              className="w-full h-full object-cover rounded-2xl opacity-40 group-hover:opacity-30 group-hover:scale-98 transition-all grayscale"
              loading="lazy"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
              <FaBan className="text-gray-500/70 text-lg mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] uppercase font-black tracking-widest text-slate-350">
                {t('playtest.exile').toUpperCase()}
              </span>
            </div>
            <div className="absolute -top-2 -right-2 bg-slate-800 text-slate-300 font-extrabold text-[9px] w-5 h-5 rounded-full flex items-center justify-center border border-slate-900 shadow">
              {exile.length}
            </div>
          </>
        ) : (
          <>
            <FaBan className="text-slate-800 text-lg mb-1" />
            <span className="text-[8px] uppercase font-black tracking-widest text-slate-650">
              {t('playtest.exile').toUpperCase()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
