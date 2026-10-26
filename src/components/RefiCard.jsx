import { AlertTriangle, Repeat } from 'lucide-react';
import { money, percent, ratio } from '../lib/format.js';
import { Card, CardHeader, DscrChip, Stat, signedClass } from './ui.jsx';
import { InfoTip, Num } from './motion.jsx';

function Step({ label, value, op, strong, tip }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${strong ? 'mt-1 border-t border-hairline pt-2.5 font-semibold text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
      <span className="flex items-center gap-1">
        {op && <span className="tabular w-3 text-zinc-400">{op}</span>}
        {label}
        {tip && <InfoTip k={tip} />}
      </span>
      <span className="tabular">{value}</span>
    </div>
  );
}

/** The planned cash-out refinance: what it pays off, what it hands back, and the deal on the new loan. */
export default function RefiCard({ refi, a, deal }) {
  const yrs = `${refi.year} ${refi.year === 1 ? 'year' : 'years'}`;
  const lenderNo = refi.dscr < 1;
  return (
    <Card delay={200} className="@container overflow-hidden">
      <CardHeader icon={Repeat} title={`Cash-out refinance after ${yrs}`} subtitle={`${Number(deal.refiLtv)}% of the value at that point, at ${Number(deal.refiRate)}% over ${deal.refiTermYears} years.`} />
      <div className="grid gap-8 p-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <Step label={`Value after ${yrs}`} value={money(refi.value)} />
          <Step label={`New loan (${Number(deal.refiLtv)}% LTV)`} value={money(refi.newLoan)} />
          <Step op="−" label="Pay off the original loan" value={money(refi.oldBalance)} />
          {refi.penalty > 0 && <Step op="−" label="Prepayment penalty" tip="prepay" value={money(refi.penalty)} />}
          <Step op="−" label={`Refinance costs (${Number(deal.refiCostPct)}%)`} value={money(refi.costs)} />
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">{refi.cashOut >= 0 ? 'Cash out to you' : 'Cash you’d need to bring'}</span>
            <span className={`tabular text-2xl font-semibold tracking-tight ${signedClass(refi.cashOut)}`}>
              <Num value={Math.abs(refi.cashOut)} format={(v) => money(v)} />
            </span>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/5 to-transparent p-6 ring-1 ring-emerald-600/15 ring-inset dark:from-emerald-400/15 dark:ring-emerald-300/15">
            <div className="eyebrow flex items-center gap-1">
              Cash left in the deal
              <InfoTip k="cashLeft" />
            </div>
            <div className="mt-2 text-5xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              {refi.allCashBack ? 'All back' : <Num value={refi.cashLeft} format={(v) => money(v)} />}
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              {refi.allCashBack
                ? `You recover all ${money(a.cashInvested)} you put in, plus ${money(-refi.cashLeft)}, and still own the property with ${money(refi.equityAfter)} of equity.`
                : `Of the ${money(a.cashInvested)} you put in, ${money(Math.max(refi.cashOut, 0))} comes back. Equity after the refinance: ${money(refi.equityAfter)}.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 px-1 @lg:grid-cols-4 @3xl:grid-cols-2 @5xl:grid-cols-4">
            <Stat label="New payment" value={money(refi.payment)} sub={`was ${money(a.pi)}`} />
            <Stat label="Cash flow after" value={<span className={signedClass(refi.netCashFlow)}>{money(refi.netCashFlow, { signed: true })}/mo</span>} sub={`was ${money(a.netCashFlow, { signed: true })}`} />
            <Stat label="DSCR after" tip="dscr" value={ratio(refi.dscr)} sub={<DscrChip status={refi.status} size="sm" />} />
            <Stat
              label="CoC on cash left"
              tip="coc"
              value={Number.isFinite(refi.cocAfter) ? percent(refi.cocAfter, 1) : Number.isNaN(refi.cocAfter) ? '—' : 'Unlimited'}
              sub={Number.isFinite(refi.cocAfter) ? `on ${money(refi.cashLeft)}` : Number.isNaN(refi.cocAfter) ? 'no cash in, but losing money' : 'no cash left in'}
            />
          </div>

          {(lenderNo || refi.netCashFlow < 0) && (
            <p className="flex gap-2 rounded-2xl bg-amber-400/10 p-3.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-500/25 ring-inset dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {lenderNo
                ? `A DSCR lender is unlikely to approve this refinance: the new loan's DSCR is ${ratio(refi.dscr)}. Try a lower LTV.`
                : `The bigger loan turns cash flow negative (${money(refi.netCashFlow, { signed: true })}/mo). A lower LTV keeps it positive.`}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
