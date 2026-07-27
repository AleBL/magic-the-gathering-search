import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { ValidationResult, ValidationError } from '../../utils/deckValidator';
import { formatLabelKey } from '../../utils/formatLabel';

interface DeckValidationBadgeProps {
  validation: ValidationResult;
  formatKey: string;
  variant?: 'compact' | 'full';
}

function DeckValidationBadge({ validation, formatKey, variant = 'full' }: DeckValidationBadgeProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <span
        className={`status-badge flex items-center gap-1.5 text-[10px] ${validation.isValid ? 'status-badge-success' : 'status-badge-danger'}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${validation.isValid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}
        />
        {validation.isValid ? t('validation.valid') : t('validation.invalid')}
      </span>
    );
  }

  const hasErrors = validation.errors.length > 0;

  return (
    <div
      className={`alert-banner ${validation.isValid ? 'alert-banner-success' : 'alert-banner-danger'} overflow-hidden transition-all duration-300`}
    >
      <button
        type="button"
        onClick={() => hasErrors && setIsExpanded(!isExpanded)}
        className={`validation-badge-header select-none flex justify-between items-center w-full text-left ${hasErrors ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded transition-colors' : 'p-1'}`}
        aria-expanded={isExpanded}
        disabled={!hasErrors}
      >
        <span className="font-bold flex items-center gap-2">
          {t('validation.deckValidation')} ({t(formatLabelKey(formatKey))})
          {hasErrors ? (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
              ({isExpanded ? t('validation.hideDetails') : t('validation.viewDetails')})
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`status-badge flex items-center gap-1.5 ${
              validation.isValid ? 'status-badge-success' : 'status-badge-danger'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${validation.isValid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}
            />
            {validation.isValid ? t('validation.valid') : t('validation.invalid')}
          </span>
          {hasErrors ? (
            <span className="text-gray-500 dark:text-gray-400">
              {isExpanded ? <FaChevronUp className="w-3.5 h-3.5" /> : <FaChevronDown className="w-3.5 h-3.5" />}
            </span>
          ) : null}
        </div>
      </button>

      {hasErrors ? (
        <div
          className={`transition-all duration-300 ${isExpanded ? 'max-h-[500px] mt-3 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}
        >
          <ul className="space-y-1 text-xs border-t border-red-200 dark:border-red-950 pt-2.5 list-disc pl-4">
            {validation.errors.map((err: ValidationError, i: number) => (
              <li key={i} className="text-red-700 dark:text-red-400 font-medium">
                {t(`validation.${err.key}`, err.params) as string}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-green-700 dark:text-green-400 mt-2 font-medium">
          {t('validation.validationFormatSuccess')}
        </p>
      )}
    </div>
  );
}

export default DeckValidationBadge;
