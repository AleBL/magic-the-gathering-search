import { logger } from '../utils/logger';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionEntry } from '../types/Collection';
import { downloadAsText } from '../services/fileDownload';
import { parseCollectionCsv, resolveCollectionCsvRows, serializeCollectionCsv } from '../services/collectionCsv';
import { mergeEntries } from '../services/collectionService';
import { dispatchToast } from '../utils/toastHelper';

/** CSV import/export for the collection, mirroring the deck import flow's error handling. */
export function useCollectionImportExport(entries: CollectionEntry[]) {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = useState(false);

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
      try {
        const text = await file.text();
        const rows = parseCollectionCsv(text);
        if (rows.length === 0) {
          dispatchToast(t('collection.importEmpty'), 'warning');
          return;
        }
        const { entries: resolved, missing } = await resolveCollectionCsvRows(rows);
        if (resolved.length > 0) await mergeEntries(resolved);

        if (resolved.length === 0) {
          dispatchToast(t('collection.importError'), 'danger');
        } else if (missing.length > 0) {
          dispatchToast(t('collection.importedWithMissing', { count: resolved.length, missing: missing.length }));
        } else {
          dispatchToast(t('collection.imported', { count: resolved.length }), 'success');
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
      }
    },
    [t]
  );

  return { isImporting, exportCsv, importCsv };
}
