import { money, percent, ratio } from '../lib/format.js';
import { DscrChip, LedgerHeading, LedgerLine, signedClass } from './ui.jsx';
import { Num } from './motion.jsx';

/**
 * A deal as two ledgers: what each month brings in and pays out, down to what's
 * left for you, and the cash it takes. `lender` adds the lender's DSCR check;
 * `children` add lines under Your cash. `base` notes the numbers before a what-if.
 * `heading` is the ledgers' heading level, one below the summary's title.
 */
export default function DealLedgers({ deal, a, base, lender = true, heading = 'h3', children }) {
  const ca = deal.country === 'ca';
  const runningShare = a.grossRent > 0 ? a.opex.total / a.grossRent : 0;
  return (
    <div className="grid gap-x-10 gap-y-6 text-sm sm:grid-cols-2">
      <div>
        <LedgerHeading as={heading} aside={a.units > 1 ? `${money(a.netCashFlow / a.units, { signed: true })} a unit` : null}>
          Each month
        </LedgerHeading>
        <LedgerLine label={a.units > 1 ? `Rent, ${a.units} units` : 'Rent'} value={money(a.grossRent)} />
        <LedgerLine label={a.interestOnly ? 'Mortgage payment, interest only' : 'Mortgage payment'} tip="mortgagePayment" value={money(-a.pi)} />
        <LedgerLine label="Property tax" value={money(-a.taxes)} />
        <LedgerLine label="Insurance" value={money(-a.insurance)} />
        {a.hoa > 0 && <LedgerLine label={ca ? 'Condo fees & utilities' : 'HOA fees'} value={money(-a.hoa)} />}
        <LedgerLine label={`Running costs, ${percent(runningShare, 0)} of rent`} tip="opex" value={money(-a.opex.total)} />
        <LedgerLine
          label="Left for you"
          tip="netCashFlow"
          value={<Num value={a.netCashFlow} format={(x) => money(x, { signed: true })} />}
          valueClass={`text-xl ${signedClass(a.netCashFlow)}`}
          total
        />
        {base && <p className="tabular mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">Before the what-if: {money(base.netCashFlow, { signed: true })}</p>}
      </div>
      <div>
        <LedgerHeading as={heading}>Your cash</LedgerHeading>
        <LedgerLine label={`Down payment, ${Number(deal.downPct)}%`} value={money(a.downPayment)} />
        <LedgerLine label={ca ? 'Closing costs and land transfer tax' : 'Closing costs'} tip={ca ? 'landTransferTax' : undefined} value={money(a.closingCosts)} />
        {a.rehab > 0 && <LedgerLine label="Repairs" value={money(a.rehab)} />}
        <LedgerLine label="Cash in" tip="cashInvested" value={<Num value={a.cashInvested} format={(x) => money(x)} />} sum />
        <LedgerLine label="Return on it each year" tip="coc" value={<Num value={a.coc} format={(x) => percent(x, 1)} />} valueClass={signedClass(a.coc)} />
        {lender && (
          <LedgerLine
            label={
              // Phones drop "(DSCR)" so the label stays on one line beside the tag; the tip names it.
              <>
                Lender check<span className="max-sm:hidden"> (DSCR)</span>
              </>
            }
            tip="dscr"
            value={<DscrChip status={a.status} dscr={a.dscr} size="sm" />}
          />
        )}
        {a.reserves > 0 && <LedgerLine label="Also kept in the bank" tip="reserves" value={money(a.reserves)} muted />}
        {children}
        {base && (
          <p className="tabular mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
            Before the what-if: {percent(base.coc, 1)} return{lender ? `, DSCR ${ratio(base.dscr)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
