import { useTranslation } from 'react-i18next';
import { FaCrown, FaBan, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

interface CardItemStatusBadgesProps {
  readonly isCommander: boolean;
  readonly isBanned: boolean;
  readonly isRestricted: boolean;
  readonly isInvalid: boolean;
  readonly isInactiveToken: boolean;
}

/** The top-corner overlay badges: commander crown, banned/restricted/invalid, inactive token. */
export function CardItemStatusBadges({
  isCommander,
  isBanned,
  isRestricted,
  isInvalid,
  isInactiveToken
}: CardItemStatusBadgesProps) {
  const { t } = useTranslation();

  return (
    <>
      {isCommander && (
        <div className="absolute top-2 left-2 z-10 bg-amber-500/90 dark:bg-warning/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg border border-amber-400 flex items-center gap-1 animate-pulse select-none">
          <FaCrown className="text-amber-200 text-xs shrink-0 animate-pulse" />
          {t('cardDetails.commanderBadge')}
        </div>
      )}

      {isBanned && (
        <div className="absolute top-2 right-2 z-10 bg-rose-600/90 dark:bg-rose-700/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-lg border border-rose-500 flex items-center gap-1 select-none">
          <FaBan className="text-white text-[9px] shrink-0 animate-spin-slow" />
          {t('cardDetails.banned')}
        </div>
      )}

      {isRestricted && (
        <div className="absolute top-2 right-2 z-10 bg-amber-500/90 dark:bg-warning/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-lg border border-amber-400 flex items-center gap-1 select-none">
          <FaExclamationTriangle className="text-white text-[9px] shrink-0" />
          {t('cardDetails.restricted')}
        </div>
      )}

      {isInvalid && (
        <div
          title={t('cardDetails.invalidInFormatHint')}
          className="absolute top-2 right-2 z-10 bg-violet-600/90 dark:bg-violet-700/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-lg border border-violet-500 flex items-center gap-1 select-none"
        >
          <FaTimesCircle className="text-white text-[9px] shrink-0" />
          {t('cardDetails.invalidInFormat')}
        </div>
      )}

      {isInactiveToken && (
        <div className="absolute top-2 left-2 z-10 bg-slate-800/95 dark:bg-slate-900/95 backdrop-blur-sm text-slate-350 dark:text-slate-400 px-2 py-0.5 rounded-md text-[9px] font-extrabold shadow-md border border-slate-700/60 flex items-center gap-1 select-none">
          <span className="w-1 h-1 rounded-full bg-slate-400" />
          {t('common.inactive').toUpperCase()}
        </div>
      )}
    </>
  );
}

export default CardItemStatusBadges;
