import { Suspense, lazy, useMemo, useState } from 'react';
import { chartTheme, niceScale } from '../lib/chartTheme.js';
import { outlookMeaning } from '../lib/explain.js';
import { loanSchedule } from '../lib/finance.js';
import { money } from '../lib/format.js';
import { Segmented, Stat, signedClass } from './ui.jsx';
import { Section } from './Section.jsx';

// The chart and its library load only when the outlook is opened on its chart.
const ProjectionGraph = lazy(() => import('./ProjectionGraph.jsx'));

const SERIES = [
  { key: 'cumCashFlow', label: 'Cumulative cash flow' },
  { key: 'cumPrincipal', label: 'Principal paydown' },
  { key: 'cumAppreciation', label: 'Appreciation' },
];
// Only shown when a refinance is planned: its penalty and fees, drawn below zero.
const REFI_SERIES = { key: 'refiCostsNeg', label: 'Refinance costs' };

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
    <Section
      id="sec-projection"
      title={`${years}-year outlook`}
      value={money(y10.totalReturn, { signed: true })}
      valueClass={signedClass(y10.totalReturn)}
      meaning={outlookMeaning(years, appreciationPct)}
      actions={
        <Segmented
          size="sm"
          label="Projection view"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
            { value: 'loan', label: 'Loan' },
          ]}
        />
      }
    >

      <div className="p-5">
        {view === 'chart' ? (
          <Suspense fallback={<div className="skeleton h-80 rounded-md" aria-hidden />}>
            <ProjectionGraph data={data} series={series} scale={scale} theme={theme} dark={dark} />
          </Suspense>
        ) : view === 'loan' ? (
          <div tabIndex={0} role="region" aria-label="Loan schedule" className="thin-scroll overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Loan payments by year</caption>
              <thead>
                <tr className="caption">
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
                <tr className="caption">
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
    </Section>
  );
}
