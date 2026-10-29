import { DSCR_BANDS } from '../lib/dscr.js';
import { BAND_MEANINGS, rentFlowMeaning } from '../lib/explain.js';
import { money, percent, ratio } from '../lib/format.js';
import { DscrChip, LedgerHeading, LedgerLine, Stat, signedClass } from './ui.jsx';
import { Section } from './Section.jsx';

export default function LenderVsReality({ a }) {
  const haircut = a.grossRent - a.lenderRent;
  return (
    <Section
      id="sec-lender"
      title="Where the rent goes"
      value={`${money(a.netCashFlow, { signed: true })}/mo`}
      valueClass={signedClass(a.netCashFlow)}
      meaning={rentFlowMeaning(a)}
      subtitle="Lenders approve on the loan payment, taxes and insurance (PITIA). Your bank account also pays the running costs."
    >
      <div className="grid gap-8 p-5 @2xl:grid-cols-2">
        <div className="text-sm">
          <LedgerHeading>What the lender sees</LedgerHeading>
          <LedgerLine label="Gross monthly rent" value={money(a.grossRent)} />
          {haircut > 0 && <LedgerLine label="Lender rent haircut" value={money(-haircut)} muted />}
          <div className="mt-2" />
          <LedgerLine label={a.interestOnly ? `Interest only (first ${a.ioYears} yrs)` : 'Principal & interest'} value={money(a.pi, { cents: true })} />
          <LedgerLine label="Property taxes" value={money(a.taxes, { cents: true })} />
          <LedgerLine label="Insurance" value={money(a.insurance, { cents: true })} />
          <LedgerLine label="HOA" value={money(a.hoa, { cents: true })} />
          <LedgerLine label="PITIA" value={money(a.pitia, { cents: true })} sum />
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-well px-3 py-2.5">
            <span className="tabular text-zinc-600 dark:text-zinc-300">
              DSCR = {money(a.lenderRent)} ÷ {money(a.pitia)}
            </span>
            <DscrChip status={a.status} dscr={a.dscr} size="sm" />
          </div>
          <dl className="mt-3 grid gap-0.5 text-xs" aria-label="How lenders read DSCR">
            {DSCR_BANDS.map((b) => (
              <div
                key={b.key}
                className={`grid grid-cols-[auto_5.5rem_minmax(0,1fr)] items-baseline gap-2 rounded-[3px] px-2 py-1 ${
                  b.key === a.status.key ? 'bg-well text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <span className="size-2 translate-y-[-1px] rounded-[2px]" style={{ background: b.color }} aria-hidden />
                <dt className="tabular">{b.short}</dt>
                <dd>
                  <span className="font-medium">{b.label}.</span> {BAND_MEANINGS[b.key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="text-sm">
          <LedgerHeading>What actually hits your account</LedgerHeading>
          <LedgerLine label="Gross monthly rent" value={money(a.grossRent)} />
          <LedgerLine label="PITIA" value={money(-a.pitia)} />
          <LedgerLine label="Property management" value={money(-a.opex.management)} />
          <LedgerLine label="Maintenance & repairs" value={money(-a.opex.maintenance)} />
          <LedgerLine label="Vacancy reserve" value={money(-a.opex.vacancy)} />
          <LedgerLine label="CapEx reserve" value={money(-a.opex.capex)} />
          <LedgerLine
            label="Real net cash flow"
            value={money(a.netCashFlow, { signed: true, cents: true })}
            valueClass={`text-lg ${signedClass(a.netCashFlow)}`}
            total
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-hairline px-5 py-4 @lg:grid-cols-3 @4xl:grid-cols-5">
        <Stat label="Year-1 paydown" tip="paydown" value={money(a.year1Principal)} sub={a.interestOnly ? 'none while interest-only' : 'principal paid by tenants'} />
        <Stat label="Year-1 total return" value={money(a.year1TotalReturn, { signed: true })} sub="cash flow + paydown" />
        <Stat label="Cap rate" tip="capRate" value={percent(a.capRate)} sub="NOI ÷ price" />
        <Stat label="Breakeven rent" tip="breakevenRent" value={`${money(a.breakevenRent / a.units)}/unit`} sub="net cash flow = $0" />
        <Stat label="Rent for 1.20 DSCR" tip="rentFor120" value={`${money(a.rentForDscr120 / a.units)}/unit`} sub={`current ${ratio(a.dscr)}`} />
      </div>
    </Section>
  );
}
