import { AlertTriangle, Copy, Columns3, Pencil, Plus, Trophy, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTheme } from '../lib/chartTheme.js';
import { compactMoney, money, percent } from '../lib/format.js';
import { MAX_DEALS } from '../lib/presets.js';
import { Button, Card, CardHeader, DscrChip, signedClass } from './ui.jsx';

const pctOf = (v) => percent(v, 2);

// best: 'high' | 'low' — which direction wins the row. Omitted rows are informational.
const ROWS = [
  { group: 'Property & financing' },
  { label: 'Purchase price', get: (x) => x.a.price, fmt: money },
  { label: 'Units', get: (x) => x.a.units, fmt: String },
  { label: 'Gross rent /mo', get: (x) => x.a.grossRent, fmt: money },
  { label: 'Down payment', get: (x) => x.a.downPayment, fmt: (v, x) => `${money(v)} · ${Number(x.deal.downPct)}%` },
  { label: 'Loan amount', get: (x) => x.a.loanAmount, fmt: money },
  { label: 'Interest rate', get: (x) => Number(x.deal.rate), fmt: (v) => `${v.toFixed(3).replace(/0$/, '')}%`, best: 'low' },
  { label: 'PITIA /mo', get: (x) => x.a.pitia, fmt: money },
  { group: 'Lender view' },
  { label: 'DSCR', get: (x) => x.a.dscr, fmt: (v, x) => <DscrChip status={x.a.status} dscr={v} size="sm" />, best: 'high' },
  { group: 'Real-world cash flow' },
  { label: 'OpEx /mo', get: (x) => x.a.opex.total, fmt: money },
  { label: 'Net cash flow /mo', get: (x) => x.a.netCashFlow, fmt: (v) => money(v, { signed: true }), best: 'high', signed: true },
  { label: 'Annual cash flow', get: (x) => x.a.annualCashFlow, fmt: (v) => money(v, { signed: true }), best: 'high', signed: true },
  {
    label: 'Rent cushion',
    hint: 'How far rent can fall before cash flow hits $0',
    get: (x) => (x.a.grossRent > 0 ? (x.a.grossRent - x.a.breakevenRent) / x.a.grossRent : 0),
    fmt: (v) => percent(v, 1, { signed: true }),
    best: 'high',
    signed: true,
  },
  { label: 'Cap rate', get: (x) => x.a.capRate, fmt: pctOf, best: 'high' },
  { group: 'Returns' },
  { label: 'Cash out of pocket', get: (x) => x.a.cashToClose, fmt: money, best: 'low' },
  { label: 'Cash-on-cash', get: (x) => x.a.coc, fmt: pctOf, best: 'high', signed: true },
  { label: 'Year-1 paydown', get: (x) => x.a.year1Principal, fmt: money, best: 'high' },
  { label: 'Year-1 total return', get: (x) => x.a.year1TotalReturn, fmt: (v) => money(v, { signed: true }), best: 'high', signed: true },
  { label: '10-yr total return', get: (x) => x.rows[x.rows.length - 1].totalReturn, fmt: (v) => money(v, { signed: true }), best: 'high' },
  { label: '10-yr equity', get: (x) => x.rows[x.rows.length - 1].equity, fmt: money, best: 'high' },
  { label: '10-yr return on cash', get: (x) => x.rows[x.rows.length - 1].roi, fmt: (v) => percent(v, 0), best: 'high' },
];

/** Indexes of the winning deal(s) for a row; ties share the win, an all-way tie has none. */
function bestIndexes(row, items) {
  if (!row.best || items.length < 2) return new Set();
  const vals = items.map(row.get).map((v) => (Number.isFinite(v) ? v : row.best === 'high' ? Number.MAX_VALUE : -Number.MAX_VALUE));
  const target = row.best === 'high' ? Math.max(...vals) : Math.min(...vals);
  // Compare at display precision so "$3,809" vs "$3,809" counts as a tie.
  const winners = vals.map((v, i) => (Math.abs(v - target) <= Math.abs(target) * 1e-4 + 1e-9 ? i : -1)).filter((i) => i >= 0);
  return winners.length === items.length ? new Set() : new Set(winners);
}

function CompareTooltip({ active, payload, label, items, theme }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="min-w-48 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-100">Year {label} total return</div>
      {items.map((x) => (
        <div key={x.deal.id} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: theme.series[x.deal.slot] }} aria-hidden />
            <span className="truncate">{x.deal.name}</span>
          </span>
          <span className="tabular font-medium text-zinc-900 dark:text-zinc-100">{money(row[x.deal.id], { signed: true })}</span>
        </div>
      ))}
    </div>
  );
}

function CompareChart({ items, dark }) {
  const theme = chartTheme(dark);
  const years = items[0].rows.length;
  const data = Array.from({ length: years + 1 }, (_, y) => {
    const point = { year: y };
    items.forEach((x) => {
      point[x.deal.id] = y === 0 ? 0 : x.rows[y - 1].totalReturn;
    });
    return point;
  });

  // Direct end labels only when they won't collide; otherwise legend + tooltip carry identity.
  const ends = items.map((x) => x.rows[years - 1].totalReturn);
  const span = Math.max(...ends, 0) - Math.min(...ends, 0) || 1;
  const sorted = [...ends].sort((p, q) => p - q);
  const labelsFit = sorted.every((v, i) => i === 0 || (v - sorted[i - 1]) / span > 0.09);

  const endLabel = (x) => (props) => {
    const { x: px, y: py, index } = props;
    if (index !== years) return null;
    return (
      <text x={px + 8} y={py} dy={4} fontSize={11} fill={theme.tick} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {compactMoney(x.rows[years - 1].totalReturn)}
      </text>
    );
  };

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300" aria-label="Legend">
        {items.map((x) => (
          <li key={x.deal.id} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: theme.series[x.deal.slot] }} aria-hidden />
            {x.deal.name}
          </li>
        ))}
      </ul>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: labelsFit ? 48 : 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: theme.axis }} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={(y) => `Y${y}`} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.tick, fontSize: 11 }} tickFormatter={compactMoney} width={56} />
            <Tooltip content={<CompareTooltip items={items} theme={theme} />} cursor={{ stroke: theme.axis }} />
            {items.map((x) => (
              <Line
                key={x.deal.id}
                dataKey={x.deal.id}
                name={x.deal.name}
                type="monotone"
                stroke={theme.series[x.deal.slot]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: theme.series[x.deal.slot], stroke: theme.surface, strokeWidth: 2 }}
                label={labelsFit ? endLabel(x) : false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function ComparisonMatrix({ items, activeId, onEdit, onDuplicate, onRemove, onAdd, dark, adjusted }) {
  const theme = chartTheme(dark);
  const canAdd = items.length < MAX_DEALS;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={Columns3}
          title="Side-by-side comparison"
          subtitle={adjusted ? 'Showing what-if values from the sensitivity sliders.' : 'Best value in each row is marked with a trophy.'}
          actions={
            canAdd && (
              <Button onClick={onAdd}>
                <Plus className="size-3.5" aria-hidden /> Add deal
              </Button>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-44 bg-white px-5 py-3 text-left text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400">
                  Metric
                </th>
                {items.map((x) => (
                  <th key={x.deal.id} className="px-4 py-3 text-right align-top">
                    <div className="flex items-center justify-end gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: theme.series[x.deal.slot] }} aria-hidden />
                      <span className={`truncate font-semibold ${x.deal.id === activeId ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {x.deal.name}
                      </span>
                    </div>
                    <div className="mt-1.5 flex justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => onEdit(x.deal.id)}
                        className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        aria-label={`Edit ${x.deal.name}`}
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {canAdd && (
                        <button
                          type="button"
                          onClick={() => onDuplicate(x.deal.id)}
                          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          aria-label={`Duplicate ${x.deal.name}`}
                          title="Duplicate"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      )}
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemove(x.deal.id)}
                          className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          aria-label={`Remove ${x.deal.name}`}
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {ROWS.map((row) => {
                if (row.group) {
                  return (
                    <tr key={row.group} className="bg-zinc-50 dark:bg-zinc-800/40">
                      <th
                        colSpan={items.length + 1}
                        className="sticky left-0 px-5 py-1.5 text-left text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
                      >
                        {row.group}
                      </th>
                    </tr>
                  );
                }
                const best = bestIndexes(row, items);
                return (
                  <tr key={row.label} className="border-t border-zinc-100 dark:border-zinc-800">
                    <th scope="row" className="sticky left-0 z-10 bg-white px-5 py-2 text-left font-normal text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300" title={row.hint}>
                      {row.label}
                    </th>
                    {items.map((x, i) => {
                      const v = row.get(x);
                      const isBest = best.has(i);
                      return (
                        <td key={x.deal.id} className={`px-4 py-2 text-right ${isBest ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : ''}`}>
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {isBest && <Trophy className="size-3.5 text-emerald-500 dark:text-emerald-400" aria-label="Best" />}
                            <span className={`${isBest ? 'font-semibold' : ''} ${row.signed ? signedClass(v) : 'text-zinc-900 dark:text-zinc-100'}`}>
                              {row.fmt(v, x)}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="border-t border-zinc-100 dark:border-zinc-800">
                <th scope="row" className="sticky left-0 z-10 bg-white px-5 py-2 text-left font-normal text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  Verdict
                </th>
                {items.map((x) => (
                  <td key={x.deal.id} className="px-4 py-2 text-right text-xs">
                    {x.a.lenderApprovedButNegative ? (
                      <span className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
                        <AlertTriangle className="size-3.5" aria-hidden /> Lender yes, cash flow no
                      </span>
                    ) : x.a.netCashFlow < 0 ? (
                      <span className="font-medium text-red-700 dark:text-red-400">Negative cash flow</span>
                    ) : x.a.status.key === 'tight' ? (
                      <span className="font-medium text-yellow-700 dark:text-yellow-300">Cash flows, tight DSCR</span>
                    ) : (
                      <span className="font-medium text-green-700 dark:text-green-400">Cash flows</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Columns3} title="10-year total return by deal" subtitle="Cumulative cash flow + principal paydown + appreciation." />
        <div className="p-5">
          <CompareChart items={items} dark={dark} />
        </div>
      </Card>
    </div>
  );
}
