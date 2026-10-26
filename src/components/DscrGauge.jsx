import { DSCR_BANDS } from '../lib/dscr.js';
import { ratio } from '../lib/format.js';
import { DscrChip } from './ui.jsx';

// Piecewise-linear scale so the narrow 1.20–1.25 sweet spot stays visible.
// Tick labels sit at every breakpoint, so the stretching is never hidden.
const STOPS = [0.5, 1.0, 1.2, 1.25, 2.0];
const FRACS = [0, 0.36, 0.6, 0.72, 1];

function toFrac(v) {
  if (!Number.isFinite(v) || v >= STOPS[4]) return 1;
  if (v <= STOPS[0]) return 0;
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i]) {
      const t = (v - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1]);
      return FRACS[i - 1] + t * (FRACS[i] - FRACS[i - 1]);
    }
  }
  return 1;
}

const CX = 120;
const CY = 112;
const R = 92;

function point(frac, radius = R) {
  const theta = Math.PI * (1 - frac);
  return [CX + radius * Math.cos(theta), CY - radius * Math.sin(theta)];
}

function arc(f0, f1) {
  const [x0, y0] = point(f0);
  const [x1, y1] = point(f1);
  return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
}

// Small angular gap between bands, in fraction-of-sweep units.
const GAP = 0.006;

export default function DscrGauge({ a }) {
  const f = toFrac(a.dscr);
  const [nx, ny] = point(f, R - 26);
  const labels = [
    { v: 0.5, text: '0.50' },
    { v: 1.0, text: '1.00' },
    { v: 1.2, text: '1.20' },
    { v: 1.25, text: '1.25' },
    { v: 2.0, text: '2.00+' },
  ];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 132" className="w-full max-w-xs" role="img" aria-label={`DSCR gauge at ${ratio(a.dscr)}, ${a.status.label}`}>
        {DSCR_BANDS.map((b, i) => (
          <path
            key={b.key}
            d={arc(FRACS[i] + (i ? GAP : 0), FRACS[i + 1] - (i < 3 ? GAP : 0))}
            stroke={b.color}
            strokeWidth={16}
            fill="none"
            strokeLinecap="butt"
            opacity={b.key === a.status.key ? 1 : 0.22}
            style={b.key === a.status.key ? { filter: `drop-shadow(0 0 6px ${b.color}99)` } : undefined}
          />
        ))}
        {labels.map((l) => {
          const fr = toFrac(l.v);
          // End labels sit under the arc tips; inner labels ride outside the arc.
          const isEnd = fr === 0 || fr === 1;
          const [tx, ty] = isEnd ? [point(fr)[0], CY + 16] : point(fr, R + 15);
          return (
            <text
              key={l.text}
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-500 text-[9px] dark:fill-zinc-400"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {l.text}
            </text>
          );
        })}
        <line x1={CX} y1={CY} x2={nx} y2={ny} strokeWidth={3} strokeLinecap="round" className="stroke-zinc-900 dark:stroke-white" />
        <circle cx={CX} cy={CY} r={7} className="fill-zinc-900 stroke-white/80 dark:fill-white dark:stroke-zinc-900" strokeWidth={2.5} />
      </svg>
      <div className="-mt-1 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white">{ratio(a.dscr)}</div>
      <div className="mt-1.5">
        <DscrChip status={a.status} />
      </div>
      <dl className="mt-5 grid w-full max-w-xs grid-cols-1 gap-y-0.5 rounded-2xl bg-well p-2 text-xs">
        {DSCR_BANDS.map((b) => (
          <div
            key={b.key}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${b.key === a.status.key ? 'bg-white/70 font-semibold text-zinc-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}
          >
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: b.color }} aria-hidden />
            <dt className="tabular w-20 shrink-0">{b.short}</dt>
            <dd className="truncate">{b.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
