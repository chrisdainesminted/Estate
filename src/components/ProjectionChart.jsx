import { useMemo, useState } from 'react';
import { BarChart3, Table2, TrendingUp } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTheme } from '../lib/chartTheme.js';
import { compactMoney, money, percent } from '../lib/format.js';
import { Card, CardHeader, Segmented, Stat } from './ui.jsx';

const SERIES = [
  { key: 'cumCashFlow', label: 'Cumulative cash flow' },
  { key: 'cumPrincipal', label: 'Principal paydown' },
  { key: 'cumAppreciation', label: 'Appreciation' },
];

function ProjectionTooltip({ active, payload, label, theme }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="min-w-52 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">Year {label}</div>
      {SERIES.map((s, i) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className="size-2.5 rounded-sm" style={{ background: theme.series[i] }} aria-hidden />
            {s.label}
          </span>
          <span className="tabular font-medium text-zinc-900 dark:text-zinc-100">{money(row[s.key], { signed: true })}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="h-0.5 w-3 rounded-full" style={{ background: theme.total }} aria-hidden />
          Total return
        </span>
        <span className="tabular font-semibold text-zinc-900 dark:text-zinc-100">{money(row.totalReturn, { signed: true })}</span>
      </div>
      <div className="tabular mt-1 text-right text-zinc-500 dark:text-zinc-400">{percent(row.roi, 0)} of cash invested</div>
    </div>
  );
}

export default function ProjectionChart({ rows, a, dark, appreciationPct }) {
  const [view, setView] = useState('chart');
  const theme = chartTheme(dark);
  const y10 = rows[rows.length - 1];
  const years = rows.length;

  const annualized = useMemo(() => {
    // Simple CAGR on cash invested: (cash + total return) / cash, annualized.
    if (!(a.cashToClose > 0)) return 0;
    const end = a.cashToClose + y10.totalReturn;
    return end > 0 ? Math.pow(end / a.cashToClose, 1 / years) - 1 : -1;
  }, [a.cashToClose, y10.totalReturn, years]);

  return (
    <Card className="@container">
      <CardHeader
        icon={TrendingUp}
        title={`${years}-year wealth projection`}
        subtitle={`Cash flow + principal paydown + ${appreciationPct}% annual appreciation, cumulative.`}
        actions={
          <Segmented
            size="sm"
            label="Projection view"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart', icon: BarChart3 },
              { value: 'table', label: 'Table', icon: Table2 },
            ]}
          />
        }
      />

      <div className="p-5">
        {view === 'chart' ? (
          <>
            <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300" aria-label="Legend">
              {SERIES.map((s, i) => (
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
                <ComposedChart data={rows} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke={theme.grid} />
                  <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: theme.axis }} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={(y) => `Y${y}`} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={compactMoney} width={56} />
                  <ReferenceLine y={0} stroke={theme.zero} />
                  <Tooltip content={<ProjectionTooltip theme={theme} />} cursor={{ fill: dark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }} />
                  {SERIES.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="wealth"
                      fill={theme.series[i]}
                      stroke={theme.surface}
                      strokeWidth={2}
                      maxBarSize={28}
                      radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                      isAnimationActive={false}
                    />
                  ))}
                  <Line
                    dataKey="totalReturn"
                    type="monotone"
                    stroke={theme.total}
                    strokeWidth={2}
                    dot={{ r: 4, fill: theme.total, stroke: theme.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: theme.total, stroke: theme.surface, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-[11px] tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  {['Year', 'Annual cash flow', 'Cum. cash flow', 'Cum. paydown', 'Appreciation', 'Total return', 'Property value', 'Loan balance', 'Equity'].map((h) => (
                    <th key={h} className="py-1.5 pr-2 text-right font-medium first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.year} className="border-t border-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
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

      <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 px-5 py-4 @lg:grid-cols-3 @4xl:grid-cols-5 dark:border-zinc-800">
        <Stat label={`Year-${years} total return`} value={money(y10.totalReturn, { signed: true })} sub={`${percent(y10.roi, 0)} of cash invested`} />
        <Stat label="Annualized" value={percent(annualized, 1)} sub="on cash invested" />
        <Stat label="Property value" value={money(y10.value)} sub={`from ${money(a.price)}`} />
        <Stat label="Loan balance" value={money(y10.balance)} sub={`from ${money(a.loanAmount)}`} />
        <Stat label="Equity" value={money(y10.equity)} sub="value − balance" />
      </div>
    </Card>
  );
}
