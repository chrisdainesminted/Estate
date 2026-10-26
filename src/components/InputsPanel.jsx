import { Building2, ChevronDown, Copy, Hammer, Landmark, PencilRuler, Receipt, SlidersHorizontal, Trash2, Wallet, Wrench } from 'lucide-react';
import { UNIT_TYPES } from '../lib/presets.js';
import { money, percent } from '../lib/format.js';
import { Card, CardHeader, ConfirmButton, FieldLabel, NumberField, Segmented, SelectField } from './ui.jsx';
import { InfoTip } from './motion.jsx';

function Section({ icon: Icon, title, children, collapsible = false, defaultOpen = true }) {
  const heading = (
    <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-zinc-700 uppercase dark:text-zinc-300">
      <Icon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      {title}
    </span>
  );
  if (collapsible) {
    return (
      <details open={defaultOpen} className="group border-t border-hairline px-6 py-5">
        <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
          {heading}
          <ChevronDown className="size-4 text-zinc-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-3">{children}</div>
      </details>
    );
  }
  return (
    <div className="border-t border-hairline px-6 py-5">
      {heading}
      <div className="mt-4 grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Derived({ label, value, strong }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs ${
        strong ? 'bg-emerald-500/10 ring-1 ring-emerald-600/15 ring-inset dark:bg-emerald-400/10 dark:ring-emerald-300/15' : 'bg-well'
      }`}
    >
      <span className={strong ? 'font-medium text-emerald-900 dark:text-emerald-100' : 'text-zinc-500 dark:text-zinc-400'}>{label}</span>
      <span className="tabular font-semibold text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

const iconBtn = 'rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200';

export default function InputsPanel({ deal, a, onChange, onDuplicate, onDelete }) {
  const id = (k) => `${deal.id}-${k}`;
  const set = (k) => (v) => onChange({ [k]: v });
  const opexPct = (Number(deal.mgmtPct) || 0) + (Number(deal.maintPct) || 0) + (Number(deal.vacancyPct) || 0) + (Number(deal.capexPct) || 0);

  return (
    <Card>
      <CardHeader
        icon={PencilRuler}
        title="Deal inputs"
        subtitle="Saves as you type."
        actions={
          <>
            <button type="button" onClick={onDuplicate} className={iconBtn} aria-label="Duplicate deal" title="Duplicate deal">
              <Copy className="size-4" aria-hidden />
            </button>
            {onDelete && (
              <ConfirmButton
                label="Delete deal"
                title={`Delete “${deal.name}”?`}
                body="It’s removed from your deals, the portfolio and any comparison. This can’t be undone."
                confirmLabel="Delete deal"
                onConfirm={onDelete}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </ConfirmButton>
            )}
          </>
        }
      />
      <div className="space-y-4 px-6 pt-5 pb-5">
        <div>
          <FieldLabel htmlFor={id('name')}>Deal name</FieldLabel>
          <input
            id={id('name')}
            value={deal.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="field w-full px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Status</span>
            <Segmented
              size="sm"
              label="Deal status"
              value={deal.status === 'owned' ? 'owned' : 'prospect'}
              onChange={(v) => onChange({ status: v })}
              options={[
                { value: 'prospect', label: 'Prospect' },
                { value: 'owned', label: 'Owned' },
              ]}
            />
          </div>
          {deal.status === 'owned' && (
            <div className="w-28">
              <NumberField id={id('owned')} label="Years owned" value={deal.yearsOwned} onChange={set('yearsOwned')} max={40} step={1} decimals={1} />
            </div>
          )}
        </div>
      </div>

      <Section icon={Building2} title="Property & income">
        <div className="col-span-2">
          <NumberField id={id('price')} label="Purchase price" prefix="$" value={deal.price} onChange={set('price')} step={5000} decimals={0} />
        </div>
        <div className="col-span-2">
          <label htmlFor={id('unitType')} className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Property type
          </label>
          <select
            id={id('unitType')}
            value={deal.unitType}
            onChange={(e) => {
              const t = UNIT_TYPES.find((u) => u.key === e.target.value);
              onChange({ unitType: t.key, units: t.key === 'multiplex' ? Math.max(deal.units, 5) : t.units });
            }}
            className="field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100"
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
          <label htmlFor={id('term')} className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Amortization
          </label>
          <select
            id={id('term')}
            value={deal.termYears}
            onChange={(e) => onChange({ termYears: Number(e.target.value) })}
            className="field w-full px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100"
          >
            {[10, 15, 20, 25, 30, 40].map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </select>
        </div>
        <NumberField id={id('closing')} label="Closing costs" suffix="%" value={deal.closingPct} onChange={set('closingPct')} max={15} step={0.5} hint={money(a.closingCosts)} />
        <div className="col-span-2">
          <SelectField id={id('io')} label="Interest-only period" tip="interestOnly" value={a.ioYears} onChange={(e) => onChange({ ioYears: Number(e.target.value) })}>
            {[...new Set([0, 5, 7, 10, a.ioYears])]
              .filter((y) => y === 0 || y <= Number(deal.termYears) - 1)
              .sort((p, q) => p - q)
              .map((y) => (
                <option key={y} value={y}>
                  {y === 0 ? 'None: fully amortizing' : `${y} years, then amortizing`}
                </option>
              ))}
          </SelectField>
          {a.interestOnly && (
            <p className="tabular mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {money(a.pi)}/mo now → {money(a.amortizingPI)}/mo after year {a.ioYears}
            </p>
          )}
        </div>
        <div className="col-span-2">
          <SelectField id={id('prepay')} label="Prepayment penalty" tip="prepay" value={deal.prepay || 'none'} onChange={(e) => onChange({ prepay: e.target.value })}>
            <option value="none">None</option>
            <option value="3-2-1">3-2-1 (3 years)</option>
            <option value="5-4-3-2-1">5-4-3-2-1 (5 years)</option>
          </SelectField>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <Derived label="Loan" value={money(a.loanAmount)} />
          <Derived label="LTV" value={percent(a.ltv, 1)} />
        </div>
      </Section>

      <Section icon={Wallet} title="Cash required">
        <NumberField id={id('rehab')} label="Rehab budget" prefix="$" value={deal.rehabCost} onChange={set('rehabCost')} step={1000} decimals={0} />
        <NumberField
          id={id('reserves')}
          label="Lender reserves"
          tip="reserves"
          suffix="mo"
          value={deal.reserveMonths}
          onChange={set('reserveMonths')}
          max={24}
          step={1}
          decimals={0}
          hint={`${money(a.reserves)} of PITIA`}
        />
        <div className="col-span-2 grid gap-2">
          <Derived label="Cash invested (down + closing + rehab)" value={money(a.cashInvested)} />
          <Derived label="Cash needed incl. reserves" value={money(a.cashNeeded)} strong />
        </div>
      </Section>

      <Section icon={Hammer} title="Value-add & refinance">
        <div className="col-span-2">
          <NumberField
            id={id('arv')}
            label="After-repair value"
            tip="arv"
            prefix="$"
            value={deal.arv}
            onChange={set('arv')}
            step={5000}
            decimals={0}
            hint={Number(deal.arv) > 0 ? `${money(a.forcedEquity)} of equity created by the rehab` : 'Leave at 0 if the rehab adds no value'}
          />
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Cash-out refinance
            <InfoTip k="refinance" />
          </span>
          <Segmented
            size="sm"
            label="Cash-out refinance"
            value={deal.refiEnabled ? 'yes' : 'no'}
            onChange={(v) => onChange({ refiEnabled: v === 'yes' })}
            options={[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ]}
          />
        </div>
        {deal.refiEnabled && (
          <>
            <SelectField id={id('refiYear')} label="Refinance after" value={deal.refiYear} onChange={(e) => onChange({ refiYear: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => (
                <option key={y} value={y}>
                  {y} {y === 1 ? 'year' : 'years'}
                </option>
              ))}
            </SelectField>
            <NumberField id={id('refiLtv')} label="New loan" suffix="% LTV" value={deal.refiLtv} onChange={set('refiLtv')} max={90} step={5} decimals={1} />
            <NumberField id={id('refiRate')} label="New rate" suffix="%" value={deal.refiRate} onChange={set('refiRate')} max={30} step={0.125} decimals={3} />
            <NumberField id={id('refiCost')} label="Refinance costs" suffix="%" value={deal.refiCostPct} onChange={set('refiCostPct')} max={10} step={0.25} decimals={2} />
          </>
        )}
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
        <NumberField
          id={id('sell')}
          label="Selling costs"
          suffix="% of sale"
          value={deal.sellingCostPct}
          onChange={set('sellingCostPct')}
          max={20}
          step={0.5}
          hint="Agent fees, transfer tax, concessions"
        />
      </Section>
    </Card>
  );
}
