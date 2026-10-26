// Chart colors per theme. Categorical slots are validated against the card
// surfaces (white / zinc-900) for lightness, chroma, CVD and contrast; slot
// order is fixed and follows the deal (or the return component), never rank.

export const CHART_THEME = {
  light: {
    series: ['#2a78d6', '#eb6834', '#1baf7a'],
    total: '#18181b',
    grid: '#e4e4e7',
    axis: '#d4d4d8',
    tick: '#71717a',
    surface: '#ffffff',
    zero: '#a1a1aa',
  },
  dark: {
    series: ['#3987e5', '#d95926', '#199e70'],
    total: '#f4f4f5',
    grid: '#27272a',
    axis: '#3f3f46',
    tick: '#a1a1aa',
    surface: '#18181b',
    zero: '#71717a',
  },
};

export function chartTheme(dark) {
  return dark ? CHART_THEME.dark : CHART_THEME.light;
}
