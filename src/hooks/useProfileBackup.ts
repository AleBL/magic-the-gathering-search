import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadAsText } from '../services/fileDownload';
import {
  ProfileBackup,
  RestoreMode,
  createProfileBackup,
  parseProfileBackup,
  restoreProfileBackup,
  serializeProfileBackup
} from '../services/profileBackup';
import { StorageStatus, readStorageStatus, requestPersistence } from '../services/storagePersistence';
import { dispatchToast } from '../utils/toastHelper';
import { logger } from '../utils/logger';

const EMPTY_STATUS: StorageStatus = { persisted: null, usedBytes: null, quotaBytes: null };

export function useProfileBackup() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StorageStatus>(EMPTY_STATUS);
  const [isWorking, setIsWorking] = useState(false);

  const refreshStatus = useCallback(async () => {
    setStatus(await readStorageStatus());
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const exportBackup = useCallback(async () => {
    setIsWorking(true);
    try {
      const backup = await createProfileBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadAsText(serializeProfileBackup(backup), `deckforge-backup-${stamp}.json`, 'application/json');
      dispatchToast(t('backup.exported'));
    } catch (error) {
      logger.error('Failed to create backup:', error);
      dispatchToast(t('backup.exportFailed'), 'error');
    } finally {
      setIsWorking(false);
    }
  }, [t]);

  /** Reads and validates without writing, so the caller can confirm before replacing. */
  const readBackupFile = useCallback(
    async (file: File): Promise<ProfileBackup | null> => {
      try {
        const backup = parseProfileBackup(await file.text());
        if (!backup) dispatchToast(t('backup.invalidFile'), 'error');
        return backup;
      } catch (error) {
        logger.error('Failed to read backup file:', error);
        dispatchToast(t('backup.invalidFile'), 'error');
        return null;
      }
    },
    [t]
  );

  const restoreBackup = useCallback(
    async (backup: ProfileBackup, mode: RestoreMode) => {
      setIsWorking(true);
      try {
        const summary = await restoreProfileBackup(backup, mode);
        dispatchToast(t('backup.restored', { decks: summary.decks, cards: summary.collection }));
        await refreshStatus();
        return true;
      } catch (error) {
        logger.error('Failed to restore backup:', error);
        dispatchToast(t('backup.restoreFailed'), 'error');
        return false;
      } finally {
        setIsWorking(false);
      }
    },
    [refreshStatus, t]
  );

  const enablePersistence = useCallback(async () => {
    const granted = await requestPersistence();
    await refreshStatus();
    if (granted === null) dispatchToast(t('backup.persistenceUnsupported'), 'info');
    else
      dispatchToast(
        granted ? t('backup.persistenceGranted') : t('backup.persistenceDenied'),
        granted ? 'success' : 'info'
      );
  }, [refreshStatus, t]);

  return { status, isWorking, exportBackup, readBackupFile, restoreBackup, enablePersistence, refreshStatus };
}
