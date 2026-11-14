import { dealGrade } from '../lib/grade.js';

// Each rank's colour: gold for S, the brand green for A and B, amber for C, red for D and F.
const TONES = {
  gold: { ring: 'ring-amber-400/60', text: 'text-amber-500 dark:text-amber-300', bar: 'bg-amber-400', glow: 'grade-glow-gold' },
  good: { ring: 'ring-emerald-500/50', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', glow: 'grade-glow-good' },
  warn: { ring: 'ring-amber-500/40', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500', glow: '' },
  bad: { ring: 'ring-red-500/40', text: 'text-red-700 dark:text-[#ff8a80]', bar: 'bg-red-500', glow: '' },
};

/**
 * A deal's grade as a game would show a rank: the letter in a tile, and
 * (when `full`) its name and a score bar out of 100. `size` "sm" is the
 * chip on a listing card.
 */
export default function GradeBadge({ a, full = false, size = 'md', className = '' }) {
  const g = dealGrade(a);
  if (!g) return null;
  const t = TONES[g.tone];
  const tile = size === 'sm' ? 'size-7 text-sm rounded-md' : 'size-12 text-2xl rounded-lg';
  const title = `Deal grade ${g.rank}: ${g.label}, ${g.score} out of 100 for cash flow, the lender's cover ratio and your return`;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} title={title}>
      <span
        className={`grade-tile font-hud grid shrink-0 place-items-center font-bold ring-1 ring-inset ${tile} ${t.ring} ${t.text} ${t.glow} bg-zinc-950/[0.03] dark:bg-white/[0.03]`}
        aria-label={full ? undefined : title}
      >
        {g.rank}
      </span>
      {full && (
        <span className="min-w-0">
          <span className="font-hud block text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase dark:text-zinc-400">Deal grade</span>
          <span className={`block text-sm font-semibold ${t.text}`}>
            {g.label} <span className="tabular font-normal text-zinc-500 dark:text-zinc-400">· {g.score}/100</span>
          </span>
          <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-(--track)" aria-hidden>
            <span className={`xp-fill block h-full rounded-full ${t.bar}`} style={{ width: `${g.score}%` }} />
          </span>
        </span>
      )}
    </span>
  );
}
