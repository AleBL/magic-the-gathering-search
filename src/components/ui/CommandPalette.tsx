import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  FaSearch,
  FaBook,
  FaBoxOpen,
  FaSave,
  FaFlask,
  FaTrash,
  FaSun,
  FaMoon,
  FaKeyboard,
  FaGlobe
} from 'react-icons/fa';
import { dispatchPendingAction } from '../../hooks/usePendingAction';
import { SUPPORTED_LANGUAGES } from '../../constants';
import { AppTab } from '../../types';
import { useMountTransition } from '../../hooks/useMountTransition';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords: string;
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: AppTab) => void;
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  onShowShortcuts: () => void;
}

const LANGUAGE_LABELS: Record<string, string> = { en: 'English', pt: 'Português', es: 'Español' };

/** Fuzzy-ish command launcher opened with Ctrl/Cmd+K. */
export default function CommandPalette({
  isOpen,
  onClose,
  setActiveTab,
  isDarkMode,
  setIsDarkMode,
  onShowShortcuts
}: CommandPaletteProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const run = (action: () => void) => {
    action();
    onClose();
  };

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      {
        id: 'search',
        label: t('commandPalette.goToSearch'),
        icon: <FaSearch />,
        keywords: 'search buscar cards cartas find',
        run: () => {
          setActiveTab('search');
          dispatchPendingAction('focus-search');
        }
      },
      {
        id: 'decks',
        label: t('commandPalette.goToDecks'),
        icon: <FaBook />,
        keywords: 'deck decks mazo manager',
        run: () => setActiveTab('deck')
      },
      {
        id: 'collection',
        label: t('commandPalette.goToCollection'),
        icon: <FaBoxOpen />,
        keywords: 'collection coleccion coleção owned wishlist have',
        run: () => setActiveTab('collection')
      },
      {
        id: 'save',
        label: t('commandPalette.saveDeck'),
        hint: 'Ctrl+S',
        icon: <FaSave />,
        keywords: 'save salvar guardar deck',
        run: () => {
          setActiveTab('deck');
          dispatchPendingAction('save-deck');
        }
      },
      {
        id: 'playtest',
        label: t('commandPalette.playtest'),
        hint: 'Ctrl+P',
        icon: <FaFlask />,
        keywords: 'playtest simular test jugar jogar',
        run: () => {
          setActiveTab('deck');
          dispatchPendingAction('playtest-deck');
        }
      },
      {
        id: 'clear',
        label: t('commandPalette.clearDeck'),
        hint: 'Ctrl+Shift+N',
        icon: <FaTrash />,
        keywords: 'clear limpar limpiar deck reset',
        run: () => {
          setActiveTab('deck');
          dispatchPendingAction('clear-deck');
        }
      },
      {
        id: 'theme',
        label: isDarkMode ? t('commandPalette.lightMode') : t('commandPalette.darkMode'),
        icon: isDarkMode ? <FaSun /> : <FaMoon />,
        keywords: 'theme tema dark light claro escuro modo',
        run: () => setIsDarkMode((prev) => !prev)
      },
      {
        id: 'shortcuts',
        label: t('commandPalette.shortcuts'),
        hint: '?',
        icon: <FaKeyboard />,
        keywords: 'shortcuts atalhos atajos keyboard teclado help',
        run: onShowShortcuts
      }
    ];

    const languageCommands: Command[] = SUPPORTED_LANGUAGES.map((lng) => ({
      id: `lang-${lng}`,
      label: `${t('commandPalette.language')}: ${LANGUAGE_LABELS[lng] ?? lng}`,
      icon: <FaGlobe />,
      keywords: `language idioma ${lng} ${LANGUAGE_LABELS[lng] ?? ''}`,
      run: () => i18n.changeLanguage(lng)
    }));

    return [...base, ...languageCommands];
  }, [t, i18n, isDarkMode, setActiveTab, setIsDarkMode, onShowShortcuts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const { shouldRender, isClosing } = useMountTransition(isOpen);
  const dialogRef = useFocusTrap<HTMLDivElement>(shouldRender);
  useEscapeKey(onClose, shouldRender);

  if (!shouldRender) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const command = filtered[selectedIndex];
      if (command) run(command.run);
    }
  };

  return createPortal(
    // Backdrop click is a mouse-only convenience; Escape provides the keyboard-equivalent action.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className={`fixed inset-0 z-[var(--z-toast)] flex items-start justify-center pt-[15vh] px-4 bg-slate-950/60 backdrop-blur-sm ${isClosing ? 'motion-overlay-closing' : 'animate-fadeIn'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Arrow-key navigation over the command list within this already keyboard-accessible dialog. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.title')}
        className={`w-full max-w-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden ${isClosing ? 'motion-dialog-closing' : 'animate-dropdownEnter'}`}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-slate-800">
          <FaSearch className="text-gray-400 shrink-0 text-sm" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('commandPalette.placeholder')}
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
          <kbd className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('commandPalette.noResults')}</p>
          ) : (
            filtered.map((command, index) => (
              <button
                key={command.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => run(command.run)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  index === selectedIndex
                    ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="text-sm shrink-0 opacity-80">{command.icon}</span>
                <span className="flex-1 text-sm font-medium">{command.label}</span>
                {command.hint && (
                  <kbd className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                    {command.hint}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
