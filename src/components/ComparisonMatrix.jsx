import { AlertTriangle, Check, Copy, Columns3, Pencil, Plus, TrendingUp, Trophy, X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTheme, niceScale } from '../lib/chartTheme.js';
import { TONE_CLASSES, verdict } from '../lib/dscr.js';
import { compactMoney, money, percent } from '../lib/format.js';
import { MAX_COMPARE } from '../lib/presets.js';
import { Button, Card, CardHeader, DscrChip, signedClass } from './ui.jsx';
import { CHART_ANIMATE, InfoTip } from './motion.jsx';

const pctOf = (v) => percent(v, 2);
const last = (x) => x.rows[x.rows.length - 1];

// best: 'high' | 'low' — which direction wins the row. Omitted rows are informational.
const ROWS = [
  { group: 'Property & financing' },
  { label: 'Purchase price', get: (x) => x.a.price, fmt: money },
  { label: 'Units', get: (x) => x.a.units, fmt: String },
  { label: 'Gross rent /mo', get: (x) => x.a.grossRent, fmt: money },
  { label: 'Down payment', get: (x) => x.a.downPayment, fmt: (v, x) => `${money(v)} · ${Number(x.deal.downPct)}%` },
  { label: 'Loan amount', get: (x) => x.a.loanAmount, fmt: money },
  { label: 'Interest rate', get: (x) => Number(x.deal.rate), fmt: (v) => `${v.toFixed(3).replace(/0$/, '')}%`, best: 'low' },
  { label: 'Payment type', tip: 'interestOnly', get: (x) => x.a.ioYears, fmt: (v) => (v > 0 ? `Interest-only ${v} yrs` : 'Amortizing') },
  { label: 'PITIA /mo', tip: 'pitia', get: (x) => x.a.pitia, fmt: money },
  { group: 'Lender view' },
  { label: 'DSCR', tip: 'dscr', get: (x) => x.a.dscr, fmt: (v, x) => <DscrChip status={x.a.status} dscr={v} size="sm" />, best: 'high' },
  { group: 'Real-world cash flow' },
  { label: 'OpEx /mo', tip: 'opex', get: (x) => x.a.opex.total, fmt: money },
  { label: 'Net cash flow /mo', tip: 'netCashFlow', get: (x) => x.a.netCashFlow, fmt: (v) => money(v, { signed: true }), best: 'high', signed: true },
  { label: 'Annual cash flow', get: (x) => x.a.annualCashFlow, fmt: (v) => money(v, { signed: true }), best: 'high', signed: true },
  {
    label: 'Rent cushion',
    tip: 'rentCushion',
    get: (x) => (x.a.grossRent > 0 ? (x.a.grossRent - x.a.breakevenRent) / x.a.grossRent : 0),
    fmt: (v) => percent(v, 1, { signed: true }),
    best: 'high',
    signed: true,
  },
  { label: 'Cap rate', tip: 'capRate', get: (x) => x.a.capRate, fmt: pctOf, best: 'high' },
  { group: 'Cash required' },
  { label: 'Rehab budget', get: (x) => x.a.rehab, fmt: money },
  { label: 'Cash invested', tip: 'cashInvested', get: (x) => x.a.cashInvested, fmt: money, best: 'low' },
  { label: 'Reserves to hold', tip: 'reserves', get: (x) => x.a.reserves, fmt: money },
  { group: 'Returns' },
  { label: 'Cash-on-cash', tip: 'coc', get: (x) => x.a.coc, fmt: pctOf, best: 'high', signed: true },
  { label: 'Year-1 paydown', tip: 'paydown', get: (x) => x.a.year1Principal, fmt: money, best: 'high' },
  { label: '10-yr equity', tip: 'equity', get: (x) => last(x).equity, fmt: money, best: 'high' },
  { label: 'Profit if sold, yr 10', tip: 'profitIfSold', get: (x) => x.sale.profit, fmt: (v) => money(v, { signed: true }), best: 'high', signed: true },
  { label: 'IRR', tip: 'irr', get: (x) => x.sale.irr, fmt: (v) => (Number.isFinite(v) ? percent(v, 1) : '—'), best: 'high' },
  { label: 'Equity multiple', tip: 'equityMultiple', get: (x) => x.sale.equityMultiple, fmt: (v) => (Number.isFinite(v) ? `${v.toFixed(2)}×` : '—'), best: 'high' },
];

/** Indexes of the winning deal(s) for a row; ties share the win, an all-way tie has none. */
function bestIndexes(row, items) {
  if (!row.best || items.length < 2) return new Set();
  const vals = items.map(row.get).map((v) => (Number.isFinite(v) ? v : row.best === 'high' ? -Number.MAX_VALUE : Number.MAX_VALUE));
  const target = row.best === 'high' ? Math.max(...vals) : Math.min(...vals);
  // Compare at display precision so "$3,809" vs "$3,809" counts as a tie.
  const winners = vals.map((v, i) => (Math.abs(v - target) <= Math.abs(target) * 1e-4 + 1e-9 ? i : -1)).filter((i) => i >= 0);
  return winners.length === items.length ? new Set() : new Set(winners);
}

/** Toggle chips choosing which saved deals sit in the comparison. */
export function CompareSelector({ items, compare, slotOf, onToggle, dark }) {
  const theme = chartTheme(dark);
  const full = compare.length >= MAX_COMPARE;
  return (
    <Card delay={40} className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="eyebrow mr-1">
          Comparing {compare.length} of {MAX_COMPARE}
        </span>
        {items.map(({ deal }) => {
          const slot = slotOf(deal.id);
          const on = slot !== undefined;
          return (
            <button
              key={deal.id}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onToggle(deal.id)}
              title={!on && full ? `Remove a deal first: up to ${MAX_COMPARE} side by side` : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                on
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-white/50 text-zinc-700 ring-1 ring-zinc-950/10 ring-inset hover:bg-white/80 dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/10'
              }`}
            >
              {on ? (
                <span className="size-2.5 rounded-full ring-2 ring-white/40" style={{ background: theme.series[slot] }} aria-hidden />
              ) : (
                <Plus className="size-3.5 opacity-60" aria-hidden />
              )}
              <span className="max-w-48 truncate">{deal.name}</span>
              {on && <Check className="size-3.5 opacity-60" aria-hidden />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function CompareTooltip({ active, payload, label, items, theme }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="glass-strong min-w-56 rounded-2xl p-3.5 text-xs">
      <div className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-100">Profit if sold in year {label}</div>
      {items.map((x) => (
        <div key={x.deal.id} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: theme.series[x.slot] }} aria-hidden />
            <span className="truncate">{x.deal.name}</span>
          </span>
          <span className={`tabular font-medium ${signedClass(row[x.deal.id])}`}>{money(row[x.deal.id], { signed: true })}</span>
        </div>
      ))}
    </div>
  );
}

function CompareChart({ items, dark }) {
  const theme = chartTheme(dark);
  const years = items[0].rows.length;
  const data = Array.from({ length: years }, (_, i) => {
    const point = { year: i + 1 };
    items.forEach((x) => {
      point[x.deal.id] = x.rows[i].profitIfSold;
    });
    return point;
  });

  const all = items.flatMap((x) => x.rows.map((r) => r.profitIfSold));
  const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all));

  // Direct end labels only when they won't collide; otherwise legend + tooltip carry identity.
  const ends = items.map((x) => last(x).profitIfSold);
  const span = scale.domain[1] - scale.domain[0] || 1;
  const sorted = [...ends].sort((p, q) => p - q);
  const labelsFit = sorted.every((v, i) => i === 0 || (v - sorted[i - 1]) / span > 0.09);

  const endLabel = (x) => (props) => {
    const { x: px, y: py, index } = props;
    if (index !== years - 1) return null;
    return (
      <text x={px + 8} y={py} dy={4} fontSize={11} fill={theme.tick} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {compactMoney(last(x).profitIfSold)}
      </text>
    );
  };

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300" aria-label="Legend">
        {items.map((x) => (
          <li key={x.deal.id} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: theme.series[x.slot] }} aria-hidden />
            {x.deal.name}
          </li>
        ))}
      </ul>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: labelsFit ? 52 : 12, bottom: 0, left: 0 }}>
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
            <Tooltip content={<CompareTooltip items={items} theme={theme} />} cursor={{ stroke: theme.axis }} />
            {items.map((x) => (
              <Line
                key={x.deal.id}
                dataKey={x.deal.id}
                name={x.deal.name}
                type="monotone"
                stroke={theme.series[x.slot]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: theme.series[x.slot], stroke: theme.surface, strokeWidth: 2 }}
                label={labelsFit ? endLabel(x) : false}
                isAnimationActive={CHART_ANIMATE} animationDuration={800}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const iconBtn = 'rounded-md p-1 text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200';
const stickyCell = 'max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-(--glass-strong) max-lg:backdrop-blur-xl';

export default function ComparisonMatrix({ items, activeId, onEdit, onDuplicate, onRemove, onAdd, canAdd, dark, adjusted }) {
  const theme = chartTheme(dark);

  if (!items.length) {
    return (
      <Card delay={80} className="p-10 text-center">
        <Columns3 className="mx-auto size-6 text-zinc-400" aria-hidden />
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Pick up to {MAX_COMPARE} deals above to compare them side by side.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card delay={120}>
        <CardHeader
          icon={Columns3}
          title="Side-by-side comparison"
          subtitle={adjusted ? 'Showing what-if values from the sensitivity sliders.' : 'Best value in each row is marked with a trophy.'}
          actions={
            canAdd && (
              <Button onClick={onAdd}>
                <Plus className="size-3.5" aria-hidden /> New deal
              </Button>
            )
          }
        />
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className={`eyebrow w-52 px-6 py-4 text-left font-medium ${stickyCell}`}>Metric</th>
                {items.map((x) => (
                  <th key={x.deal.id} className="px-4 py-3 text-right align-top">
                    <div className="flex items-center justify-end gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: theme.series[x.slot] }} aria-hidden />
                      <span className={`truncate font-semibold ${x.deal.id === activeId ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {x.deal.name}
                      </span>
                    </div>
                    <div className="mt-1.5 flex justify-end gap-0.5">
                      <button type="button" onClick={() => onEdit(x.deal.id)} className={iconBtn} aria-label={`Open ${x.deal.name}`} title="Open">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => onDuplicate(x.deal.id)} className={iconBtn} aria-label={`Duplicate ${x.deal.name}`} title="Duplicate">
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(x.deal.id)}
                        className="rounded-md p-1 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                        aria-label={`Remove ${x.deal.name} from comparison`}
                        title="Remove from comparison (keeps the deal)"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {ROWS.map((row) => {
                if (row.group) {
                  return (
                    <tr key={row.group} className="bg-well">
                      <th colSpan={items.length + 1} className="eyebrow sticky left-0 px-6 py-2 text-left">
                        {row.group}
                      </th>
                    </tr>
                  );
                }
                const best = bestIndexes(row, items);
                return (
                  <tr key={row.label} className="border-t border-hairline">
                    <th scope="row" className={`px-6 py-2.5 text-left font-normal text-zinc-600 dark:text-zinc-300 ${stickyCell}`}>
                      <span className="inline-flex items-center gap-1">
                        {row.label}
                        {row.tip && <InfoTip k={row.tip} />}
                      </span>
                    </th>
                    {items.map((x, i) => {
                      const v = row.get(x);
                      const isBest = best.has(i);
                      return (
                        <td key={x.deal.id} className={`px-4 py-2 text-right ${isBest ? 'bg-emerald-500/[0.07] dark:bg-emerald-400/10' : ''}`}>
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {isBest && <Trophy className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Best" />}
                            <span className={`${isBest ? 'font-semibold' : ''} ${row.signed ? signedClass(v) : 'text-zinc-900 dark:text-zinc-100'}`}>{row.fmt(v, x)}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="border-t border-hairline">
                <th scope="row" className={`px-6 py-3 text-left font-normal text-zinc-600 dark:text-zinc-300 ${stickyCell}`}>
                  Verdict
                </th>
                {items.map((x) => {
                  const v = verdict(x.a);
                  return (
                    <td key={x.deal.id} className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${TONE_CLASSES[v.tone]}`}>
                        {v.key === 'trap' && <AlertTriangle className="size-3" aria-hidden />}
                        {v.label}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card delay={200}>
        <CardHeader
          icon={TrendingUp}
          title="Profit if you sell, by year"
          subtitle="Cash flow + sale price − selling costs − loan payoff − cash invested. Where a line crosses $0 is the earliest year a sale breaks even."
        />
        <div className="p-6">
          <CompareChart items={items} dark={dark} />
        </div>
      </Card>
    </div>
  );
}
