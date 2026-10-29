import { AlertTriangle } from 'lucide-react';
import { refiMeaning } from '../lib/explain.js';
import { money, percent, ratio } from '../lib/format.js';
import { DscrChip, Figure, LedgerLine, Stat, signedClass } from './ui.jsx';
import { Num } from './motion.jsx';
import { Section } from './Section.jsx';

/** The planned cash-out refinance: what it pays off, what it hands back, and the deal on the new loan. */
export default function RefiCard({ refi, a, deal }) {
  const yrs = `${refi.year} ${refi.year === 1 ? 'year' : 'years'}`;
  const lenderNo = refi.dscr < 1;
  return (
    <Section
      id="sec-refi"
      title={`Cash-out refinance after ${yrs}`}
      value={refi.cashOut >= 0 ? `${money(refi.cashOut)} out` : `${money(-refi.cashOut)} in`}
      valueClass={signedClass(refi.cashOut)}
      meaning={refiMeaning(refi, a)}
      subtitle={`${Number(deal.refiLtv)}% of the value at that point, at ${Number(deal.refiRate)}% over ${deal.refiTermYears} years.`}
    >
      <div className="grid gap-8 p-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="text-sm">
          <LedgerLine label={`Value after ${yrs}`} value={money(refi.value)} />
          <LedgerLine label={`New loan (${Number(deal.refiLtv)}% LTV)`} value={money(refi.newLoan)} />
          <LedgerLine label="Pay off the original loan" value={money(-refi.oldBalance)} />
          {refi.penalty > 0 && <LedgerLine label="Prepayment penalty" tip="prepay" value={money(-refi.penalty)} />}
          <LedgerLine label={`Refinance costs (${Number(deal.refiCostPct)}%)`} value={money(-refi.costs)} />
          <LedgerLine
            label={refi.cashOut >= 0 ? 'Cash out to you' : 'Cash you’d need to bring'}
            value={<Num value={Math.abs(refi.cashOut)} format={(v) => money(v)} />}
            valueClass={`text-2xl tracking-tight ${signedClass(refi.cashOut)}`}
            total
          />
        </div>

        <div className="grid content-start gap-4">
          <Figure label="Cash left in the deal" tip="cashLeft" value={refi.allCashBack ? 'All back' : <Num value={refi.cashLeft} format={(v) => money(v)} />}>
            {refi.allCashBack
              ? `You recover all ${money(a.cashInvested)} you put in, plus ${money(-refi.cashLeft)}, and still own the property with ${money(refi.equityAfter)} of equity.`
              : `Of the ${money(a.cashInvested)} you put in, ${money(Math.max(refi.cashOut, 0))} comes back. Equity after the refinance: ${money(refi.equityAfter)}.`}
          </Figure>

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
            <p className="flex gap-2 rounded-md bg-amber-400/10 p-3.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-500/25 ring-inset dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {lenderNo
                ? `A DSCR lender is unlikely to approve this refinance: the new loan's DSCR is ${ratio(refi.dscr)}. Try a lower LTV.`
                : `The bigger loan turns cash flow negative (${money(refi.netCashFlow, { signed: true })}/mo). A lower LTV keeps it positive.`}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
