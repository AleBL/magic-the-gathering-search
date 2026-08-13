import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaDice, FaRedo } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { simulatePlayout } from '../../utils/playoutSimulation';
import EmptyState from '../ui/EmptyState';

interface PlayoutPanelProps {
  currentDeck: Card[];
}

const RUNS = 1000;
const TURNS = 8;

/** Percentage bar sized by `share`, for the kept-hand and milestone rows. */
function ShareBar({ share, tone = 'primary' }: { share: number; tone?: 'primary' | 'warning' }) {
  return (
    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full ${tone === 'warning' ? 'bg-amber-500' : 'bg-primary'}`}
        style={{ width: `${Math.round(share * 100)}%` }}
      />
    </div>
  );
}

/**
 * Monte Carlo mana report. It sits beside the hypergeometric panels rather than replacing
 * them: those give exact odds for a fixed opening hand, this one covers what only a played-out
 * game shows — mulligan decisions and casting on curve.
 */
export function PlayoutPanel({ currentDeck }: PlayoutPanelProps) {
  const { t } = useTranslation();
  // A seed makes each run reproducible; bumping it is what "simulate again" does.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  const result = useMemo(() => simulatePlayout(currentDeck, { runs: RUNS, turns: TURNS, seed }), [currentDeck, seed]);

  const reroll = useCallback(() => setSeed(Math.floor(Math.random() * 2 ** 31)), []);
  const percent = (value: number) => `${Math.round(value * 100)}%`;

  if (!result) {
    return (
      <div className="space-y-4 min-w-0">
        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <FaDice className="text-primary" />
          {t('stats.playout')}
        </h4>
        <EmptyState title={t('stats.playoutTooSmall')} compact />
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <FaDice className="text-primary" />
          {t('stats.playout')}
        </h4>
        <button
          type="button"
          onClick={reroll}
          className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
        >
          <FaRedo className="text-[9px]" />
          {t('stats.playoutRerun')}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('stats.playoutExplanation', { runs: result.runs, turns: TURNS })}
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-tile" title={t('stats.playoutMulliganHelp')}>
          <span className="stat-tile-label">{t('stats.playoutMulligan')}</span>
          <span className="text-base font-extrabold text-gray-700 dark:text-gray-200 tabular-nums">
            {percent(result.mulliganRate)}
          </span>
        </div>
        <div className="stat-tile" title={t('stats.playoutStalledHelp')}>
          <span className="stat-tile-label">{t('stats.playoutStalled')}</span>
          <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {percent(result.stalledRate)}
          </span>
        </div>
        <div className="stat-tile" title={t('stats.playoutOnCurveHelp')}>
          <span className="stat-tile-label">{t('stats.playoutOnCurve')}</span>
          <span className="text-base font-extrabold text-primary dark:text-blue-400 tabular-nums">
            {percent(result.onCurveShare)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <span className="stat-tile-label" title={t('stats.playoutKeptHandsHelp')}>
          {t('stats.playoutKeptHands')}
        </span>
        {result.keptHandSizes.map(({ size, share }) => (
          <div key={size} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">{t('stats.playoutHandOf', { size })}</span>
              <span className="font-bold tabular-nums text-gray-700 dark:text-gray-200">{percent(share)}</span>
            </div>
            <ShareBar share={share} />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <span className="stat-tile-label" title={t('stats.playoutLandMilestonesHelp')}>
          {t('stats.playoutLandMilestones')}
        </span>
        {result.landMilestones.map(({ lands, medianTurn, reachedShare }) => (
          <div key={lands} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">{t('stats.playoutLandsCount', { lands })}</span>
              <span className="font-bold tabular-nums text-gray-700 dark:text-gray-200">
                {medianTurn === null
                  ? t('stats.playoutNeverReached')
                  : t('stats.playoutByTurn', { turn: medianTurn, share: Math.round(reachedShare * 100) })}
              </span>
            </div>
            <ShareBar share={reachedShare} tone={reachedShare < 0.8 ? 'warning' : 'primary'} />
          </div>
        ))}
      </div>

      {/* The simulation does not read card text; saying so beats letting the numbers imply
          more precision than they carry. */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">{t('stats.playoutCaveat')}</p>
    </div>
  );
}
