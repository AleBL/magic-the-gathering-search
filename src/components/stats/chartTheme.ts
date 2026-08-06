/**
 * Shared Recharts theme for the deck-statistics panels.
 *
 * Colors are CSS custom properties (defined in src/style/variables.css)
 * referenced as `var(--chart-*)` strings. SVG presentation attributes
 * (fill/stroke) resolve custom properties live, so every chart re-themes
 * with the `html.dark` toggle automatically — no JS dark-mode branching.
 */

export type ManaColorKey = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

/** Fixed MTG mana-color identity mapping. Always pair with the mana-symbol icon. */
export const MANA_CHART_COLOR: Record<ManaColorKey, string> = {
  W: 'var(--chart-mana-w)',
  U: 'var(--chart-mana-u)',
  B: 'var(--chart-mana-b)',
  R: 'var(--chart-mana-r)',
  G: 'var(--chart-mana-g)',
  C: 'var(--chart-mana-c)'
};

/** Fixed-order categorical series — assign by entity identity, never by rank. */
export const CHART_CATEGORICAL = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
  'var(--chart-series-7)',
  'var(--chart-series-8)'
] as const;

/** Single-hue sequential/ordinal ramp, low -> high magnitude. */
export const CHART_SEQUENTIAL = [
  'var(--chart-sequential-1)',
  'var(--chart-sequential-2)',
  'var(--chart-sequential-3)',
  'var(--chart-sequential-4)'
] as const;

export const CHART_STATUS = {
  good: 'var(--chart-status-good)',
  warning: 'var(--chart-status-warning)',
  serious: 'var(--chart-status-serious)',
  critical: 'var(--chart-status-critical)'
} as const;

export const CHART_SURFACE = 'var(--chart-surface)';
export const CHART_GRID = 'var(--chart-grid)';
export const CHART_TEXT_MUTED = 'var(--chart-text-muted)';

/** Shared tick label style for XAxis/YAxis. */
export const CHART_TICK_STYLE = {
  fill: CHART_TEXT_MUTED,
  fontSize: 11,
  fontWeight: 600
} as const;

/** Shared CartesianGrid props. */
export const CHART_GRID_PROPS = {
  stroke: CHART_GRID,
  strokeDasharray: '3 3',
  vertical: false
} as const;

/** 4px rounded data-ends, anchored to the baseline (top corners for vertical bars). */
export const CHART_BAR_RADIUS_VERTICAL: [number, number, number, number] = [4, 4, 0, 0];
/** Right corners for horizontal bars. */
export const CHART_BAR_RADIUS_HORIZONTAL: [number, number, number, number] = [0, 4, 4, 0];

/** 2px surface-colored gap between adjacent/stacked fills (bars, pie/donut segments). */
export const CHART_SEGMENT_GAP = {
  stroke: CHART_SURFACE,
  strokeWidth: 2
} as const;
