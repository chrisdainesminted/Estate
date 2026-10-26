// Chart colors per theme. Categorical slots are validated against the card
// surfaces (white / slate-900) for lightness, chroma, CVD and contrast; slot
// order is fixed and follows the deal (or the return component), never rank.

export const CHART_THEME = {
  light: {
    series: ['#2a78d6', '#eb6834', '#1baf7a'],
    total: '#0f172a',
    grid: '#e2e8f0',
    axis: '#cbd5e1',
    tick: '#64748b',
    surface: '#ffffff',
    zero: '#94a3b8',
  },
  dark: {
    series: ['#3987e5', '#d95926', '#199e70'],
    total: '#f1f5f9',
    grid: '#1e293b',
    axis: '#334155',
    tick: '#94a3b8',
    surface: '#0f172a',
    zero: '#64748b',
  },
};

export function chartTheme(dark) {
  return dark ? CHART_THEME.dark : CHART_THEME.light;
}
