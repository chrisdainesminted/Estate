// A deal's grade, the way a game ranks a run: S, A, B, C, D or F, from a
// score out of 100 built on the three numbers investors judge a rental by.
//
// - Cash flow per door each month: -$400 or worse scores 0, +$400 or
//   better scores 40.
// - The lender's debt cover ratio (DSCR): 0.8 or less scores 0, 1.5 or
//   more scores 30.
// - Cash-on-cash return on the money put in: -4% or less scores 0, 12% or
//   more scores 30.
//
// It's a quick read, not a verdict: the deal's own numbers say why.

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const scale = (v, lo, hi) => clamp01((num(v) - lo) / (hi - lo));

export const GRADES = [
  { rank: 'S', min: 90, label: 'Exceptional', tone: 'gold' },
  { rank: 'A', min: 75, label: 'Strong', tone: 'good' },
  { rank: 'B', min: 58, label: 'Solid', tone: 'good' },
  { rank: 'C', min: 42, label: 'Thin', tone: 'warn' },
  { rank: 'D', min: 25, label: 'Weak', tone: 'bad' },
  { rank: 'F', min: 0, label: 'Loses money', tone: 'bad' },
];

/** { rank, label, tone, score } for a deal's analysis (analyzeDeal's result). */
export function dealGrade(a) {
  if (!a || !(num(a.price) > 0)) return null;
  const doors = Math.max(Math.round(num(a.units)) || 1, 1);
  const score = Math.round(40 * scale(num(a.netCashFlow) / doors, -400, 400) + 30 * scale(a.dscr, 0.8, 1.5) + 30 * scale(a.coc, -0.04, 0.12));
  const g = GRADES.find((x) => score >= x.min) ?? GRADES[GRADES.length - 1];
  return { ...g, score };
}
