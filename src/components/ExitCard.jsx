import { DoorOpen } from 'lucide-react';
import { money, percent } from '../lib/format.js';
import { Card, CardHeader, Stat, signedClass } from './ui.jsx';
import { InfoTip, Num } from './motion.jsx';

function Step({ label, value, op, strong, tip }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${strong ? 'mt-1 border-t border-hairline pt-2.5 font-semibold text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
      <span className="flex items-center gap-1">
        {op && <span className="tabular w-3 text-zinc-500 dark:text-zinc-400">{op}</span>}
        {label}
        {tip && <InfoTip k={tip} />}
      </span>
      <span className="tabular">{value}</span>
    </div>
  );
}

/** What you'd actually walk away with if you sold at the end of the projection. */
export default function ExitCard({ sale, deal }) {
  const multiple = Number.isFinite(sale.equityMultiple) ? `${sale.equityMultiple.toFixed(2)}×` : '—';
  return (
    <Card id="sec-exit" delay={220} className="@container overflow-hidden">
      <CardHeader icon={DoorOpen} title={`If you sell in year ${sale.year}`} subtitle={`After ${Number(deal.sellingCostPct) || 0}% selling costs${sale.prepayPenalty > 0 ? ', the prepayment penalty' : ''} and paying off the loan.`} />
      <div className="grid gap-8 p-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <Step label="Sale price" value={money(sale.salePrice)} />
          <Step op="−" label="Selling costs" value={money(sale.sellingCosts)} />
          <Step op="−" label="Loan payoff" value={money(sale.loanPayoff)} />
          {sale.prepayPenalty > 0 && <Step op="−" label="Prepayment penalty" tip="prepay" value={money(sale.prepayPenalty)} />}
          <Step label="Net sale proceeds" value={money(sale.netProceeds)} strong />
          <div className="h-3" />
          <Step op="+" label={`${sale.year} years of cash flow`} value={money(sale.totalCashFlow, { signed: true })} />
          {sale.cashOut !== 0 && <Step op="+" label="Cash from the refinance" tip="refinance" value={money(sale.cashOut, { signed: true })} />}
          <Step op="−" label="Cash invested" tip="cashInvested" value={money(sale.cashInvested)} />
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
            <span className="flex items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-white">
              Profit
              <InfoTip k="profitIfSold" />
            </span>
            <span className={`tabular text-2xl font-semibold tracking-tight ${signedClass(sale.profit)}`}>
              <Num value={sale.profit} format={(v) => money(v, { signed: true })} />
            </span>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/5 to-transparent p-6 ring-1 ring-emerald-600/15 ring-inset dark:from-emerald-400/15 dark:ring-emerald-300/15">
            <div className="eyebrow flex items-center gap-1">
              Internal rate of return
              <InfoTip k="irr" />
            </div>
            <div className={`mt-2 text-5xl font-semibold tracking-tight ${Number.isFinite(sale.irr) ? signedClass(sale.irr) : 'text-zinc-500 dark:text-zinc-400'}`}>
              {Number.isFinite(sale.irr) ? <Num value={sale.irr} format={(v) => percent(v, 1)} /> : '—'}
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Annual return on {money(sale.cashInvested)}, counting when each dollar of cash flow and sale proceeds arrives.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 px-1">
            <Stat label="Equity multiple" tip="equityMultiple" value={multiple} sub="cash back ÷ cash in" />
            <Stat label="Cash back" value={money(sale.totalCashFlow + sale.cashOut + sale.netProceeds)} sub={sale.cashOut ? 'cash flow + refinance + sale' : 'cash flow + proceeds'} />
          </div>
        </div>
      </div>
    </Card>
  );
}
