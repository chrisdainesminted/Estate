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
    chip: 'bg-red-500/10 text-red-700 ring-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-600',
  },
  tight: {
    chip: 'bg-yellow-400/20 text-yellow-900 ring-yellow-600/30 dark:bg-yellow-400/15 dark:text-yellow-200 dark:ring-yellow-300/25',
    text: 'text-yellow-700 dark:text-yellow-300',
    bar: 'bg-yellow-500',
  },
  sweet: {
    chip: 'bg-green-500/10 text-green-800 ring-green-600/25 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/25',
    text: 'text-green-700 dark:text-green-400',
    bar: 'bg-green-600',
  },
  strong: {
    chip: 'bg-blue-500/10 text-blue-800 ring-blue-600/25 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/25',
    text: 'text-blue-700 dark:text-blue-400',
    bar: 'bg-blue-600',
  },
};

/**
 * One-line verdict on a deal in plain words: whether it makes money each
 * month, flagging a tight lender check. The sentence beside it explains a
 * loss a lender would still approve (`trap`).
 */
export function verdict(a) {
  if (a.lenderApprovedButNegative) return { key: 'trap', tone: 'bad', label: 'Loses money each month' };
  if (a.netCashFlow < 0) return { key: 'negative', tone: 'bad', label: 'Loses money each month' };
  if (a.status.key === 'tight') return { key: 'tight', tone: 'warn', label: 'Makes money, lender check is tight' };
  return { key: 'good', tone: 'good', label: 'Makes money each month' };
}

export const TONE_CLASSES = {
  bad: 'bg-red-500/10 text-red-700 ring-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25',
  warn: 'bg-amber-400/15 text-amber-800 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-300/25',
  good: 'bg-emerald-500/10 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-300/25',
};
