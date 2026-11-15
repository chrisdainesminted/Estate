// The look of the city pages (src/seo/cityPages.js): plain HTML, so its
// own small stylesheet, in the site's colours. A brand copy of the site
// replaces this file with its own (see scripts/rebrand.mjs).

export const PAGE_THEME = {
  // Whether search engines may list these pages on this site.
  index: true,
  themeColor: '#0b0b0c',
  colorScheme: 'dark',
  vars: {
    page: '#0b0b0c',
    panel: '#141416',
    line: '#26262a',
    ink: '#f4f4f5',
    soft: '#a1a1aa',
    accent: '#73FF6A',
    accentInk: '#052e16',
    good: '#73FF6A',
    bad: '#ff8a80',
    font: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    radius: '10px',
  },
};
