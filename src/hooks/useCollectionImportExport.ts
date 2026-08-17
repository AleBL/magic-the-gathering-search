import { logger } from '../utils/logger';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionEntry } from '../types/Collection';
import { downloadAsText } from '../services/fileDownload';
import {
  KnownPrintings,
  parseCollectionCsv,
  resolveCollectionCsvRows,
  serializeCollectionCsv
} from '../services/collectionCsv';
import { mergeEntries } from '../services/collectionService';
import { dispatchToast } from '../utils/toastHelper';

export interface ImportProgress {
  done: number;
  total: number;
}

/** CSV import/export for the collection, mirroring the deck import flow's error handling. */
export function useCollectionImportExport(entries: CollectionEntry[]) {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  /**
   * What the collection already holds. Rows matching it are skipped before the network sees
   * them, which is both cheaper and safer: `mergeEntries` sums quantities, so re-running an
   * import that failed half way would otherwise double everything that had landed.
   */
  const known = useMemo<KnownPrintings>(
    () => ({
      ids: new Set(entries.map((entry) => entry.id)),
      setNumbers: new Set(
        entries
          .filter((entry) => entry.card.set && entry.card.collector_number)
          .map((entry) => `${entry.card.set!.toLowerCase()}|${entry.card.collector_number!.toLowerCase()}`)
      )
    }),
    [entries]
  );

  const exportCsv = useCallback(() => {
    if (entries.length === 0) {
      dispatchToast(t('collection.empty'), 'info');
      return;
    }
    downloadAsText(serializeCollectionCsv(entries), `collection-${Date.now()}.csv`, 'text/csv;charset=utf-8');
    dispatchToast(t('collection.exported'), 'success');
  }, [entries, t]);

  const importCsv = useCallback(
    async (file: File): Promise<void> => {
      setIsImporting(true);
      setImportProgress({ done: 0, total: 0 });
      try {
        const text = await file.text();
        const rows = parseCollectionCsv(text);
        if (rows.length === 0) {
          dispatchToast(t('collection.importEmpty'), 'warning');
          return;
        }

        const result = await resolveCollectionCsvRows(rows, { known, onProgress: setImportProgress });
        const { entries: resolved, missing, skipped, unreached, failure } = result;
        if (resolved.length > 0) await mergeEntries(resolved);

        // Appended to whatever the primary outcome was: "nothing happened for these" is part
        // of the report, not an outcome of its own.
        const skippedNote = skipped > 0 ? ` ${t('collection.importSkippedNote', { count: skipped })}` : '';

        if (unreached > 0 && resolved.length === 0) {
          // Nothing landed, so the cause is the whole story.
          const reason =
            failure === 'offline'
              ? t('search.scryfallOffline')
              : failure === 'rateLimited'
                ? t('search.rateLimited')
                : t('collection.importError');
          dispatchToast(reason + skippedNote, 'danger');
        } else if (unreached > 0) {
          // Partial: say what landed, what did not, and that running it again resumes.
          dispatchToast(
            t('collection.importedPartial', { count: resolved.length, failed: unreached }) + skippedNote,
            'warning'
          );
        } else if (resolved.length === 0 && skipped > 0) {
          dispatchToast(t('collection.importAllSkipped', { count: skipped }), 'info');
        } else if (resolved.length === 0) {
          dispatchToast(t('collection.importError'), 'danger');
        } else if (missing.length > 0) {
          dispatchToast(
            t('collection.importedWithMissing', { count: resolved.length, missing: missing.length }) + skippedNote
          );
        } else {
          dispatchToast(t('collection.imported', { count: resolved.length }) + skippedNote, 'success');
        }
      } catch (error) {
        logger.error('Failed to import collection:', error);
        if (error instanceof Error && error.message === 'ScryfallOffline') {
          dispatchToast(t('search.scryfallOffline'), 'danger');
        } else if (error instanceof Error && error.message === 'ScryfallRateLimited') {
          dispatchToast(t('search.rateLimited'), 'danger');
        } else {
          dispatchToast(t('collection.importError'), 'danger');
        }
      } finally {
        setIsImporting(false);
        setImportProgress(null);
      }
    },
    [known, t]
  );

  return { isImporting, importProgress, exportCsv, importCsv };
}
