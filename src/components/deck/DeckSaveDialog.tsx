import { useTranslation } from 'react-i18next';
import { FaCheck, FaTimes, FaInfoCircle } from 'react-icons/fa';
import { DeckFormat } from '../../types/Deck';
import { DeckFormatType } from '../../types/enums';

interface DeckSaveDialogProps {
  deckName: string;
  deckFormat: DeckFormat;
  onDeckNameChange: (name: string) => void;
  onDeckFormatChange: (format: DeckFormat) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Heading override — defaults to "Save Deck"; reused for editing deck info. */
  title?: string;
}

const DECK_FORMATS: { value: DeckFormat; labelKey: string }[] = [
  { value: DeckFormatType.FREEFORM, labelKey: 'freeform' },
  { value: DeckFormatType.STANDARD, labelKey: 'standard' },
  { value: DeckFormatType.MODERN, labelKey: 'modern' },
  { value: DeckFormatType.COMMANDER, labelKey: 'commander' },
  { value: DeckFormatType.VINTAGE, labelKey: 'vintage' },
  { value: DeckFormatType.PAUPER, labelKey: 'pauper' }
];

function DeckSaveDialog({
  deckName,
  deckFormat,
  onDeckNameChange,
  onDeckFormatChange,
  onSave,
  onCancel,
  title
}: DeckSaveDialogProps) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-container modal-container-medium w-full flex flex-col !p-0 overflow-hidden animate-fadeIn mx-auto">
        <div className="p-6 md:p-8 flex-1 overflow-y-auto flex flex-col">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{title ?? t('deck.saveDeck')}</h3>

          <div className="space-y-4 mb-6">
            <div>
              <label
                htmlFor="deck-name-input"
                className="form-label block mb-1 font-semibold text-gray-700 dark:text-gray-300"
              >
                {t('deck.deckNamePlaceholder')}
              </label>
              <input
                id="deck-name-input"
                type="text"
                value={deckName}
                onChange={(e) => onDeckNameChange(e.target.value)}
                placeholder={t('deck.deckNamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <span className="form-label block mb-1 font-semibold text-gray-700 dark:text-gray-300">
                {t('validation.format')}
              </span>
              <select
                value={deckFormat}
                onChange={(e) => onDeckFormatChange((e.target.value as DeckFormat) || DeckFormatType.FREEFORM)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {DECK_FORMATS.map((fmt) => (
                  <option key={fmt.value} value={fmt.value}>
                    {t(`validation.${fmt.labelKey}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-sm">
              <FaInfoCircle className="shrink-0 mt-0.5" />
              <span>{t('validation.deckRulesExplanation')}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4 mt-auto border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <FaTimes />
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <FaCheck />
              {t('deck.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeckSaveDialog;
