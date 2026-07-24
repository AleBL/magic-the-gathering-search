import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaHistory, FaTimes, FaTrash, FaUndo, FaChevronDown } from 'react-icons/fa';
import { Deck, DeckVersion } from '../../types/Deck';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { listDeckVersions, deleteDeckVersion } from '../../services/deckVersionService';
import { diffDeckVersions, DeckVersionChange, DeckVersionChangeType } from '../../utils/deckVersionDiff';

interface DeckVersionHistoryModalProps {
  deck: Deck;
  onRestore: (version: DeckVersion) => void;
  onClose: () => void;
}

const CHANGE_LABEL_KEY: Record<DeckVersionChangeType, string> = {
  added: 'deck.changeAdded',
  removed: 'deck.changeRemoved',
  increased: 'deck.changeIncreased',
  decreased: 'deck.changeDecreased',
  printing: 'deck.changePrinting',
  commander: 'deck.changeCommander',
  renamed: 'deck.changeRenamed'
};

const CHANGE_TONE: Record<DeckVersionChangeType, string> = {
  added: 'text-green-600 dark:text-green-400',
  removed: 'text-red-600 dark:text-red-400',
  increased: 'text-green-600 dark:text-green-400',
  decreased: 'text-amber-600 dark:text-amber-400',
  printing: 'text-blue-600 dark:text-blue-400',
  commander: 'text-purple-600 dark:text-purple-400',
  renamed: 'text-gray-600 dark:text-gray-300'
};

/** Human-readable right-hand detail for a change (counts, printings, names). */
function changeDetail(change: DeckVersionChange): string {
  if (change.type === 'added') return `+${change.to}×`;
  if (change.type === 'removed') return `−${change.from}×`;
  if (change.type === 'increased' || change.type === 'decreased') return `${change.from}× → ${change.to}×`;
  if (change.type === 'printing' || change.type === 'renamed') return `${change.from} → ${change.to}`;
  return '';
}

/** Lists a deck's automatic snapshots with a per-snapshot change summary. */
export default function DeckVersionHistoryModal({ deck, onRestore, onClose }: DeckVersionHistoryModalProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(onClose);

  const [versions, setVersions] = useState<DeckVersion[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listDeckVersions(deck.id).then(setVersions);
  }, [deck.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Versions come newest-first, so a snapshot's "previous" is the next entry.
  const changesByVersion = useMemo(() => {
    const map = new Map<string, DeckVersionChange[] | null>();
    versions.forEach((version, index) => {
      const previous = versions[index + 1];
      map.set(version.id, previous ? diffDeckVersions(previous, version) : null);
    });
    return map;
  }, [versions]);

  const handleDelete = async (id: string) => {
    await deleteDeckVersion(id);
    refresh();
  };

  return (
    // Backdrop click is a mouse-only convenience; Escape and the close button cover keyboard users.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-overlay z-[var(--z-overlay)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-history-title"
        className="modal-container sm:max-w-lg w-full overflow-y-auto animate-fadeIn"
      >
        <div className="flex items-center justify-between mb-1">
          <h3
            id="deck-history-title"
            className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"
          >
            <FaHistory className="text-primary" />
            {t('deck.versionHistory')}
          </h3>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label={t('common.close')}>
            <FaTimes />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('deck.versionAutoHint')}</p>

        {versions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">{t('deck.noVersions')}</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((version) => {
              const changes = changesByVersion.get(version.id) ?? null;
              const isOpen = expanded === version.id;

              return (
                <li
                  key={version.id}
                  className="rounded-lg bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                        {t('deck.versionCards', { n: version.cards.length })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : version.id)}
                        aria-expanded={isOpen}
                        className="min-h-11 sm:min-h-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        {t('deck.versionChanges')}
                        <FaChevronDown className={`text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRestore(version)}
                        className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all cursor-pointer"
                      >
                        <FaUndo className="text-xs" />
                        {t('deck.restoreVersion')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(version.id)}
                        aria-label={t('deck.deleteVersion')}
                        className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-200 dark:border-slate-700 p-2.5">
                      {changes === null ? (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('deck.versionFirst')}</p>
                      ) : changes.length === 0 ? (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('deck.versionNoChanges')}</p>
                      ) : (
                        <ul className="space-y-1">
                          {changes.map((change, index) => (
                            <li
                              key={`${change.type}-${change.name}-${index}`}
                              className="flex items-center justify-between gap-2 text-[11px]"
                            >
                              <span className="truncate">
                                <span className={`font-bold ${CHANGE_TONE[change.type]}`}>
                                  {t(CHANGE_LABEL_KEY[change.type])}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300"> — {change.name}</span>
                              </span>
                              <span className="tabular-nums text-gray-500 shrink-0">{changeDetail(change)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
