import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileImport, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface DeckTextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string) => void;
  isImporting: boolean;
  errorMsg: string | null;
}

function DeckTextImportModal({ isOpen, onClose, onImport, isImporting, errorMsg }: DeckTextImportModalProps) {
  const { t } = useTranslation();
  const [textDeckList, setTextDeckList] = useState('');
  // Mounted even while closed (it renders null), so both are gated on isOpen.
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (!isOpen) {
      setTextDeckList('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fadeIn">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-text-import-title"
        className="modal-container modal-container-medium w-full flex flex-col max-h-[90vh] overflow-hidden !p-0"
      >
        {/* Modal Header */}
        <div className="modal-header-container">
          <h3
            id="deck-text-import-title"
            className="text-gray-900 dark:text-white text-lg font-bold flex items-center gap-2"
          >
            <FaFileImport className="text-blue-500" />
            {t('deck.importTextListTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('deck.pasteTextList')}</p>

          <textarea
            rows={10}
            value={textDeckList}
            onChange={(e) => setTextDeckList(e.target.value)}
            disabled={isImporting}
            placeholder="4 Lightning Bolt&#10;2 Llanowar Elves&#10;1 Black Lotus"
            className="w-full text-sm font-mono p-3 bg-gray-50 dark:bg-slate-950 text-gray-850 dark:text-slate-100 border border-gray-300 dark:border-slate-850 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none disabled:opacity-60"
          />

          {errorMsg && (
            <div className="text-xs text-danger bg-red-50 dark:bg-red-950/20 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-900/50 flex items-center gap-1.5">
              <FaExclamationTriangle className="text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer-container">
          <button type="button" onClick={onClose} disabled={isImporting} className="secondary-button text-xs py-2 px-4">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onImport(textDeckList)}
            disabled={isImporting || !textDeckList.trim()}
            className="primary-button text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('deck.importing')}
              </>
            ) : (
              <>
                <FaFileImport />
                {t('deck.importAction')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeckTextImportModal;
