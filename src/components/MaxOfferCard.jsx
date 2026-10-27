import { useMemo } from 'react';
import { ArrowDownToLine, Target } from 'lucide-react';
import { maxOffer } from '../lib/finance.js';
import { money, percent } from '../lib/format.js';
import { Button, Card, CardHeader, NumberField } from './ui.jsx';
import { InfoTip, Num } from './motion.jsx';

function TargetRow({ id, on, onToggle, children }) {
  return (
    <div className={`flex items-end gap-3 rounded-2xl p-3 transition ${on ? 'bg-well' : 'opacity-60'}`}>
      <label htmlFor={`${id}-on`} className="flex shrink-0 cursor-pointer items-center pb-2.5">
        <input id={`${id}-on`} type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="size-4 accent-emerald-600" />
        <span className="sr-only">Use this target</span>
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** The most you can pay for this deal and still hit every target you care about. */
export default function MaxOfferCard({ deal, targets, onTargets, onUsePrice }) {
  const m = useMemo(() => maxOffer(deal, targets), [deal, targets]);
  const asking = Number(deal.price) || 0;
  const finite = m.price != null && Number.isFinite(m.price);
  const rounded = finite ? Math.floor(m.price / 500) * 500 : null;
  const room = finite ? m.price - asking : null;
  const sorted = [...m.limits].sort((p, q) => p.price - q.price);
  const maxBar = Math.max(...m.limits.filter((l) => Number.isFinite(l.price)).map((l) => l.price), asking, 1);

  return (
    <Card id="sec-offer" delay={120} className="@container">
      <CardHeader
        icon={Target}
        title="Max offer price"
        subtitle="The most you can pay and still hit your targets. Rent, taxes, insurance and rehab stay as entered."
      />
      <div className="grid gap-6 p-6 @3xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-2">
          <span className="eyebrow mb-1">Your targets</span>
          <TargetRow id={`${deal.id}-t-dscr`} on={targets.useDscr} onToggle={(v) => onTargets({ useDscr: v })}>
            <NumberField id={`${deal.id}-t-dscr`} label="Lender DSCR at least" tip="dscr" value={targets.dscr} onChange={(v) => onTargets({ dscr: v })} max={5} step={0.05} decimals={2} />
          </TargetRow>
          <TargetRow id={`${deal.id}-t-cf`} on={targets.useCashFlow} onToggle={(v) => onTargets({ useCashFlow: v })}>
            <NumberField
              id={`${deal.id}-t-cf`}
              label="Cash flow per door at least"
              tip="netCashFlow"
              prefix="$"
              suffix="/mo"
              value={targets.cashFlowPerDoor}
              onChange={(v) => onTargets({ cashFlowPerDoor: v })}
              min={-5000}
              step={25}
              decimals={0}
            />
          </TargetRow>
          <TargetRow id={`${deal.id}-t-coc`} on={targets.useCoc} onToggle={(v) => onTargets({ useCoc: v })}>
            <NumberField id={`${deal.id}-t-coc`} label="Cash-on-cash at least" tip="coc" suffix="%" value={targets.coc} onChange={(v) => onTargets({ coc: v })} max={100} step={0.5} decimals={2} />
          </TargetRow>
        </div>

        <div className="flex flex-col">
          {m.price == null ? (
            <p className="rounded-2xl bg-well p-5 text-sm text-zinc-600 dark:text-zinc-400">Turn on at least one target to see your max offer.</p>
          ) : !m.feasible ? (
            <div className="rounded-2xl bg-red-500/[0.07] p-5 ring-1 ring-red-500/20 ring-inset">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">No price works at these targets.</p>
              <p className="mt-1 text-sm text-red-800/80 dark:text-red-100/80">
                Rent of {money((Number(deal.rentPerUnit) || 0) * (Number(deal.units) || 1))}/mo doesn’t cover taxes, insurance and operating costs with room for
                your targets. Loosen a target or check the rent.
              </p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/5 to-transparent p-6 ring-1 ring-emerald-600/15 ring-inset dark:from-emerald-400/15 dark:ring-emerald-300/15">
              <div className="eyebrow">Offer up to</div>
              <div className="mt-1.5 text-5xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {Number.isFinite(m.price) ? <Num value={m.price} format={(v) => money(v)} /> : 'No limit'}
              </div>
              {Number.isFinite(m.price) && (
                <p className={`tabular mt-2 text-sm font-medium ${room >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {room >= 0
                    ? `Asking works, with ${money(room)} of room`
                    : `${money(-room)} under asking (${percent(room / asking, 1)})`}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Set by your {sorted[0].label} target.
              </p>
              {Number.isFinite(m.price) && Math.abs(rounded - asking) >= 500 && (
                <Button variant="primary" className="mt-4" onClick={() => onUsePrice(rounded)}>
                  <ArrowDownToLine className="size-4" aria-hidden /> Use {money(rounded)} as the price
                </Button>
              )}
            </div>
          )}

          {m.price != null && m.feasible && (
            <div className="mt-5 grid gap-3">
              <span className="eyebrow flex items-center gap-1">
                Ceiling by target
                <InfoTip k="maxOffer" />
              </span>
              {sorted.map((l, i) => (
                <div key={l.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={i === 0 ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}>{l.label}</span>
                    <span className="tabular font-medium text-zinc-900 dark:text-white">{Number.isFinite(l.price) ? money(l.price) : 'No limit'}</span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-well">
                    <div
                      className={`h-1.5 rounded-full ${i === 0 ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-zinc-400/60 dark:bg-zinc-500'}`}
                      style={{ width: `${Number.isFinite(l.price) ? Math.min(l.price / maxBar, 1) * 100 : 100}%` }}
                    />
                    {/* Tick where the asking price sits. */}
                    <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-zinc-900 dark:bg-white" style={{ left: `${Math.min(asking / maxBar, 1) * 100}%` }} aria-hidden />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">The dark tick marks the asking price, {money(asking)}.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
