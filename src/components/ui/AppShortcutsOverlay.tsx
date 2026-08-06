import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaKeyboard, FaTimes } from 'react-icons/fa';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface AppShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  labelKey: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['Ctrl', 'K'], labelKey: 'commandPalette.title' },
  { keys: ['Ctrl', 'F'], labelKey: 'commandPalette.goToSearch' },
  { keys: ['Ctrl', 'S'], labelKey: 'commandPalette.saveDeck' },
  { keys: ['Ctrl', 'P'], labelKey: 'commandPalette.playtest' },
  { keys: ['Ctrl', 'Shift', 'N'], labelKey: 'commandPalette.clearDeck' },
  { keys: ['?'], labelKey: 'commandPalette.shortcuts' }
];

/** Global keyboard-shortcut reference, toggled with the "?" key. */
export default function AppShortcutsOverlay({ isOpen, onClose }: AppShortcutsOverlayProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return createPortal(
    // Backdrop click is a mouse-only convenience; Escape and the close button provide the keyboard-equivalent action.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-[var(--z-toast)] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-shortcuts-title"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-dropdownEnter"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-800">
          <h3
            id="app-shortcuts-title"
            className="text-sm font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2"
          >
            <FaKeyboard className="text-indigo-500 dark:text-indigo-400" />
            {t('commandPalette.shortcutsTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>
        <div className="p-4 space-y-1.5">
          {SHORTCUTS.map((row) => (
            <div
              key={row.labelKey}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50"
            >
              <span className="text-sm text-gray-700 dark:text-slate-300">{t(row.labelKey)}</span>
              <span className="flex items-center gap-1">
                {row.keys.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-6 text-center bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
