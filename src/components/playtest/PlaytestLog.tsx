import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileAlt, FaTimes, FaCopy } from 'react-icons/fa';
import { usePlaytestContext } from './PlaytestContext';
import { dispatchToast } from '../../utils/toastHelper';
import { useMountTransition } from '../../hooks/useMountTransition';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export function PlaytestLog() {
  const { t } = useTranslation();
  const { isLogOpen, gameLog, setGameLog, setIsLogOpen } = usePlaytestContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCopyLog = () => {
    if (gameLog.length === 0) return;
    const text = gameLog.map((entry) => `[${entry.timestamp}] ${entry.text}`).join('\n');
    navigator.clipboard?.writeText(text);
    dispatchToast(t('playtest.logCopied'), 'success');
  };

  // Keep the newest entry (rendered at the top) in view as actions come in.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [gameLog.length]);

  const { shouldRender, isClosing } = useMountTransition(isLogOpen);
  // No focus trap here on purpose: isLogOpen defaults to true on desktop
  // (persistent sidebar, not a true modal), so autofocus-on-open would
  // steal focus from the game board every time the simulator mounts.
  useEscapeKey(() => setIsLogOpen(false), shouldRender);

  if (!shouldRender) return null;

  return (
    <>
      {/* Mobile backdrop — tap outside to close the drawer */}
      <button
        type="button"
        aria-label={t('playtest.toggleLogPanel')}
        onClick={() => setIsLogOpen(false)}
        className={`lg:hidden fixed inset-0 z-[var(--z-playtest-dialog)] bg-slate-950/50 backdrop-blur-sm cursor-default ${isClosing ? 'motion-overlay-closing' : 'animate-fadeIn'}`}
      />
      <div
        className={`fixed inset-y-0 right-0 z-[var(--z-playtest-dialog)] w-80 max-w-[85vw] bg-white dark:bg-slate-950 shadow-2xl lg:static lg:inset-auto lg:z-auto lg:w-72 lg:max-w-none lg:shadow-none lg:bg-slate-50 lg:dark:bg-slate-950/30 border-l border-slate-200 dark:border-slate-800/80 flex flex-col h-full shrink-0 no-active-scale ${isClosing ? 'motion-drawer-closing' : 'animate-drawerEnter'}`}
      >
        <div className="p-3 border-b border-slate-200 dark:border-slate-850 flex justify-between items-center bg-white dark:bg-slate-950/50">
          <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 select-none">
            <FaFileAlt className="text-indigo-500 dark:text-indigo-400 text-xs" />
            {t('playtest.playtestLog')}
          </h4>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyLog}
              title={t('playtest.copyLog')}
              aria-label={t('playtest.copyLog')}
              className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <FaCopy className="text-[11px]" />
            </button>
            <button
              type="button"
              onClick={() => setGameLog([])}
              className="text-[9px] text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors uppercase font-bold cursor-pointer"
            >
              {t('playtest.clearLog')}
            </button>
            <button
              type="button"
              onClick={() => setIsLogOpen(false)}
              aria-label={t('playtest.toggleLogPanel')}
              className="lg:hidden text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-[10px] select-text">
          {gameLog.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-600 italic text-center py-8 select-none">
              {t('playtest.playtestLogEmpty')}
            </p>
          ) : (
            [...gameLog].reverse().map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/20 p-1 rounded transition-colors border-b border-slate-200 dark:border-slate-850/30"
              >
                <span className="text-slate-400 dark:text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                <span className="text-slate-700 dark:text-slate-300 break-words leading-tight">{log.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
