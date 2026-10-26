// DSCR → status band. Classified on the value rounded to 2 decimals so the
// color always agrees with the number shown on screen (1.199 displays as
// "1.20" and is therefore green, not yellow).

export const DSCR_BANDS = [
  { key: 'negative', label: 'Negative Cash Flow', short: 'Below 1.00', min: -Infinity, max: 1, color: '#d03b3b' },
  { key: 'tight', label: 'Tight Approval', short: '1.00 – 1.19', min: 1, max: 1.2, color: '#eab308' },
  { key: 'sweet', label: 'Lender Sweet Spot', short: '1.20 – 1.25', min: 1.2, max: 1.25, color: '#0ca30c' },
  { key: 'strong', label: 'Strong Approval', short: 'Above 1.25', min: 1.25, max: Infinity, color: '#2a78d6' },
];

export function dscrStatus(dscr) {
  if (!Number.isFinite(dscr)) return DSCR_BANDS[3];
  const v = Math.round(dscr * 100) / 100;
  if (v < 1) return DSCR_BANDS[0];
  if (v < 1.2) return DSCR_BANDS[1];
  if (v <= 1.25) return DSCR_BANDS[2];
  return DSCR_BANDS[3];
}

// Tailwind classes per band, used for chips and card accents.
export const BAND_CLASSES = {
  negative: {
    chip: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-600',
  },
  tight: {
    chip: 'bg-yellow-100 text-yellow-900 ring-yellow-600/30 dark:bg-yellow-400/15 dark:text-yellow-200 dark:ring-yellow-400/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    bar: 'bg-yellow-500',
  },
  sweet: {
    chip: 'bg-green-100 text-green-800 ring-green-600/20 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/30',
    text: 'text-green-700 dark:text-green-400',
    bar: 'bg-green-600',
  },
  strong: {
    chip: 'bg-blue-100 text-blue-800 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30',
    text: 'text-blue-700 dark:text-blue-400',
    bar: 'bg-blue-600',
  },
};
