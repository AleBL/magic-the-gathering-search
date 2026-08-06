import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { FaCoins, FaStar } from 'react-icons/fa';
import { DeckStatistics } from '../../utils/deckStatistics';
import { planBudgetCuts } from '../../utils/budgetPlanner';
import { STORAGE_KEYS } from '../../constants/storage';
import { CHART_BAR_RADIUS_HORIZONTAL, CHART_SEQUENTIAL, CHART_TICK_STYLE } from './chartTheme';
import { ChartFrame, ChartSkeleton, ChartTooltip, useChartReady } from './ChartPrimitives';

interface BudgetEstimatorPanelProps {
  stats: DeckStatistics;
}

const BAR_COLOR = CHART_SEQUENTIAL[2];
const BUDGET_TARGET_KEY = STORAGE_KEYS.budgetTarget;

export function BudgetEstimatorPanel({ stats }: BudgetEstimatorPanelProps) {
  const { t } = useTranslation();

  const chartData = useMemo(
    () =>
      stats.mostExpensiveCards.map((card) => ({
        id: card.id,
        name: card.printed_name || card.name,
        price: parseFloat(card.prices?.usd || '0')
      })),
    [stats.mostExpensiveCards]
  );
  const ready = useChartReady([chartData]);
  const rowHeight = Math.max(chartData.length, 1) * 32 + 16;

  const [budgetTarget, setBudgetTarget] = useState<string>(() => localStorage.getItem(BUDGET_TARGET_KEY) || '');
  const targetNum = parseFloat(budgetTarget) || 0;
  const plan = useMemo(
    () => planBudgetCuts(chartData, stats.totalUsdPrice, targetNum),
    [chartData, stats.totalUsdPrice, targetNum]
  );

  const handleTargetChange = (value: string) => {
    setBudgetTarget(value);
    if (value) localStorage.setItem(BUDGET_TARGET_KEY, value);
    else localStorage.removeItem(BUDGET_TARGET_KEY);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-500/5 dark:bg-purple-950/10 transition-colors duration-300">
      <h4 className="font-bold text-sm text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
        <FaCoins className="text-purple-500" />
        {t('stats.budgetEstimator')}
      </h4>

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-tile">
          <span className="stat-tile-label">{t('stats.totalUsd')}</span>
          <span className="text-base font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
            ${stats.totalUsdPrice.toFixed(2)}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-label">{t('stats.totalEur')}</span>
          <span className="text-base font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
            €{stats.totalEurPrice.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="budget-target"
          className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block"
        >
          {t('stats.budgetTarget')}
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-gray-500">$</span>
          <input
            id="budget-target"
            type="number"
            min="0"
            inputMode="decimal"
            value={budgetTarget}
            onChange={(e) => handleTargetChange(e.target.value)}
            placeholder={t('stats.budgetTargetPlaceholder')}
            className="w-24 min-h-11 sm:min-h-0 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        {targetNum > 0 &&
          (plan.overBy > 0 ? (
            <div className="space-y-1.5 p-2.5 rounded-lg bg-red-500/5 border border-red-200 dark:border-red-900/50">
              <span className="text-xs font-bold text-red-600 dark:text-red-400 block">
                {t('stats.overBudgetBy', { amount: plan.overBy.toFixed(2) })}
              </span>
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                {t('stats.cutSuggestions')}
              </span>
              <ul className="space-y-1">
                {plan.cuts.map((card) => (
                  <li key={card.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-700 dark:text-gray-300">{card.name}</span>
                    <span className="tabular-nums font-semibold text-red-500 shrink-0">−${card.price.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <span className="text-xs font-bold text-green-600 dark:text-green-400">{t('stats.withinBudget')}</span>
          ))}
      </div>

      {!ready ? (
        <ChartSkeleton height="h-32" />
      ) : chartData.length > 0 ? (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <FaStar className="text-amber-500" />
            {t('stats.topExpensiveCards')}
          </span>
          <ChartFrame style={{ height: rowHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                barCategoryGap="24%"
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={CHART_TICK_STYLE}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  tickFormatter={(name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name)}
                />
                <RechartsTooltip
                  cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }}
                  content={({ active, payload }) => {
                    const d = payload?.[0]?.payload as { name: string; price: number } | undefined;
                    if (!d) return null;
                    return (
                      <ChartTooltip
                        active={active}
                        title={d.name}
                        rows={[
                          { key: 'price', label: t('stats.prices'), value: `$${d.price.toFixed(2)}`, swatch: BAR_COLOR }
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="price" fill={BAR_COLOR} radius={CHART_BAR_RADIUS_HORIZONTAL} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </div>
      ) : null}
    </div>
  );
}
