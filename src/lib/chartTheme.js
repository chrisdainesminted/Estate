// Chart colors per theme. Categorical slots are validated against the panel
// surfaces (#ffffff light / #0f0f11 dark) for lightness, chroma, CVD and
// contrast; slot order is fixed and follows the deal (or the return
// component), never rank.

export const CHART_THEME = {
  light: {
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
    total: '#18181b',
    grid: '#e4e4e7',
    axis: '#d4d4d8',
    tick: '#71717a',
    surface: '#ffffff', // the panel color; used for 2px gaps and marker rings
    zero: '#a1a1aa',
  },
  dark: {
    series: ['#3987e5', '#d95926', '#199e70', '#c98500'],
    total: '#f4f4f5',
    grid: '#27272a',
    axis: '#3f3f46',
    tick: '#a1a1aa',
    surface: '#0f0f11',
    zero: '#71717a',
  },
};

export function chartTheme(dark) {
  return dark ? CHART_THEME.dark : CHART_THEME.light;
}

/**
 * Clean y-axis ticks (1/2/5 × 10^k steps). A negative minimum that is tiny
 * next to the maximum gets no tick of its own, so a −$650 sliver doesn't
 * cost a whole −$40K band of chart height.
 */
export function niceScale(min, max, target = 5) {
  const lo = Math.min(min, 0);
  const hi = Math.max(max, 0);
  const span = hi - lo || 1;
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = Math.ceil(hi / step) * step;
  const minor = lo < 0 && -lo < span * 0.04;
  const bottom = lo < 0 && !minor ? Math.floor(lo / step) * step : 0;
  const ticks = [];
  for (let t = bottom; t <= top + step / 2; t += step) ticks.push(Math.round(t));
  return { domain: [minor ? lo : bottom, top], ticks };
}
