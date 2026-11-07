import { useMemo, useState } from 'react';
import HousePhoto from './HousePhoto.jsx';
import { dealPlace, estimateToday } from '../lib/finance.js';
import { money, percent } from '../lib/format.js';
import { projectedEquity } from '../lib/profile.js';

const up = 'text-emerald-700 dark:text-[#73ff6a]';
const down = 'text-red-700 dark:text-[#ff8a80]';
const RANGES = [1, 3, 5, 10];

/** A line through `values` in a 1000-wide box `h` tall, as an SVG path. */
function linePath(values, h, pad = 0.06) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * 1000 : 0;
      const y = h - (((v - lo) / span) * (1 - pad * 2) + pad) * h;
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/** A small line chart, like a stock's sparkline. */
export function Sparkline({ values, className = 'h-8 w-28', color }) {
  if (!values || values.length < 2) return null;
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden className={className}>
      <path d={linePath(values, 100)} fill="none" stroke={color ?? (rising ? '#4bd144' : '#f87171')} strokeWidth="2" vectorEffect="non-scaling-stroke" className={rising ? 'dark:stroke-[#73ff6a]' : 'dark:stroke-[#ff8a80]'} />
    </svg>
  );
}

/**
 * The top of the portfolio, like a brokerage account: equity in big type,
 * a chart of where it's headed, the totals beside it, and a watchlist of the
 * deals you're still weighing.
 */
export default function PortfolioHero({ owned, prospects, summary: p, onOpen }) {
  const [range, setRange] = useState(10);
  const proj = useMemo(() => projectedEquity(owned, 10), [owned]);
  const path = proj.total.slice(0, range + 1);
  const gain = path[path.length - 1] - path[0];
  const line = linePath(path, 240);
  const watch = prospects.filter((x) => !x.deal.example).slice(0, 5);

  return (
    <div className="flex flex-wrap gap-6">
      <section className="min-w-0 flex-[999_1_620px] rounded-2xl bg-white p-5 ring-1 ring-(--line-strong) ring-inset sm:p-6 dark:bg-[#101012]">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Your equity</p>
        <p className="tabular mt-1 text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl dark:text-white">{money(p.equity)}</p>
        <p className="tabular mt-2 text-[15px] font-semibold">
          <span className={gain >= 0 ? up : down}>
            {gain >= 0 ? '▲' : '▼'} {money(Math.abs(gain), { signed: false })} projected in {range} {range === 1 ? 'year' : 'years'}
          </span>
          <span className="font-medium text-zinc-500 dark:text-zinc-400"> · {money(p.netCashFlow, { signed: true })}/mo cash flow</span>
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">Equity, projected</p>
          <div role="group" aria-label="How far ahead" className="flex gap-1">
            {RANGES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={range === n}
                onClick={() => setRange(n)}
                className={`tabular h-8 rounded-full px-3 text-[13px] font-semibold transition ${range === n ? 'bg-zinc-950/[0.06] text-zinc-950 ring-1 ring-(--line-strong) ring-inset dark:bg-white/[0.08] dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
              >
                {n}Y
              </button>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 1000 240" preserveAspectRatio="none" role="img" aria-label={`Projected equity: ${money(path[0])} today, ${money(path[path.length - 1])} in ${range} years`} className="mt-3 block h-56 w-full">
          <line x1="0" y1="239" x2="1000" y2="239" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" vectorEffect="non-scaling-stroke" />
          <path d={`${line} L1000 240 L0 240 Z`} className="fill-emerald-500/10 dark:fill-[#73ff6a]/[0.07]" />
          <path d={line} fill="none" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="stroke-emerald-600 dark:stroke-[#73ff6a]" />
        </svg>
        <div className="tabular mt-1.5 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Today</span>
          <span>Year {Math.round(range / 2)}</span>
          <span>Year {range}</span>
        </div>
      </section>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl bg-white p-5 ring-1 ring-(--line-strong) ring-inset dark:bg-[#101012]">
          {[
            ['Worth today', money(p.value)],
            ['Owed', money(p.debt)],
            ['Cash flow', `${money(p.netCashFlow, { signed: true })}/mo`, p.netCashFlow >= 0 ? up : down],
            ['Return on cash', percent(p.coc, 1)],
          ].map(([k, v, tone]) => (
            <div key={k}>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{k}</p>
              <p className={`tabular mt-1 text-xl font-bold tracking-tight text-zinc-950 dark:text-white ${tone ?? ''}`}>{v}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-(--line-strong) ring-inset dark:bg-[#101012]">
          <h3 className="px-5 pt-4 pb-2 text-[15px] font-semibold text-zinc-950 dark:text-white">Watchlist</h3>
          {watch.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-zinc-600 dark:text-zinc-400">Deals you’re weighing show here. Open a listing and analyze it to add one.</p>
          ) : (
            <ul>
              {watch.map((x) => {
                const now = estimateToday(x.deal);
                return (
                  <li key={x.deal.id} className="border-t border-hairline">
                    <button type="button" onClick={() => onOpen(x.deal.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-well">
                      <HousePhoto address={x.deal.address || x.deal.name} place={dealPlace(x.deal)} className="size-10 shrink-0 rounded-lg" width={120} height={120} iconSize="size-4" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">{x.deal.name}</span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{x.a.units} {x.a.units === 1 ? 'unit' : 'units'}</span>
                      </span>
                      <span className="text-right">
                        <span className="tabular block text-sm font-semibold text-zinc-950 dark:text-white">{money(x.a.price)}</span>
                        <span className={`tabular block text-xs font-semibold ${now.netCashFlow >= 0 ? up : down}`}>{money(now.netCashFlow, { signed: true })}/mo</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export { projectedEquity };
