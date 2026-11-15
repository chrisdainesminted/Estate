// Homeward's look for the city pages (replaces src/seo/theme.js on the
// Homeward copy of the site; see scripts/rebrand.mjs). They're the same
// listings as the main site's, so they stay out of search results here.

export const PAGE_THEME = {
  index: false,
  themeColor: '#faf6ef',
  colorScheme: 'light',
  vars: {
    page: '#faf6ef',
    panel: '#fffdf8',
    line: '#ebe1d1',
    ink: '#2b2219',
    soft: '#66543f',
    accent: '#7a5a3c',
    accentInk: '#fffdf8',
    good: '#3f7a3c',
    bad: '#a5402d',
    font: "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    radius: '14px',
  },
};
