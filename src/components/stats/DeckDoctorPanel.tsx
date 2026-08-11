import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  FaStethoscope,
  FaExclamationTriangle,
  FaExclamationCircle,
  FaInfoCircle,
  FaCheckCircle,
  FaDiceD20,
  FaFish
} from 'react-icons/fa';
import { Card } from '../../types/Card';
import { analyzeDeck, ConsistencyScore, DeckRecommendation, ScoreComponent } from '../../utils/deckDoctor';
import { DeckStatistics, landDrawProbabilities } from '../../utils/deckStatistics';
import { parseTextWithSymbols } from '../../utils/symbolHelper';
import { useColorLabels } from './colorLabels';
import { CHART_BAR_RADIUS_VERTICAL, CHART_STATUS, CHART_TEXT_MUTED, CHART_TICK_STYLE } from './chartTheme';
import { ChartFrame, ChartSkeleton, ChartTooltip, useChartReady } from './ChartPrimitives';
import EmptyState from '../ui/EmptyState';

interface DeckDoctorPanelProps {
  currentDeck: Card[];
  /** Precomputed deck statistics — powers the opening-hand consistency chart. */
  stats: DeckStatistics;
}

const HAND_SIZE = 7;
// A hand with 2–5 lands is generally keepable.
const KEEPABLE_MIN = 2;
const KEEPABLE_MAX = 5;
const KEEPABLE_COLOR = CHART_STATUS.good;
const OTHER_COLOR = CHART_TEXT_MUTED;

/**
 * Opening-hand land distribution (hypergeometric), folded into the Deck Doctor
 * so consistency lives in one place instead of a separate panel.
 */
function OpeningHandChart({ stats }: { stats: DeckStatistics }) {
  const { t } = useTranslation();
  const deckSize = stats.totalCards;
  const landCount = stats.totalLands;
  const distribution = useMemo(() => landDrawProbabilities(deckSize, landCount, HAND_SIZE), [deckSize, landCount]);

  if (distribution.length === 0 || landCount === 0) return null;

  return (
    <div>
      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1.5 flex items-center gap-1.5">
        <FaDiceD20 className="text-indigo-500" />
        {t('stats.consistency')}
      </span>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">{t('stats.consistencyDesc')}</p>
      <ChartFrame height="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="20%">
            <XAxis
              dataKey="lands"
              tick={CHART_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(lands: number) => t('stats.nLands', { count: lands })}
            />
            <YAxis hide />
            <RechartsTooltip
              cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as { lands: number; prob: number } | undefined;
                if (!d) return null;
                const isKeepable = d.lands >= KEEPABLE_MIN && d.lands <= KEEPABLE_MAX;
                return (
                  <ChartTooltip
                    active={active}
                    title={t('stats.nLands', { count: d.lands })}
                    rows={[
                      {
                        key: 'prob',
                        label: t('stats.percentage'),
                        value: `${(d.prob * 100).toFixed(0)}%`,
                        swatch: isKeepable ? KEEPABLE_COLOR : OTHER_COLOR
                      }
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="prob" radius={CHART_BAR_RADIUS_VERTICAL} maxBarSize={28}>
              {distribution.map((d) => {
                const isKeepable = d.lands >= KEEPABLE_MIN && d.lands <= KEEPABLE_MAX;
                return <Cell key={d.lands} fill={isKeepable ? KEEPABLE_COLOR : OTHER_COLOR} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
        {t('stats.consistencyBasis', { lands: landCount, total: deckSize })}
      </p>
    </div>
  );
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

/** Score band → gauge/status color (green → indigo → amber → red). */
function scoreColor(total: number): string {
  if (total >= 80) return CHART_STATUS.good;
  if (total >= 60) return 'var(--chart-series-1)';
  if (total >= 40) return CHART_STATUS.warning;
  return CHART_STATUS.critical;
}

const SEVERITY_STYLE: Record<DeckRecommendation['severity'], { wrap: string; icon: ReactNode }> = {
  critical: {
    wrap: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300',
    icon: <FaExclamationCircle className="text-red-500 shrink-0 mt-0.5" />
  },
  warning: {
    wrap: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300',
    icon: <FaExclamationTriangle className="text-amber-500 shrink-0 mt-0.5" />
  },
  info: {
    wrap: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300',
    icon: <FaInfoCircle className="text-blue-500 shrink-0 mt-0.5" />
  },
  good: {
    wrap: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300',
    icon: <FaCheckCircle className="text-green-500 shrink-0 mt-0.5" />
  }
};

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className={`text-base font-extrabold tabular-nums ${tone ?? 'text-gray-700 dark:text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}

/** One explainable row of the consistency-score breakdown. */
function ScoreBreakdownRow({ component }: { component: ScoreComponent }) {
  const { t } = useTranslation();
  const pct = component.max > 0 ? component.score / component.max : 0;
  const label = t(`deckDoctor.component.${component.key}`);
  const note =
    component.key === 'manaRatio'
      ? t('deckDoctor.note.manaRatio')
      : t(`deckDoctor.note.${component.key}`, { percent: percent(component.value) });

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label}</span>
        <span className="tabular-nums text-gray-500 dark:text-gray-400">
          {Math.round(component.score)}/{component.max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{note}</p>
    </div>
  );
}

function ScoreGauge({ score }: { score: ConsistencyScore }) {
  const { t } = useTranslation();
  const color = scoreColor(score.total);
  const data = [{ value: score.total, fill: color }];

  return (
    <div className="relative w-full h-40">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270} barSize={12}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: 'var(--chart-grid)' }} dataKey="value" cornerRadius={8} angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-4xl font-extrabold tabular-nums text-gray-800 dark:text-gray-100">{score.total}</span>
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color }}>
          {t(`deckDoctor.rating.${score.rating}`)}
        </span>
      </div>
    </div>
  );
}

/** Composes a recommendation descriptor into a localized natural-language sentence. */
function useRecommendationText() {
  const { t } = useTranslation();
  const colorLabels = useColorLabels();

  return (rec: DeckRecommendation): string => {
    switch (rec.kind) {
      case 'add-lands':
        return t('deckDoctor.rec.addLands', { count: rec.count });
      case 'cut-lands':
        return t('deckDoctor.rec.cutLands', { count: rec.count });
      case 'add-source':
        return t('deckDoctor.rec.addSource', {
          low: rec.count,
          high: rec.countHigh,
          color: colorLabels[rec.color ?? 'C']?.name ?? ''
        });
      case 'curve-heavy':
        return t('deckDoctor.rec.curveHeavy', { cmc: rec.cmc });
      case 'screw-risk':
        return t('deckDoctor.rec.screwRisk', { percent: rec.percent });
      case 'flood-risk':
        return t('deckDoctor.rec.floodRisk', { percent: rec.percent });
      case 'balanced':
        return t('deckDoctor.rec.balanced');
      default:
        return '';
    }
  };
}

/**
 * Deck Doctor — synthesizes the mana-base math, a openingHands simulation and a
 * transparent consistency score into actionable, localized advice. It builds on
 * the existing statistics panels (ConsistencyPanel, ManaBaseOptimizerPanel)
 * rather than repeating their charts.
 */
export function DeckDoctorPanel({ currentDeck, stats }: DeckDoctorPanelProps) {
  const { t } = useTranslation();
  const colorLabels = useColorLabels();
  const recommendationText = useRecommendationText();

  const report = useMemo(() => analyzeDeck(currentDeck), [currentDeck]);
  const ready = useChartReady([report]);

  const { score, openingHands, landOdds, colorSources, recommendations, hasData } = report;

  return (
    <div className="md:col-span-3 space-y-4 p-4 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-500/5 dark:bg-teal-950/10 transition-colors duration-300">
      <h4 className="font-bold text-sm text-teal-700 dark:text-teal-400 uppercase tracking-wider flex items-center gap-2">
        <FaStethoscope className="text-teal-500" />
        {t('deckDoctor.title')}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('deckDoctor.desc')}</p>

      {!ready ? (
        <ChartSkeleton height="h-40" />
      ) : !hasData ? (
        <ChartFrame height="h-32" className="flex items-center justify-center">
          <EmptyState icon={<FaStethoscope />} title={t('deckDoctor.noData')} />
        </ChartFrame>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Consistency score + explainable breakdown */}
          <div className="space-y-3">
            <span className="stat-tile-label">{t('deckDoctor.consistencyScore')}</span>
            <ScoreGauge score={score} />
            <div className="space-y-3">
              {score.components.map((component) => (
                <ScoreBreakdownRow key={component.key} component={component} />
              ))}
            </div>
          </div>

          {/* Goldfish + land odds + color sources */}
          <div className="space-y-4">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold mb-1.5 flex items-center gap-1.5">
                <FaFish className="text-teal-500" />
                {t('deckDoctor.openingHands')}
              </span>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
                {t('deckDoctor.handsSimulated', { count: openingHands.iterations })}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile
                  label={t('deckDoctor.playableHands')}
                  value={percent(openingHands.playableRate)}
                  tone="text-teal-600 dark:text-teal-400"
                />
                <StatTile label={t('deckDoctor.avgCurve')} value={openingHands.avgCurve.toFixed(1)} />
                <StatTile
                  label={t('deckDoctor.noLander')}
                  value={percent(openingHands.noLandRate)}
                  tone={openingHands.noLandRate > 0.1 ? 'text-red-500 dark:text-red-400' : undefined}
                />
                <StatTile
                  label={t('deckDoctor.floodRisk')}
                  value={percent(openingHands.floodRate)}
                  tone={openingHands.floodRate > 0.15 ? 'text-amber-500 dark:text-amber-400' : undefined}
                />
              </div>
            </div>

            {/* Land odds by turn — hypergeometric, on the play */}
            <div>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold mb-1.5">
                {t('deckDoctor.landOdds')}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile label={t('deckDoctor.keepable')} value={percent(landOdds.keepableProb)} />
                <StatTile
                  label={t('stats.avgLandsInHand')}
                  value={((HAND_SIZE * stats.totalLands) / Math.max(1, stats.totalCards)).toFixed(1)}
                />
                {landOdds.byTurn.map((milestone) => (
                  <StatTile
                    key={milestone.turn}
                    label={t('deckDoctor.byTurnLabel', { lands: milestone.lands, turn: milestone.turn })}
                    value={percent(milestone.prob)}
                  />
                ))}
              </div>
            </div>

            {/* Opening-hand land distribution (formerly the Consistency panel) */}
            <OpeningHandChart stats={stats} />

            {/* Color source sufficiency */}
            {colorSources.length > 0 ? (
              <div>
                <span className="text-[9px] uppercase tracking-wider text-gray-400 block font-bold mb-1.5">
                  {t('deckDoctor.colorSources')}
                </span>
                <div className="space-y-1.5">
                  {colorSources.map((diag) => {
                    const short = diag.deficit > 0;
                    return (
                      <div
                        key={diag.color}
                        className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-gray-200 dark:border-gray-700"
                      >
                        <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
                          <span className="flex items-center">{parseTextWithSymbols(`{${diag.color}}`)}</span>
                          {colorLabels[diag.color]?.name}
                        </span>
                        <span className="flex items-center gap-3 tabular-nums">
                          <span className="text-gray-500 dark:text-gray-400">
                            {t('deckDoctor.sourcesOfIdeal', { sources: diag.sources, ideal: diag.idealSources })}
                          </span>
                          <span
                            className={
                              short
                                ? 'text-amber-600 dark:text-amber-400 font-bold'
                                : 'text-green-600 dark:text-green-400 font-bold'
                            }
                          >
                            {percent(diag.openingHandProb)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* Natural-language recommendations */}
          <div className="lg:col-span-2 space-y-2">
            <span className="stat-tile-label">{t('deckDoctor.recommendations')}</span>
            {recommendations.map((rec) => {
              const style = SEVERITY_STYLE[rec.severity];
              return (
                <div
                  key={rec.id}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-[11px] font-medium leading-relaxed animate-fadeIn ${style.wrap}`}
                >
                  {style.icon}
                  <p>{recommendationText(rec)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
