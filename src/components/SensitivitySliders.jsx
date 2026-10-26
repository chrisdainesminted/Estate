import { Check, FlaskConical, RotateCcw } from 'lucide-react';
import { money, percent, ratio } from '../lib/format.js';
import { isNeutralAdjustment } from '../lib/finance.js';
import { Button, Card, CardHeader, Segmented, signedClass } from './ui.jsx';

function Slider({ id, label, min, max, step, value, onChange, display, note, ticks, origin = min }) {
  // Fill the track between the origin (0 for deltas, min otherwise) and the thumb.
  const pos = (v) => ((v - min) / (max - min)) * 100;
  const lo = Math.min(pos(origin), pos(value));
  const hi = Math.max(pos(origin), pos(value));
  const rangeBg = `linear-gradient(to right, var(--track) ${lo}%, var(--accent) ${lo}%, var(--accent) ${hi}%, var(--track) ${hi}%)`;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
        <span className="tabular rounded-lg bg-well px-2 py-0.5 text-sm font-semibold text-zinc-900 dark:text-white">{display}</span>
      </div>
      <input id={id} type="range" className="range" style={{ '--range-bg': rangeBg }} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {/* Ticks sit under the thumb's actual position (the 20px thumb travels 10px in from each end). */}
      <div className="tabular relative mt-0.5 h-4 text-[11px] text-zinc-400 dark:text-zinc-500">
        {ticks.map(([v, text]) => (
          <span key={text} className="absolute -translate-x-1/2" style={{ left: `calc(10px + (100% - 20px) * ${pos(v) / 100})` }}>
            {text}
          </span>
        ))}
      </div>
      {note && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

function deltaText(d, fmt) {
  if (Math.abs(d) < 1e-9) return '—';
  return fmt(d);
}

export default function SensitivitySliders({ deal, adj, setAdj, scope, setScope, base, what, onApply, compareCount }) {
  const all = scope === 'compare' && compareCount > 1;
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
      label: 'Cash invested',
      b: money(base.cashInvested),
      w: money(what.cashInvested),
      d: deltaText(what.cashInvested - base.cashInvested, (v) => money(v, { signed: true })),
      // More cash out of pocket is a cost, not a gain.
      raw: -(what.cashInvested - base.cashInvested),
    },
  ];

  return (
    <Card delay={100} className="@container h-full">
      <CardHeader
        icon={FlaskConical}
        title="What-if sensitivity"
        subtitle="Stress-test the deal without changing its saved inputs."
        actions={
          <>
            {compareCount > 1 && (
              <Segmented
                size="sm"
                label="Apply what-if to"
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'active', label: 'This deal' },
                  { value: 'compare', label: `All ${compareCount} compared` },
                ]}
              />
            )}
            <Button variant="ghost" onClick={() => setAdj({ rateDelta: 0, downPct: null, rentPct: 0 })} disabled={neutral}>
              <RotateCcw className="size-3.5" aria-hidden /> Reset
            </Button>
            <Button variant="primary" onClick={onApply} disabled={neutral}>
              <Check className="size-3.5" aria-hidden /> Apply to {all ? `${compareCount} deals` : 'deal'}
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
            ticks={[[-2, '−2%'], [0, '0'], [2, '+2%']]}
            origin={0}
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
            ticks={[[15, '15%'], [25, '25%'], [35, '35%']]}
            note={adj.downPct != null && all ? 'Sets every compared deal to this down payment.' : undefined}
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
            ticks={[[-15, '−15%'], [0, '0'], [25, '+25%']]}
            origin={0}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="mb-2 text-left eyebrow">
              Impact on {deal.name}
            </caption>
            <thead>
              <tr className="eyebrow">
                <th className="py-1.5 text-left font-medium">Metric</th>
                <th className="py-1.5 text-right font-medium">Base</th>
                <th className="py-1.5 text-right font-medium">What-if</th>
                <th className="py-1.5 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-hairline">
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">{r.label}</td>
                  <td className="py-2 text-right text-zinc-500 dark:text-zinc-400">{r.b}</td>
                  <td className="py-2 text-right font-semibold text-zinc-900 dark:text-zinc-100">{r.w}</td>
                  <td className={`py-2 text-right font-medium ${r.d === '—' ? 'text-zinc-400' : signedClass(r.raw)}`}>{r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {what.status.key !== base.status.key && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
              DSCR band moves from <strong>{base.status.label}</strong> to <strong>{what.status.label}</strong>.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
