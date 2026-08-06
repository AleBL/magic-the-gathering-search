import { useTranslation } from 'react-i18next';
import {
  FaMinus,
  FaPlus,
  FaInbox,
  FaCheck,
  FaSkull,
  FaFileAlt,
  FaTimes,
  FaUndo,
  FaRedo,
  FaKeyboard
} from 'react-icons/fa';
import { usePlaytestContext } from './PlaytestContext';

export function PlaytestControlBarTop({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const {
    handleUntapAll,
    handleNextTurn,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    lifeTotal,
    setLifeTotal,
    isMulliganPhase,
    turn,
    mulligans,
    setPileExplorerConfig,
    setIsShortcutsOpen,
    library,
    hand,
    graveyard,
    isLogOpen,
    setIsLogOpen,
    setScrySurveilPrompt
  } = usePlaytestContext();

  return (
    <div className="relative bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-2 sm:p-4 shrink-0 shadow-sm z-50">
      <div className="flex justify-between items-center max-w-7xl mx-auto w-full pr-8">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <button
            type="button"
            onClick={handleUntapAll}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 sm:px-4 py-1.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-lg transition-all shadow-sm hover:shadow active:scale-95"
          >
            {t('playtest.untapAll')}
          </button>
          <button
            type="button"
            onClick={handleNextTurn}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 sm:px-4 py-1.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-lg transition-all shadow-sm hover:shadow active:scale-95"
          >
            {t('playtest.nextTurn')}
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title={`${t('playtest.undo')} (Ctrl+Z)`}
              className="w-11 h-11 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs"
            >
              <FaUndo />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title={`${t('playtest.redo')} (Ctrl+Y)`}
              className="w-11 h-11 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs"
            >
              <FaRedo />
            </button>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 rounded-xl px-2 sm:px-3 py-1 shadow-inner gap-1.5 sm:gap-2">
            <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider">
              {t('playtest.life')}:
            </span>
            <button
              type="button"
              onClick={() => setLifeTotal((prev: number) => prev - 1)}
              className="w-11 h-11 sm:w-5 sm:h-5 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <FaMinus className="text-[11px] sm:text-[8px]" />
            </button>
            <span className="text-sm font-extrabold text-gray-900 dark:text-white w-6 text-center select-none font-mono drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
              {lifeTotal}
            </span>
            <button
              type="button"
              onClick={() => setLifeTotal((prev: number) => prev + 1)}
              className="w-11 h-11 sm:w-5 sm:h-5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <FaPlus className="text-[11px] sm:text-[8px]" />
            </button>
          </div>

          {!isMulliganPhase && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 rounded-xl px-2 sm:px-3 py-1 shadow-inner gap-2 hidden sm:flex">
              <span className="text-[9px] sm:text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider">
                {t('playtest.turnLabel', { turn })}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <div className="hidden lg:flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setPileExplorerConfig({ title: t('playtest.library'), pile: 'library' })}
              className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title={t('playtest.viewLibrary')}
            >
              <FaInbox className="text-slate-400 dark:text-slate-500" />
              {t('playtest.library')}: <strong className="text-slate-700 dark:text-slate-200">{library.length}</strong>
            </button>
            <span className="flex items-center gap-1.5">
              <FaCheck className="text-slate-400 dark:text-slate-500" />
              {t('playtest.hand')}: <strong className="text-slate-700 dark:text-slate-200">{hand.length}</strong>
            </span>
            <button
              type="button"
              onClick={() => setPileExplorerConfig({ title: t('playtest.graveyard'), pile: 'graveyard' })}
              className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title={t('playtest.viewGraveyard')}
            >
              <FaSkull className="text-slate-400 dark:text-slate-500" />
              {t('playtest.graveyard')}:{' '}
              <strong className="text-slate-700 dark:text-slate-200">{graveyard.length}</strong>
            </button>
            {mulligans > 0 && (
              <span className="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
                Mulligan: <strong>{mulligans}</strong>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsLogOpen((prev: boolean) => !prev)}
            title={t('playtest.toggleLogPanel')}
            className={`p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-lg border transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
              isLogOpen
                ? 'bg-indigo-100 border-indigo-200 text-indigo-600 dark:bg-indigo-600/20 dark:border-indigo-500/40 dark:text-indigo-400'
                : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FaFileAlt className="text-xs shrink-0" />
            <span className="hidden md:inline font-bold">{t('playtest.playtestLog')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShortcutsOpen((prev: boolean) => !prev)}
            title={`${t('playtest.shortcuts')} (?)`}
            className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-lg border bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-all text-xs flex items-center justify-center cursor-pointer"
          >
            <FaKeyboard className="text-xs shrink-0" />
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScrySurveilPrompt({ type: 'scry' })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1.5 min-h-[44px] sm:min-h-0 rounded transition-colors cursor-pointer"
            >
              {t('playtest.scry')}
            </button>
            <button
              type="button"
              onClick={() => setScrySurveilPrompt({ type: 'surveil' })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1.5 min-h-[44px] sm:min-h-0 rounded transition-colors cursor-pointer"
            >
              {t('playtest.surveil')}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow"
      >
        <FaTimes />
      </button>
    </div>
  );
}
