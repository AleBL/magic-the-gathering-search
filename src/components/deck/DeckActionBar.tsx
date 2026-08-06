import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaCopy,
  FaClipboardList,
  FaDownload,
  FaDiceD20,
  FaEdit,
  FaLink,
  FaTimes,
  FaPrint,
  FaFileExport,
  FaChevronDown
} from 'react-icons/fa';
import { Card } from '../../types/Card';
import { Deck } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';
import { downloadAsJson } from '../../services/fileDownload';
import { buildShareUrl } from '../../services/deckShare';

/**
 * Hover tooltip for the icon-only action buttons. Hidden at lg and up, where
 * each button shows its text label inline instead.
 */
function ActionTooltip({ label }: { label: string }) {
  return (
    <div className="lg:hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-slate-900 dark:bg-slate-950 text-white text-[11px] text-center rounded-lg shadow-xl border border-slate-700 dark:border-slate-800 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-all duration-300 z-50 transform translate-y-1 group-hover/tooltip:translate-y-0 whitespace-nowrap">
      <p className="font-medium leading-none">{label}</p>
    </div>
  );
}

interface DeckActionBarProps {
  cards: Card[];
  selectedDeck?: Deck | null;
  showToast: (text: string) => void;
  onPlaytest: () => void;
  onPrintProxies?: () => void;
  /** Mostrado apenas quando há deck selecionado */
  onLoadDeckToEdit?: () => void;
  onDeselectDeck?: () => void;
}

function DeckActionBar({
  cards,
  selectedDeck,
  showToast,
  onPlaytest,
  onPrintProxies,
  onLoadDeckToEdit,
  onDeselectDeck
}: DeckActionBarProps) {
  const { t } = useTranslation();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCopyDeckList = () => {
    if (cards.length === 0) return;
    const counts: Record<string, { count: number; card: Card }> = {};
    cards.forEach((c) => {
      const key = `${c.name}|${c.set}|${c.collector_number}`;
      if (counts[key]) counts[key].count += 1;
      else counts[key] = { count: 1, card: c };
    });
    const listStr = Object.values(counts)
      .map(({ count, card }) => {
        const setCode = card.set ? card.set.toUpperCase() : '';
        const collNum = card.collector_number || '';
        return `${count} ${card.name}${setCode ? ` (${setCode})` : ''}${collNum ? ` ${collNum}` : ''}`;
      })
      .join('\n');
    navigator.clipboard.writeText(listStr).then(() => showToast(t('deck.listCopied')));
  };

  const handleCopyArenaFormat = () => {
    if (cards.length === 0) return;
    const counts: Record<string, { count: number; card: Card }> = {};
    cards.forEach((c) => {
      const key = `${c.name}|${c.set}|${c.collector_number}`;
      if (counts[key]) counts[key].count += 1;
      else counts[key] = { count: 1, card: c };
    });
    const arenaStr = Object.values(counts)
      .map(({ count, card }) => {
        const setCode = card.set ? card.set.toUpperCase() : 'SET';
        const collNum = card.collector_number || '1';
        return `${count} ${card.name} (${setCode}) ${collNum}`;
      })
      .join('\n');
    navigator.clipboard.writeText(arenaStr).then(() => showToast(t('strategy.exportArenaCopied')));
  };

  const handleCopyShareLink = () => {
    if (cards.length === 0) return;
    const deck: Deck = selectedDeck ?? {
      id: '',
      name: t('deck.unnamedDeck'),
      format: DeckFormatType.FREEFORM,
      cards,
      createdAt: new Date().toISOString()
    };
    navigator.clipboard.writeText(buildShareUrl(deck)).then(() => showToast(t('export.linkCopied')));
  };

  const handleDownloadDecFile = () => {
    if (cards.length === 0) return;
    const counts: Record<string, { count: number; card: Card }> = {};
    cards.forEach((c) => {
      const key = `${c.name}|${c.set}|${c.collector_number}`;
      if (counts[key]) counts[key].count += 1;
      else counts[key] = { count: 1, card: c };
    });
    const decContent = Object.values(counts)
      .map(({ count, card }) => {
        const setCode = card.set ? card.set.toUpperCase() : '';
        const collNum = card.collector_number || '';
        return `${count} ${card.name}${setCode ? ` (${setCode})` : ''}${collNum ? ` ${collNum}` : ''}`;
      })
      .join('\r\n');
    const blob = new Blob([decContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDeck?.name || 'deck'}.dec`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(t('deck.deckExported'));
  };

  if (cards.length === 0 && !selectedDeck) return null;

  return (
    // Hidden below `sm`: the navbar's MobilePageMenu (visible at the same
    // breakpoint) owns every action here — playtest/print/export plus
    // edit/back-to-decks when a saved deck is selected.
    <div className="hidden sm:flex flex-wrap gap-2 items-center">
      {cards.length > 0 && (
        <>
          {/* Export Dropdown */}
          <div className="relative inline-flex items-center" ref={dropdownRef}>
            <div className="relative group/tooltip inline-flex items-center">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`flex items-center justify-center gap-1 px-3 h-11 sm:h-8 rounded-lg text-white transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 ${
                  showExportMenu ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
                aria-label={t('deck.export')}
              >
                <FaFileExport className="text-sm shrink-0" />
                <span className="hidden lg:inline text-xs font-semibold">{t('deck.export')}</span>
                <FaChevronDown
                  className={`text-[10px] transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`}
                />
              </button>
              {!showExportMenu && <ActionTooltip label={t('deck.export')} />}
            </div>

            {showExportMenu && (
              <div className="absolute top-full right-0 mt-2 w-56 rounded-xl shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/50 dark:border-white/10 z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                <button
                  type="button"
                  onClick={() => {
                    handleCopyShareLink();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <FaLink className="text-indigo-500 shrink-0" />
                  {t('export.copyLink')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadDecFile();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <FaDownload className="text-purple-500 shrink-0" />
                  {t('strategy.downloadDec')} (.dec)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadAsJson(selectedDeck || { cards }, `${selectedDeck?.name || 'deck'}.json`);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <FaDownload className="text-emerald-500 shrink-0" />
                  {t('export.downloadJson') || 'Download'} (.json)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCopyArenaFormat();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <FaClipboardList className="text-amber-500 shrink-0" />
                  {t('strategy.exportArena')} (Arena)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCopyDeckList();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <FaCopy className="text-blue-500 shrink-0" />
                  {t('deck.copyList')} (.txt)
                </button>
              </div>
            )}
          </div>

          {/* Print Proxies */}
          {onPrintProxies && (
            <div className="relative group/tooltip inline-flex items-center">
              <button
                type="button"
                onClick={onPrintProxies}
                className="flex items-center justify-center gap-1.5 w-11 h-11 sm:w-8 sm:h-8 lg:w-auto lg:px-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-emerald-500/20 active:scale-95"
                aria-label={t('print.printProxies')}
              >
                <FaPrint className="text-sm shrink-0" />
                <span className="hidden lg:inline text-xs font-semibold">{t('print.printProxies')}</span>
              </button>
              <ActionTooltip label={t('print.printProxies')} />
            </div>
          )}

          {/* Playtest button — hidden below sm: the multi-zone simulator isn't
              usable on phone-width screens, so we don't expose an entry point there. */}
          <div className="hidden sm:inline-flex relative group/tooltip items-center">
            <button
              id="playtest-btn"
              type="button"
              onClick={onPlaytest}
              className="flex items-center justify-center gap-1.5 w-11 h-11 sm:w-8 sm:h-8 lg:w-auto lg:px-3 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white transition-all duration-300 shadow-md hover:shadow-orange-500/40 active:scale-95 relative overflow-hidden group/playbtn"
              aria-label={t('playtest.playtest')}
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover/playbtn:scale-x-100 origin-left transition-transform duration-500 ease-out" />
              <FaDiceD20 className="text-sm shrink-0 relative z-10 group-hover/playbtn:animate-spin-slow" />
              <span className="hidden lg:inline text-xs font-semibold relative z-10">{t('playtest.playtest')}</span>
            </button>
            <ActionTooltip label={t('playtest.playtest')} />
          </div>
        </>
      )}

      {selectedDeck && onLoadDeckToEdit && (
        <div className="relative group/tooltip inline-flex items-center">
          <button
            type="button"
            onClick={onLoadDeckToEdit}
            className="flex items-center justify-center gap-1.5 w-11 h-11 sm:w-8 sm:h-8 lg:w-auto lg:px-3 rounded-lg bg-primary hover:bg-primary-hover text-white transition-all duration-300 shadow-md hover:shadow-lg active:scale-95"
            aria-label={t('common.edit')}
          >
            <FaEdit className="text-sm shrink-0" />
            <span className="hidden lg:inline text-xs font-semibold">{t('common.edit')}</span>
          </button>
          <ActionTooltip label={t('common.edit')} />
        </div>
      )}

      {onDeselectDeck && (
        <div className="relative group/tooltip inline-flex items-center">
          <button
            type="button"
            onClick={onDeselectDeck}
            className="flex items-center justify-center gap-1.5 w-11 h-11 sm:w-8 sm:h-8 lg:w-auto lg:px-3 rounded-lg bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white transition-all duration-300 shadow-md hover:shadow-lg active:scale-95"
            aria-label={t('common.cancel')}
          >
            <FaTimes className="text-sm shrink-0" />
            <span className="hidden lg:inline text-xs font-semibold">{t('common.cancel')}</span>
          </button>
          <ActionTooltip label={t('common.cancel')} />
        </div>
      )}
    </div>
  );
}

export default DeckActionBar;
