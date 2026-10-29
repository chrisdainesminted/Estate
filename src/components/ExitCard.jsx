import { saleMeaning } from '../lib/explain.js';
import { money, percent } from '../lib/format.js';
import { Figure, LedgerLine, Stat, signedClass } from './ui.jsx';
import { Num } from './motion.jsx';
import { Section } from './Section.jsx';

/** What you'd actually walk away with if you sold at the end of the projection. */
export default function ExitCard({ sale, deal }) {
  const multiple = Number.isFinite(sale.equityMultiple) ? `${sale.equityMultiple.toFixed(2)}×` : '—';
  return (
    <Section
      id="sec-exit"
      title={`If you sell in year ${sale.year}`}
      value={money(sale.profit, { signed: true })}
      valueClass={signedClass(sale.profit)}
      meaning={saleMeaning(sale)}
      subtitle={`After ${Number(deal.sellingCostPct) || 0}% selling costs${sale.prepayPenalty > 0 ? ', the prepayment penalty' : ''} and paying off the loan.`}
    >
      <div className="grid gap-8 p-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="text-sm">
          <LedgerLine label="Sale price" value={money(sale.salePrice)} />
          <LedgerLine label="Selling costs" value={money(-sale.sellingCosts)} />
          <LedgerLine label="Loan payoff" value={money(-sale.loanPayoff)} />
          {sale.prepayPenalty > 0 && <LedgerLine label="Prepayment penalty" tip="prepay" value={money(-sale.prepayPenalty)} />}
          <LedgerLine label="Net sale proceeds" value={money(sale.netProceeds)} sum />
          <div className="h-4" />
          <LedgerLine label={`${sale.year} years of cash flow`} value={money(sale.totalCashFlow, { signed: true })} />
          {sale.cashOut !== 0 && <LedgerLine label="Cash from the refinance" tip="refinance" value={money(sale.cashOut, { signed: true })} />}
          <LedgerLine label="Cash invested" tip="cashInvested" value={money(-sale.cashInvested)} />
          <LedgerLine
            label="Profit"
            tip="profitIfSold"
            value={<Num value={sale.profit} format={(v) => money(v, { signed: true })} />}
            valueClass={`text-2xl tracking-tight ${signedClass(sale.profit)}`}
            total
          />
        </div>

        <div className="grid content-start gap-4">
          <Figure
            label="Internal rate of return"
            tip="irr"
            value={Number.isFinite(sale.irr) ? <Num value={sale.irr} format={(v) => percent(v, 1)} /> : '—'}
            valueClass={Number.isFinite(sale.irr) ? signedClass(sale.irr) : 'text-zinc-500 dark:text-zinc-400'}
          >
            Annual return on {money(sale.cashInvested)}, counting when each dollar of cash flow and sale proceeds arrives.
          </Figure>
          <div className="grid grid-cols-2 gap-4 px-1">
            <Stat label="Equity multiple" tip="equityMultiple" value={multiple} sub="cash back ÷ cash in" />
            <Stat label="Cash back" value={money(sale.totalCashFlow + sale.cashOut + sale.netProceeds)} sub={sale.cashOut ? 'cash flow + refinance + sale' : 'cash flow + proceeds'} />
          </div>
        </div>
      </div>
    </Section>
  );
}
