import { logger } from '../utils/logger';
import { dispatchToast } from '../utils/toastHelper';
import i18n from '../plugins/i18n';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadAsJson(data: unknown, filename: string): void {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    downloadBlob(new Blob([jsonString], { type: 'application/json' }), filename);
  } catch (error) {
    logger.error('Failed to download file:', error);
    dispatchToast(i18n.t('common.unexpectedError') as string, 'danger');
  }
}

export function downloadAsText(text: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void {
  try {
    downloadBlob(new Blob([text], { type: mimeType }), filename);
  } catch (error) {
    logger.error('Failed to download file:', error);
    dispatchToast(i18n.t('common.unexpectedError') as string, 'danger');
  }
}
