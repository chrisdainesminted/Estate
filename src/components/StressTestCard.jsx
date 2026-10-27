import { useMemo, useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import { analyzeDeal, breakevenRate, stressGrid } from '../lib/finance.js';
import { DSCR_BANDS } from '../lib/dscr.js';
import { money, percent, ratio } from '../lib/format.js';
import { Card, CardHeader, Segmented } from './ui.jsx';

const POS = [5, 150, 105]; // emerald-600
const NEG = [220, 38, 38]; // red-600

// Diverging fill for cash flow: green above $0, red below, stronger with size.
function cashFlowFill(v, maxAbs) {
  const t = Math.min(Math.abs(v) / (maxAbs || 1), 1);
  const [r, g, b] = v >= 0 ? POS : NEG;
  return `rgb(${r} ${g} ${b} / ${0.08 + t * 0.42})`;
}

function dscrFill(status) {
  const band = DSCR_BANDS.find((b) => b.key === status.key);
  return `${band.color}4d`; // ~30% alpha
}

/**
 * Rent change × interest-rate grid. Each cell is the deal re-run; clicking
 * one applies it as the what-if, so the rest of the page follows.
 */
export default function StressTestCard({ deal, adj, onPick }) {
  const [metric, setMetric] = useState('cashFlow');
  const base = useMemo(() => (adj.downPct != null ? { ...deal, downPct: adj.downPct } : deal), [deal, adj.downPct]);
  const grid = useMemo(() => stressGrid(base), [base]);
  const a = useMemo(() => analyzeDeal(base), [base]);
  const maxAbs = Math.max(...grid.flat().map((c) => Math.abs(c.netCashFlow)));
  const beRate = useMemo(() => breakevenRate(base), [base]);
  const beRentDrop = a.grossRent > 0 ? a.breakevenRent / a.grossRent - 1 : 0;
  const rateHeads = grid[0];

  const summary =
    a.netCashFlow < 0
      ? `At today’s ${Number(base.rate)}% this deal already loses money. It needs ${percent(beRentDrop, 1, { signed: true })} rent${beRate != null ? ` or a rate under ${beRate.toFixed(2)}%` : ''} to break even.`
      : `Cash flow holds until rent falls ${percent(-beRentDrop, 1)}${beRate != null ? `, or the rate climbs to ${beRate.toFixed(2)}%` : ''}.`;

  return (
    <Card id="sec-stress" delay={110}>
      <CardHeader
        icon={Grid3x3}
        title="Stress test"
        subtitle="Rent and rate moving together. Click a cell to try it as your what-if."
        actions={
          <Segmented
            size="sm"
            label="Stress test measure"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'cashFlow', label: 'Cash flow' },
              { value: 'dscr', label: 'DSCR' },
            ]}
          />
        }
      />
      <div className="px-6 pt-5">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{summary}</p>
      </div>
      <div className="thin-scroll overflow-x-auto p-4 sm:p-6">
        <table className="tabular w-full min-w-[600px] border-separate border-spacing-1 text-sm">
          <caption className="sr-only">
            Monthly {metric === 'cashFlow' ? 'cash flow' : 'DSCR'} by rent change (rows) and interest rate (columns)
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-28 px-2 pb-1 text-left text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Rent ↓ · Rate →
              </th>
              {rateHeads.map((c) => (
                <th key={c.rateDelta} scope="col" className="px-1 pb-1 text-center">
                  <span className={`block text-xs font-semibold ${c.rateDelta === 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>{c.rate.toFixed(2)}%</span>
                  <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">{c.rateDelta === 0 ? 'today' : `${c.rateDelta > 0 ? '+' : '−'}${Math.abs(c.rateDelta)}`}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row[0].rentPct}>
                <th scope="row" className="px-2 text-left">
                  <span className={`block text-xs font-semibold ${row[0].rentPct === 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                    {row[0].rentPct === 0 ? 'Today' : `${row[0].rentPct > 0 ? '+' : '−'}${Math.abs(row[0].rentPct)}%`}
                  </span>
                  <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">{money(a.grossRent * (1 + row[0].rentPct / 100))}/mo</span>
                </th>
                {row.map((c) => {
                  const current = c.rentPct === (adj.rentPct ?? 0) && c.rateDelta === (adj.rateDelta ?? 0);
                  const isBase = c.rentPct === 0 && c.rateDelta === 0;
                  const value = metric === 'cashFlow' ? money(c.netCashFlow, { signed: true }) : ratio(c.dscr);
                  return (
                    <td key={c.rateDelta} className="p-0">
                      <button
                        type="button"
                        onClick={() => onPick({ rentPct: c.rentPct, rateDelta: c.rateDelta })}
                        aria-pressed={current}
                        aria-label={`Rent ${c.rentPct === 0 ? 'unchanged' : `${c.rentPct}%`}, rate ${c.rate.toFixed(2)}%: ${metric === 'cashFlow' ? `${money(c.netCashFlow, { signed: true })} a month` : `DSCR ${ratio(c.dscr)}, ${c.status.label}`}. Try it as the what-if.`}
                        className={`h-11 w-full rounded-lg px-1 text-xs font-semibold text-zinc-900 transition hover:ring-2 hover:ring-zinc-900/30 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-white dark:hover:ring-white/40 ${
                          current ? 'ring-2 ring-zinc-900 dark:ring-white' : ''
                        } ${isBase && !current ? 'underline decoration-dotted underline-offset-4' : ''}`}
                        style={{ background: metric === 'cashFlow' ? cashFlowFill(c.netCashFlow, maxAbs) : dscrFill(c.status) }}
                      >
                        {value}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          {metric === 'cashFlow' ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: cashFlowFill(1, 1) }} aria-hidden /> Cash flows
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: cashFlowFill(-1, 1) }} aria-hidden /> Loses money
              </span>
            </>
          ) : (
            DSCR_BANDS.map((b) => (
              <span key={b.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: `${b.color}80` }} aria-hidden /> {b.label}
              </span>
            ))
          )}
          <span className="ml-auto">Outlined: your current what-if. Dotted: the deal as saved.</span>
        </p>
      </div>
    </Card>
  );
}
