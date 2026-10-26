import { Building2, ChevronDown, Landmark, Receipt, SlidersHorizontal, Wrench } from 'lucide-react';
import { UNIT_TYPES } from '../lib/presets.js';
import { money, percent } from '../lib/format.js';
import { Card, NumberField } from './ui.jsx';

function Section({ icon: Icon, title, children, collapsible = false, defaultOpen = true }) {
  const heading = (
    <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-300">
      <Icon className="size-4 text-indigo-500 dark:text-indigo-400" aria-hidden />
      {title}
    </span>
  );
  if (collapsible) {
    return (
      <details open={defaultOpen} className="group border-t border-slate-100 px-5 py-4 dark:border-slate-800">
        <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
          {heading}
          <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">{children}</div>
      </details>
    );
  }
  return (
    <div className="border-t border-slate-100 px-5 py-4 first:border-t-0 dark:border-slate-800">
      {heading}
      <div className="mt-3 grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Derived({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="tabular font-semibold text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

export default function InputsPanel({ deal, a, onChange }) {
  const id = (k) => `${deal.id}-${k}`;
  const set = (k) => (v) => onChange({ [k]: v });
  const opexPct = (Number(deal.mgmtPct) || 0) + (Number(deal.maintPct) || 0) + (Number(deal.vacancyPct) || 0) + (Number(deal.capexPct) || 0);

  return (
    <Card>
      <div className="px-5 pt-4 pb-3">
        <label htmlFor={id('name')} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Deal name
        </label>
        <input
          id={id('name')}
          value={deal.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900 ring-1 ring-slate-300 outline-none ring-inset focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700"
        />
      </div>

      <Section icon={Building2} title="Property & income">
        <div className="col-span-2">
          <NumberField id={id('price')} label="Purchase price" prefix="$" value={deal.price} onChange={set('price')} step={5000} decimals={0} />
        </div>
        <div className="col-span-2">
          <label htmlFor={id('unitType')} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Property type
          </label>
          <select
            id={id('unitType')}
            value={deal.unitType}
            onChange={(e) => {
              const t = UNIT_TYPES.find((u) => u.key === e.target.value);
              onChange({ unitType: t.key, units: t.key === 'multiplex' ? Math.max(deal.units, 5) : t.units });
            }}
            className="w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 outline-none ring-inset focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700"
          >
            {UNIT_TYPES.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
                {u.key !== 'multiplex' ? ` · ${u.units} unit${u.units > 1 ? 's' : ''}` : ''}
              </option>
            ))}
          </select>
        </div>
        {deal.unitType === 'multiplex' && (
          <NumberField id={id('units')} label="Unit count" value={deal.units} onChange={(v) => onChange({ units: Math.round(v) })} min={5} max={500} decimals={0} />
        )}
        <div className={deal.unitType === 'multiplex' ? '' : 'col-span-2'}>
          <NumberField id={id('rent')} label="Rent per unit" prefix="$" suffix="/mo" value={deal.rentPerUnit} onChange={set('rentPerUnit')} step={25} decimals={0} />
        </div>
        <div className="col-span-2">
          <Derived label={`Gross monthly rent (${a.units} unit${a.units > 1 ? 's' : ''})`} value={money(a.grossRent)} />
        </div>
      </Section>

      <Section icon={Landmark} title="Financing">
        <NumberField id={id('down')} label="Down payment" suffix="%" value={deal.downPct} onChange={set('downPct')} max={100} step={1} hint={money(a.downPayment)} />
        <NumberField id={id('rate')} label="Interest rate" suffix="%" value={deal.rate} onChange={set('rate')} max={30} step={0.125} decimals={3} />
        <div>
          <label htmlFor={id('term')} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Amortization
          </label>
          <select
            id={id('term')}
            value={deal.termYears}
            onChange={(e) => onChange({ termYears: Number(e.target.value) })}
            className="w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 outline-none ring-inset focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700"
          >
            {[10, 15, 20, 25, 30, 40].map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </select>
        </div>
        <NumberField id={id('closing')} label="Closing costs" suffix="%" value={deal.closingPct} onChange={set('closingPct')} max={15} step={0.5} hint={money(a.closingCosts)} />
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <Derived label="Loan" value={money(a.loanAmount)} />
          <Derived label="LTV" value={percent(a.ltv, 1)} />
        </div>
      </Section>

      <Section icon={Receipt} title="Taxes, insurance & HOA">
        <NumberField id={id('tax')} label="Property taxes" prefix="$" suffix="/yr" value={deal.taxesAnnual} onChange={set('taxesAnnual')} step={100} decimals={0} hint={`${money(a.taxes)}/mo`} />
        <NumberField id={id('ins')} label="Insurance" prefix="$" suffix="/yr" value={deal.insuranceAnnual} onChange={set('insuranceAnnual')} step={100} decimals={0} hint={`${money(a.insurance)}/mo`} />
        <NumberField id={id('hoa')} label="HOA" prefix="$" suffix="/mo" value={deal.hoaMonthly} onChange={set('hoaMonthly')} step={10} decimals={0} />
        <Derived label="PITIA" value={`${money(a.pitia)}/mo`} />
      </Section>

      <Section icon={Wrench} title="Operating expenses (% of rent)">
        <NumberField id={id('mgmt')} label="Property management" suffix="%" value={deal.mgmtPct} onChange={set('mgmtPct')} max={50} step={0.5} hint={`${money(a.opex.management)}/mo`} />
        <NumberField id={id('maint')} label="Maintenance & repairs" suffix="%" value={deal.maintPct} onChange={set('maintPct')} max={50} step={0.5} hint={`${money(a.opex.maintenance)}/mo`} />
        <NumberField id={id('vac')} label="Vacancy reserve" suffix="%" value={deal.vacancyPct} onChange={set('vacancyPct')} max={50} step={0.5} hint={`${money(a.opex.vacancy)}/mo`} />
        <NumberField id={id('capex')} label="CapEx reserve" suffix="%" value={deal.capexPct} onChange={set('capexPct')} max={50} step={0.5} hint={`${money(a.opex.capex)}/mo`} />
        <div className="col-span-2">
          <Derived label={`Total OpEx (${opexPct.toFixed(1)}% of rent)`} value={`${money(a.opex.total)}/mo`} />
        </div>
      </Section>

      <Section icon={SlidersHorizontal} title="Projection & lender assumptions" collapsible defaultOpen={false}>
        <NumberField id={id('appr')} label="Appreciation" suffix="%/yr" value={deal.appreciationPct} onChange={set('appreciationPct')} min={-10} max={20} step={0.5} />
        <NumberField id={id('rentg')} label="Rent growth" suffix="%/yr" value={deal.rentGrowthPct} onChange={set('rentGrowthPct')} min={-10} max={20} step={0.5} />
        <NumberField id={id('expg')} label="Tax/ins/HOA growth" suffix="%/yr" value={deal.expenseGrowthPct} onChange={set('expenseGrowthPct')} min={-10} max={20} step={0.5} />
        <NumberField
          id={id('haircut')}
          label="Lender rent haircut"
          suffix="%"
          value={deal.lenderHaircutPct}
          onChange={set('lenderHaircutPct')}
          max={50}
          step={5}
          hint="Some lenders count only 75% of rent"
        />
      </Section>
    </Card>
  );
}
