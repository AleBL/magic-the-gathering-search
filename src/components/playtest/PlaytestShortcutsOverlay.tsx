import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaKeyboard, FaTimes } from 'react-icons/fa';
import { usePlaytestContext } from './PlaytestContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ShortcutRow {
  keys: string[];
  labelKey: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['D'], labelKey: 'playtest.drawCard' },
  { keys: ['S'], labelKey: 'playtest.shuffle' },
  { keys: ['T'], labelKey: 'playtest.nextTurn' },
  { keys: ['Ctrl', 'Z'], labelKey: 'playtest.undo' },
  { keys: ['Ctrl', 'Y'], labelKey: 'playtest.redo' },
  { keys: ['?'], labelKey: 'playtest.shortcuts' }
];

/** Modal listing the playtest keyboard shortcuts, toggled with the "?" key. */
export function PlaytestShortcutsOverlay() {
  const { t } = useTranslation();
  const { isShortcutsOpen, setIsShortcutsOpen } = usePlaytestContext();
  const closeOverlay = useCallback(() => setIsShortcutsOpen(false), [setIsShortcutsOpen]);
  const dialogRef = useFocusTrap<HTMLDivElement>(isShortcutsOpen);
  useEscapeKey(closeOverlay, isShortcutsOpen);

  /**
   * Escape is also handled on the dialog node itself. `useEscapeKey` listens on window,
   * and while the simulator is open something on the document path swallows a real
   * Escape before it takes effect — a synthetic window keydown closes this overlay, a
   * real keypress does not. Owning the key here makes dismissal independent of that.
   * Attached through the ref rather than an onKeyDown prop so the dialog does not look
   * like a non-interactive element with a keyboard handler.
   */
  useEffect(() => {
    const node = dialogRef.current;
    if (!node || !isShortcutsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeOverlay();
    };

    node.addEventListener('keydown', handleKeyDown);
    return () => node.removeEventListener('keydown', handleKeyDown);
  }, [isShortcutsOpen, closeOverlay, dialogRef]);

  if (!isShortcutsOpen) return null;

  return (
    // Backdrop click is a mouse-only convenience; Escape and the close button provide the keyboard-equivalent action.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-[var(--z-playtest-dialog)] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeOverlay();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playtest-shortcuts-title"
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/40">
          <h3
            id="playtest-shortcuts-title"
            className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2"
          >
            <FaKeyboard className="text-indigo-400" />
            {t('playtest.shortcutsTitle')}
          </h3>
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(false)}
            aria-label={t('common.close')}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>
        <div className="p-4 space-y-1.5">
          {SHORTCUTS.map((row) => (
            <div
              key={row.labelKey}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-800/50"
            >
              <span className="text-sm text-slate-300">{t(row.labelKey)}</span>
              <span className="flex items-center gap-1">
                {row.keys.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-6 text-center bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
