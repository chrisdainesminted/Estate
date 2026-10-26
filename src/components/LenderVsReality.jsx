import { Scale } from 'lucide-react';
import { money, percent, ratio } from '../lib/format.js';
import { Card, CardHeader, DscrChip, Stat, signedClass } from './ui.jsx';

function Line({ label, value, strong, muted, indent }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 text-sm ${indent ? 'pl-3' : ''} ${
        strong ? 'border-t border-hairline pt-2 font-semibold text-zinc-900 dark:text-zinc-100' : ''
      } ${muted ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}
    >
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

/** Thin proportional bar showing how much of gross rent each outflow eats. */
function WaterfallRow({ label, amount, rent, kind }) {
  const width = rent > 0 ? Math.min(Math.abs(amount) / rent, 1) * 100 : 0;
  const bar = { income: 'bg-zinc-400 dark:bg-zinc-500', debt: 'bg-zinc-800 dark:bg-zinc-200', opex: 'bg-amber-500 dark:bg-amber-400' }[kind];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1">
      <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="tabular text-right text-sm text-zinc-700 dark:text-zinc-300">
        {kind === 'income' ? money(amount) : `−${money(amount)}`}
      </span>
      <div className="col-span-2 h-1.5 rounded-full bg-well">
        <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function LenderVsReality({ a }) {
  const haircut = a.grossRent - a.lenderRent;
  return (
    <Card delay={140} className="@container">
      <CardHeader icon={Scale} title="Lender math vs. real-world math" subtitle="Lenders approve on PITIA. Your bank account also pays for OpEx." />
      <div className="grid gap-6 p-5 @2xl:grid-cols-2">
        <div>
          <h3 className="mb-2 eyebrow">What the lender sees</h3>
          <Line label="Gross monthly rent" value={money(a.grossRent)} />
          {haircut > 0 && <Line label="Lender rent haircut" value={`−${money(haircut)}`} muted indent />}
          <div className="mt-2" />
          <Line label={a.interestOnly ? `Interest only (first ${a.ioYears} yrs)` : 'Principal & interest'} value={money(a.pi, { cents: true })} indent />
          <Line label="Property taxes" value={money(a.taxes, { cents: true })} indent />
          <Line label="Insurance" value={money(a.insurance, { cents: true })} indent />
          <Line label="HOA" value={money(a.hoa, { cents: true })} indent />
          <Line label="PITIA" value={money(a.pitia, { cents: true })} strong />
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-well px-3 py-2.5 ">
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              DSCR = {money(a.lenderRent)} ÷ {money(a.pitia)}
            </span>
            <DscrChip status={a.status} dscr={a.dscr} size="sm" />
          </div>
        </div>

        <div>
          <h3 className="mb-2 eyebrow">What actually hits your account</h3>
          <WaterfallRow label="Gross monthly rent" amount={a.grossRent} rent={a.grossRent} kind="income" />
          <WaterfallRow label="PITIA" amount={a.pitia} rent={a.grossRent} kind="debt" />
          <WaterfallRow label="Property management" amount={a.opex.management} rent={a.grossRent} kind="opex" />
          <WaterfallRow label="Maintenance & repairs" amount={a.opex.maintenance} rent={a.grossRent} kind="opex" />
          <WaterfallRow label="Vacancy reserve" amount={a.opex.vacancy} rent={a.grossRent} kind="opex" />
          <WaterfallRow label="CapEx reserve" amount={a.opex.capex} rent={a.grossRent} kind="opex" />
          <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Real net cash flow</span>
            <span className={`tabular text-lg font-semibold ${signedClass(a.netCashFlow)}`}>{money(a.netCashFlow, { signed: true, cents: true })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-hairline px-5 py-4 @lg:grid-cols-3 @4xl:grid-cols-5">
        <Stat label="Year-1 paydown" tip="paydown" value={money(a.year1Principal)} sub={a.interestOnly ? 'none while interest-only' : 'principal paid by tenants'} />
        <Stat label="Year-1 total return" value={money(a.year1TotalReturn, { signed: true })} sub="cash flow + paydown" />
        <Stat label="Cap rate" tip="capRate" value={percent(a.capRate)} sub="NOI ÷ price" />
        <Stat label="Breakeven rent" tip="breakevenRent" value={`${money(a.breakevenRent / a.units)}/unit`} sub="net cash flow = $0" />
        <Stat label="Rent for 1.20 DSCR" tip="rentFor120" value={`${money(a.rentForDscr120 / a.units)}/unit`} sub={`current ${ratio(a.dscr)}`} />
      </div>
    </Card>
  );
}
