import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

function ErrorState({ title, message, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useTranslation();

  const displayTitle = title || t('common.somethingWentWrong');
  const displayRetryLabel = retryLabel || t('common.tryAgain');

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 gap-4 animate-in fade-in duration-300">
      <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-6 py-4 rounded-2xl border border-rose-200 dark:border-rose-800/50 shadow-sm text-center">
        <h3 className="font-bold text-lg mb-2">{displayTitle}</h3>
        <p className="font-medium text-sm opacity-90">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-xl font-bold hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors active:scale-95"
        >
          {displayRetryLabel}
        </button>
      )}
    </div>
  );
}

export default ErrorState;
