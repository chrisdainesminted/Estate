import { Check, FlaskConical, RotateCcw } from 'lucide-react';
import { money, percent, ratio } from '../lib/format.js';
import { isNeutralAdjustment } from '../lib/finance.js';
import { Button, Card, CardHeader, Segmented, signedClass } from './ui.jsx';

function Slider({ id, label, min, max, step, value, onChange, display, note, ticks }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span className="tabular text-sm font-semibold text-slate-900 dark:text-slate-100">{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="tabular mt-0.5 flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      {note && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
  );
}

function deltaText(d, fmt) {
  if (Math.abs(d) < 1e-9) return '—';
  return fmt(d);
}

export default function SensitivitySliders({ deal, adj, setAdj, scope, setScope, base, what, onApply, dealCount }) {
  const neutral = isNeutralAdjustment(adj);
  const sign = (v, s) => (v > 0 ? `+${s}` : v < 0 ? `−${s.replace('-', '')}` : s);
  const downValue = adj.downPct ?? Math.min(Math.max(Number(deal.downPct) || 0, 15), 35);
  const newRate = Math.max((Number(deal.rate) || 0) + adj.rateDelta, 0);

  const rows = [
    { label: 'Lender DSCR', b: ratio(base.dscr), w: ratio(what.dscr), d: deltaText(what.dscr - base.dscr, (v) => sign(v, Math.abs(v).toFixed(2))), raw: what.dscr - base.dscr },
    {
      label: 'Net cash flow /mo',
      b: money(base.netCashFlow, { signed: true }),
      w: money(what.netCashFlow, { signed: true }),
      d: deltaText(what.netCashFlow - base.netCashFlow, (v) => money(v, { signed: true })),
      raw: what.netCashFlow - base.netCashFlow,
    },
    {
      label: 'Cash-on-cash',
      b: percent(base.coc),
      w: percent(what.coc),
      d: deltaText(what.coc - base.coc, (v) => `${percent(v, 2, { signed: true })}`),
      raw: what.coc - base.coc,
    },
    {
      label: 'Cash to close',
      b: money(base.cashToClose),
      w: money(what.cashToClose),
      d: deltaText(what.cashToClose - base.cashToClose, (v) => money(v, { signed: true })),
      // More cash out of pocket is a cost, not a gain.
      raw: -(what.cashToClose - base.cashToClose),
    },
  ];

  return (
    <Card className="@container h-full">
      <CardHeader
        icon={FlaskConical}
        title="What-if sensitivity"
        subtitle="Stress-test the deal without changing its saved inputs."
        actions={
          <>
            {dealCount > 1 && (
              <Segmented
                size="sm"
                label="Apply what-if to"
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'active', label: 'This deal' },
                  { value: 'all', label: 'All deals' },
                ]}
              />
            )}
            <Button variant="ghost" onClick={() => setAdj({ rateDelta: 0, downPct: null, rentPct: 0 })} disabled={neutral}>
              <RotateCcw className="size-3.5" aria-hidden /> Reset
            </Button>
            <Button variant="primary" onClick={onApply} disabled={neutral}>
              <Check className="size-3.5" aria-hidden /> Apply to {scope === 'all' && dealCount > 1 ? 'all deals' : 'deal'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 p-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Slider
            id="what-if-rate"
            label="Interest rate"
            min={-2}
            max={2}
            step={0.125}
            value={adj.rateDelta}
            onChange={(v) => setAdj({ ...adj, rateDelta: v })}
            display={`${newRate.toFixed(3).replace(/0$/, '')}% (${adj.rateDelta >= 0 ? '+' : '−'}${Math.abs(adj.rateDelta).toFixed(3).replace(/0$/, '')})`}
            ticks={['−2%', '0', '+2%']}
          />
          <Slider
            id="what-if-down"
            label="Down payment"
            min={15}
            max={35}
            step={1}
            value={downValue}
            onChange={(v) => setAdj({ ...adj, downPct: v })}
            display={`${downValue}%${adj.downPct == null ? ' (deal value)' : ''}`}
            ticks={['15%', '25%', '35%']}
            note={adj.downPct != null && scope === 'all' && dealCount > 1 ? 'Sets every deal to this down payment.' : undefined}
          />
          <Slider
            id="what-if-rent"
            label="Gross rent"
            min={-15}
            max={25}
            step={1}
            value={adj.rentPct}
            onChange={(v) => setAdj({ ...adj, rentPct: v })}
            display={`${adj.rentPct > 0 ? '+' : adj.rentPct < 0 ? '−' : ''}${Math.abs(adj.rentPct)}% · ${money(what.grossRent)}/mo`}
            ticks={['−15%', '0', '+25%']}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="mb-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Impact on {deal.name}
            </caption>
            <thead>
              <tr className="text-[11px] tracking-wide text-slate-500 uppercase dark:text-slate-400">
                <th className="py-1.5 text-left font-medium">Metric</th>
                <th className="py-1.5 text-right font-medium">Base</th>
                <th className="py-1.5 text-right font-medium">What-if</th>
                <th className="py-1.5 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 text-slate-700 dark:text-slate-300">{r.label}</td>
                  <td className="py-2 text-right text-slate-500 dark:text-slate-400">{r.b}</td>
                  <td className="py-2 text-right font-semibold text-slate-900 dark:text-slate-100">{r.w}</td>
                  <td className={`py-2 text-right font-medium ${r.d === '—' ? 'text-slate-400' : signedClass(r.raw)}`}>{r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {what.status.key !== base.status.key && (
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              DSCR band moves from <strong>{base.status.label}</strong> to <strong>{what.status.label}</strong>.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
