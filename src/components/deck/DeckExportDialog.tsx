import { logger } from '../../utils/logger';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCopy, FaLink, FaFileCode, FaImage, FaFileDownload } from 'react-icons/fa';
import { Deck } from '../../types/Deck';
import { ShowToastFn } from '../../types/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { buildDeckFileContent, buildShareUrl } from '../../services/deckShare';
import { deckToArenaText } from '../../utils/deckText';
import { downloadAsText, downloadBlob } from '../../services/fileDownload';
import { renderDeckImage } from '../../utils/deckImage';

interface DeckExportDialogProps {
  deck: Deck;
  onExportJson: (deck: Deck) => void;
  onExportDec: (deck: Deck) => void;
  onCancel: () => void;
  showToast: ShowToastFn;
}

interface ExportOptionProps {
  icon: ReactNode;
  accent: string;
  title: string;
  description: string;
  onClick: () => void;
}

/** One consistent export/share choice: accent icon chip + title + description. */
function ExportOption({ icon, accent, title, description, onClick }: ExportOptionProps) {
  return (
    <button type="button" onClick={onClick} className="export-option">
      <span className={`export-option-icon ${accent}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-gray-900 dark:text-white">{title}</span>
        {description ? <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span> : null}
      </span>
    </button>
  );
}

/** Prompt offering every way to export/share a deck: link, text, files. */
export function DeckExportDialog({ deck, onExportJson, onExportDec, onCancel, showToast }: DeckExportDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  useEscapeKey(onCancel);
  const { onTouchStart, onTouchMove, onTouchEnd, panelStyle } = useSwipeToClose<HTMLDivElement>(onCancel);

  const shareUrl = useMemo(() => buildShareUrl(deck), [deck]);

  const copyToClipboard = async (text: string, successKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t(successKey), 'success');
    } catch (error) {
      logger.error('Failed to copy to clipboard:', error);
      showToast(t('common.unexpectedError'), 'error');
    }
  };

  const handleCopyLink = () => copyToClipboard(shareUrl, 'export.linkCopied');
  const handleCopyText = () => copyToClipboard(deckToArenaText(deck.cards), 'strategy.exportArenaCopied');
  const handleDownloadDeckFile = () =>
    downloadAsText(buildDeckFileContent(deck), `${deck.name.replace(/\s+/g, '_')}.deck`);

  const handleExportImage = async () => {
    try {
      const blob = await renderDeckImage(deck);
      downloadBlob(blob, `${deck.name.replace(/\s+/g, '_')}.png`);
    } catch (error) {
      logger.error('Failed to export deck image:', error);
      showToast(t('common.unexpectedError'), 'error');
    }
  };

  return (
    // Backdrop click is a mouse-only convenience; Escape and the cancel button provide the keyboard-equivalent action.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-overlay modal-overlay-sheet z-[var(--z-overlay)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-export-dialog-title"
        className="modal-container modal-sheet-panel sm:max-w-md overflow-y-auto animate-fadeIn"
        style={panelStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Grab handle: purely a visual affordance now — drag-to-close works
            from anywhere on the sheet (see useSwipeToClose), not just here. */}
        <div className="sm:hidden -mt-6 -mx-6 mb-4 flex justify-center pt-2.5 pb-1" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
        <h3 id="deck-export-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white mb-1">
          {t('deck.export')} {deck.name}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{t('export.exportFormatPrompt')}</p>

        {/* Share section: link to move the deck to another device, no backend. */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40 p-3 mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            {t('export.shareTitle')}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label={t('export.shareLink')}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 font-mono"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="primary-button text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
              title={t('export.copyLink')}
            >
              <FaLink className="text-xs" />
              <span className="font-bold">{t('common.copy')}</span>
            </button>
          </div>
        </div>

        {/* Export / download options — one consistent visual language. */}
        <div className="grid grid-cols-1 gap-2">
          <ExportOption
            icon={<FaCopy />}
            accent="bg-slate-500/10 text-slate-600 dark:text-slate-300"
            title={t('export.copyText')}
            description=""
            onClick={handleCopyText}
          />
          <ExportOption
            icon={<FaFileDownload />}
            accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
            title={t('export.downloadDeckFile')}
            description=".deck"
            onClick={handleDownloadDeckFile}
          />
          <ExportOption
            icon={<FaFileCode />}
            accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            title="JSON"
            description={t('export.exportJsonDesc')}
            onClick={() => onExportJson(deck)}
          />
          <ExportOption
            icon={<FaFileCode />}
            accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            title="DEC (MTGO)"
            description={t('export.exportDecDesc')}
            onClick={() => onExportDec(deck)}
          />
          <ExportOption
            icon={<FaImage />}
            accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            title={t('export.exportImage')}
            description={t('export.exportImageDesc')}
            onClick={handleExportImage}
          />
        </div>

        <button type="button" className="w-full mt-4 secondary-button py-2.5" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
