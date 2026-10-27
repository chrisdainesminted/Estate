import { useMemo, useState } from 'react';
import { BarChart3, Landmark, Table2, TrendingUp } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTheme, niceScale } from '../lib/chartTheme.js';
import { loanSchedule } from '../lib/finance.js';
import { compactMoney, money } from '../lib/format.js';
import { Card, CardHeader, Segmented, Stat, signedClass } from './ui.jsx';
import { CHART_ANIMATE } from './motion.jsx';

const SERIES = [
  { key: 'cumCashFlow', label: 'Cumulative cash flow' },
  { key: 'cumPrincipal', label: 'Principal paydown' },
  { key: 'cumAppreciation', label: 'Appreciation' },
];
// Only shown when a refinance is planned: its penalty and fees, drawn below zero.
const REFI_SERIES = { key: 'refiCostsNeg', label: 'Refinance costs' };

function ProjectionTooltip({ active, payload, label, theme, series }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="glass-strong min-w-56 rounded-2xl p-3.5 text-xs">
      <div className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">Year {label}</div>
      {series.map((s, i) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className="size-2.5 rounded-sm" style={{ background: theme.series[i] }} aria-hidden />
            {s.label}
          </span>
          <span className="tabular font-medium text-zinc-900 dark:text-zinc-100">{money(row[s.key], { signed: true })}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-hairline pt-1.5">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="h-0.5 w-3 rounded-full" style={{ background: theme.total }} aria-hidden />
          Total return
        </span>
        <span className="tabular font-semibold text-zinc-900 dark:text-zinc-100">{money(row.totalReturn, { signed: true })}</span>
      </div>
      <div className="tabular mt-1.5 flex justify-between gap-4 text-zinc-500 dark:text-zinc-400">
        <span>If sold this year</span>
        <span className={`font-medium ${signedClass(row.profitIfSold)}`}>{money(row.profitIfSold, { signed: true })}</span>
      </div>
    </div>
  );
}

export default function ProjectionChart({ rows, a, deal, dark, appreciationPct }) {
  const [view, setView] = useState('chart');
  const schedule = useMemo(() => loanSchedule(deal, rows.length), [deal, rows.length]);
  const theme = chartTheme(dark);
  const y10 = rows[rows.length - 1];
  const hasRefi = rows.some((r) => r.cumRefiCosts > 0);
  const series = hasRefi ? [...SERIES, REFI_SERIES] : SERIES;
  const data = useMemo(() => rows.map((r) => ({ ...r, refiCostsNeg: -r.cumRefiCosts })), [rows]);
  const years = rows.length;

  // Stacked with stackOffset="sign": positives stack up, negatives stack down.
  const scale = useMemo(() => {
    let lo = 0;
    let hi = 0;
    rows.forEach((r) => {
      const parts = [...SERIES.map((s) => r[s.key]), -r.cumRefiCosts];
      const up = parts.filter((v) => v > 0).reduce((s, v) => s + v, 0);
      const down = parts.filter((v) => v < 0).reduce((s, v) => s + v, 0);
      hi = Math.max(hi, up, r.totalReturn);
      lo = Math.min(lo, down, r.totalReturn);
    });
    return niceScale(lo, hi);
  }, [rows]);

  return (
    <Card id="sec-projection" delay={180} className="@container">
      <CardHeader
        icon={TrendingUp}
        title={`${years}-year wealth projection`}
        subtitle={`Cumulative cash flow + principal paydown + ${appreciationPct}% annual appreciation, before selling costs.`}
        actions={
          <Segmented
            size="sm"
            label="Projection view"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart', icon: BarChart3 },
              { value: 'table', label: 'Table', icon: Table2 },
              { value: 'loan', label: 'Loan', icon: Landmark },
            ]}
          />
        }
      />

      <div className="p-5">
        {view === 'chart' ? (
          <>
            <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300" aria-label="Legend">
              {series.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: theme.series[i] }} aria-hidden />
                  {s.label}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full" style={{ background: theme.total }} aria-hidden />
                Total return
              </li>
            </ul>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke={theme.grid} />
                  <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: theme.axis }} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={(y) => `Y${y}`} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: theme.tick, fontSize: 11 }}
                    tickFormatter={compactMoney}
                    width={56}
                    domain={scale.domain}
                    ticks={scale.ticks}
                    allowDataOverflow
                  />
                  <ReferenceLine y={0} stroke={theme.zero} />
                  <Tooltip content={<ProjectionTooltip theme={theme} series={series} />} cursor={{ fill: dark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }} />
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="wealth"
                      fill={theme.series[i]}
                      stroke={theme.surface}
                      strokeWidth={2}
                      maxBarSize={28}
                      radius={s.key === 'cumAppreciation' ? [4, 4, 0, 0] : 0}
                      isAnimationActive={CHART_ANIMATE} animationDuration={700}
                    />
                  ))}
                  <Line
                    dataKey="totalReturn"
                    type="monotone"
                    stroke={theme.total}
                    strokeWidth={2}
                    dot={{ r: 4, fill: theme.total, stroke: theme.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: theme.total, stroke: theme.surface, strokeWidth: 2 }}
                    isAnimationActive={CHART_ANIMATE} animationDuration={700}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : view === 'loan' ? (
          <div tabIndex={0} role="region" aria-label="Loan schedule" className="thin-scroll overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Loan payments by year</caption>
              <thead>
                <tr className="eyebrow">
                  {['Year', 'Payments', 'Interest', 'Principal', 'Balance at year end', 'Note'].map((h, i) => (
                    <th key={h} className={`py-1.5 pr-3 font-medium ${i === 0 || i === 5 ? 'text-left' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {schedule.map((r) => (
                  <tr key={r.year} className="border-t border-hairline text-zinc-700 dark:text-zinc-300">
                    <td className="py-2 pr-3">{r.year}</td>
                    <td className="py-2 pr-3 text-right">{money(r.payment)}</td>
                    <td className="py-2 pr-3 text-right">{money(r.interest)}</td>
                    <td className="py-2 pr-3 text-right">{money(r.principal)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-zinc-900 dark:text-white">{money(r.balance)}</td>
                    <td className="py-2 text-left text-xs text-emerald-700 dark:text-emerald-300">{r.note}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular">
                <tr className="border-t border-zinc-300 font-semibold text-zinc-900 dark:border-zinc-600 dark:text-white">
                  <td className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 text-right">{money(schedule.reduce((s, r) => s + r.payment, 0))}</td>
                  <td className="py-2 pr-3 text-right">{money(schedule.reduce((s, r) => s + r.interest, 0))}</td>
                  <td className="py-2 pr-3 text-right">{money(schedule.reduce((s, r) => s + r.principal, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div tabIndex={0} role="region" aria-label="Projection by year" className="thin-scroll overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Projection by year</caption>
              <thead>
                <tr className="eyebrow">
                  {['Year', 'Annual cash flow', 'Cum. cash flow', 'Cum. paydown', 'Appreciation', 'Total return', 'Property value', 'Loan balance', 'Equity'].map((h) => (
                    <th key={h} className="py-1.5 pr-2 text-right font-medium first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.year} className="border-t border-hairline text-zinc-700 dark:text-zinc-300">
                    <td className="py-1.5 pr-2">{r.year}</td>
                    <td className="py-1.5 pr-2 text-right">{money(r.cashFlow, { signed: true })}</td>
                    <td className="py-1.5 pr-2 text-right">{money(r.cumCashFlow, { signed: true })}</td>
                    <td className="py-1.5 pr-2 text-right">{money(r.cumPrincipal)}</td>
                    <td className="py-1.5 pr-2 text-right">{money(r.cumAppreciation, { signed: true })}</td>
                    <td className="py-1.5 pr-2 text-right font-semibold text-zinc-900 dark:text-zinc-100">{money(r.totalReturn, { signed: true })}</td>
                    <td className="py-1.5 pr-2 text-right">{money(r.value)}</td>
                    <td className="py-1.5 pr-2 text-right">{money(r.balance)}</td>
                    <td className="py-1.5 pr-2 text-right">{money(r.equity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-hairline px-5 py-4 @lg:grid-cols-3 @4xl:grid-cols-5">
        <Stat label={`Year-${years} total return`} tip="totalReturn" value={money(y10.totalReturn, { signed: true })} sub="before selling costs" />
        <Stat label="Principal paid down" tip="paydown" value={money(y10.cumPrincipal)} sub={`over ${years} years`} />
        <Stat label="Property value" value={money(y10.value)} sub={`from ${money(a.price)}`} />
        <Stat label="Loan balance" value={money(y10.balance)} sub={`from ${money(a.loanAmount)}`} />
        <Stat label="Equity" tip="equity" value={money(y10.equity)} sub="value − balance" />
      </div>
    </Card>
  );
}
