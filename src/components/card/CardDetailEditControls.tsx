import { useTranslation } from 'react-i18next';
import { FaPalette, FaMinus, FaPlus, FaSync } from 'react-icons/fa';
import { Card } from '../../types/Card';

interface CardDetailEditControlsProps {
  isDeckCard: boolean;
  isEditMode: boolean;
  isToken: boolean;
  hidePrintsSidebar: boolean;
  copiesCount: number;
  hasArtChanged: boolean;
  prints: Card[];
  showPrintsSidebar: boolean;
  setShowPrintsSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  handleDecrementCopies: () => void;
  handleIncrementCopies: () => void;
  handleConfirmArtChange: () => void;
}

export function CardDetailEditControls({
  isDeckCard,
  isEditMode,
  isToken,
  hidePrintsSidebar,
  copiesCount,
  hasArtChanged,
  prints,
  showPrintsSidebar,
  setShowPrintsSidebar,
  handleDecrementCopies,
  handleIncrementCopies,
  handleConfirmArtChange
}: CardDetailEditControlsProps) {
  const { t } = useTranslation();

  if (!isDeckCard || !isEditMode) return null;

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-auto space-y-4">
      <h3 className="font-bold text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2 select-none">
        <FaPalette className="text-indigo-400/70" />
        <span>{t('cardDetails.copiesAndArt')}</span>
      </h3>

      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-3 flex flex-row items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('cardDetails.inDeck')}</span>
            <span className="text-base font-bold text-gray-800 dark:text-gray-200">
              {copiesCount} {copiesCount === 1 ? t('cardDetails.copyCountSingular') : t('cardDetails.copyCountPlural')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {copiesCount === 1 ? (
            <button
              type="button"
              onClick={handleDecrementCopies}
              className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-danger dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
            >
              {t('cardDetails.remove')}
            </button>
          ) : (
            <div className="flex items-center bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={handleDecrementCopies}
                className="w-9 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                title={t('cardDetails.removeCopy')}
              >
                <FaMinus className="text-[10px]" />
              </button>
              <div className="w-8 h-8 flex items-center justify-center font-bold text-sm text-gray-800 dark:text-gray-200 border-x border-gray-200 dark:border-slate-700">
                {copiesCount}
              </div>
              <button
                type="button"
                onClick={handleIncrementCopies}
                className="w-9 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                title={t('cardDetails.addCopy')}
              >
                <FaPlus className="text-[10px]" />
              </button>
            </div>
          )}

          {copiesCount === 1 && (
            <button
              type="button"
              onClick={handleIncrementCopies}
              className="w-9 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors ml-1"
              title={t('cardDetails.addCopy')}
            >
              <FaPlus className="text-[10px]" />
            </button>
          )}
        </div>
      </div>

      {!isToken && !hidePrintsSidebar && (
        <div className="flex flex-wrap gap-2.5">
          {prints.length > 1 && (
            <button
              type="button"
              onClick={() => setShowPrintsSidebar((prev) => !prev)}
              className={`secondary-button text-xs py-2 px-3.5 flex-1 flex items-center justify-center gap-1.5 shadow-sm border border-gray-200 dark:border-gray-700 transition-all ${
                showPrintsSidebar ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' : ''
              }`}
            >
              <FaPalette className="text-xs shrink-0" />
              {t('cardDetails.showEditions')}
            </button>
          )}

          {hasArtChanged && (
            <button
              type="button"
              onClick={handleConfirmArtChange}
              className="success-button text-xs py-2 px-3.5 flex-1 flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <FaSync className="text-xs shrink-0 animate-spin-slow" />
              {t('cardDetails.updateArt')}
            </button>
          )}
        </div>
      )}

      {isToken && prints.length > 1 && !hidePrintsSidebar && (
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setShowPrintsSidebar((prev) => !prev)}
            className={`secondary-button text-xs py-2 px-3.5 flex-1 flex items-center justify-center gap-1.5 shadow-sm border border-gray-200 dark:border-gray-700 transition-all ${
              showPrintsSidebar ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' : ''
            }`}
          >
            <FaPalette className="text-xs shrink-0" />
            {t('cardDetails.changeArt')}
          </button>

          {hasArtChanged && (
            <button
              type="button"
              onClick={handleConfirmArtChange}
              className="success-button text-xs py-2 px-3.5 flex-1 flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <FaSync className="text-xs shrink-0 animate-spin-slow" />
              {t('cardDetails.updateArt')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
