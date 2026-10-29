import { ChevronDown, Copy, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { UNIT_TYPES, switchRules } from '../lib/presets.js';
import { money, percent } from '../lib/format.js';
import { Card, CardHeader, FieldLabel, LedgerLine, NumberField, Segmented, SelectField } from './ui.jsx';
import { InfoTip } from './motion.jsx';
import RentHelper from './RentHelper.jsx';

/**
 * A group of inputs. The basics stay open; the rest fold down to one line
 * that says, in plain words, what they're set to. `defaultOpen` applies
 * when the deal's inputs first show, so a group never snaps shut while
 * you change the setting that opened it.
 */
function Section({ title, summary, children, collapsible = false, defaultOpen = true }) {
  const [startOpen] = useState(defaultOpen);
  const heading = <span className="block text-sm font-semibold text-zinc-900 dark:text-white">{title}</span>;
  if (collapsible) {
    return (
      <details open={startOpen} className="group border-t border-hairline px-5 py-3.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="block min-w-0">
            {heading}
            {summary && <span className="tabular mt-0.5 block truncate text-xs text-zinc-500 group-open:hidden dark:text-zinc-400">{summary}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180 dark:text-zinc-400" aria-hidden />
        </summary>
        <div className="mt-3.5 grid grid-cols-2 gap-3">{children}</div>
      </details>
    );
  }
  return (
    <div className="border-t border-hairline px-5 py-4">
      {heading}
      <div className="mt-3.5 grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

/** Figures worked out from the inputs, as ledger lines under them. */
function Derived({ children }) {
  return <div className="col-span-2 text-[13px]">{children}</div>;
}

const iconBtn = 'rounded-md p-1.5 text-zinc-500 transition dark:text-zinc-400 hover:bg-well hover:text-zinc-700 dark:hover:text-zinc-200';
const pct = (v) => `${Number((Number(v) || 0).toFixed(2))}%`;

export default function InputsPanel({ deal, a, rents, onChange, onDuplicate, onDelete, onShare }) {
  const id = (k) => `${deal.id}-${k}`;
  const set = (k) => (v) => onChange({ [k]: v });
  const opexPct = (Number(deal.mgmtPct) || 0) + (Number(deal.maintPct) || 0) + (Number(deal.vacancyPct) || 0) + (Number(deal.capexPct) || 0);
  const ca = deal.country === 'ca';
  const prepay = deal.prepay && deal.prepay !== 'none' ? deal.prepay : null;
  const valueAdd = Number(deal.arv) > 0 || Boolean(deal.refiEnabled);

  return (
    // Keyed by deal so each deal's groups start open or folded by its own settings.
    <Card key={deal.id} id="sec-inputs">
      <CardHeader
        title="Deal inputs"
        subtitle="Saves as you type."
        actions={
          <>
            {onShare && (
              <button type="button" onClick={onShare} className={iconBtn} aria-label="Share deal" title="Share deal as a link">
                <Share2 className="size-4" aria-hidden />
              </button>
            )}
            <button type="button" onClick={onDuplicate} className={iconBtn} aria-label="Duplicate deal" title="Duplicate deal">
              <Copy className="size-4" aria-hidden />
            </button>
            {onDelete && (
              // No confirm step: deleting shows an Undo toast instead.
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete deal"
                title="Delete deal"
                className="rounded-md p-1.5 text-zinc-500 transition dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:hover:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </>
        }
      />
      <div className="px-5 py-4">
        <FieldLabel htmlFor={id('name')}>Deal name</FieldLabel>
        <input
          id={id('name')}
          value={deal.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="field w-full px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100"
        />
      </div>

      <Section title="The property">
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
          <NumberField
            id={id('rent')}
            label={a.units > 1 ? 'Monthly rent for each unit' : 'Monthly rent'}
            prefix="$"
            suffix="/mo"
            value={deal.rentPerUnit}
            onChange={set('rentPerUnit')}
            step={25}
            decimals={0}
          />
          {ca && rents && <RentHelper rents={rents} onPick={set('rentPerUnit')} />}
        </div>
        {a.units > 1 && (
          <Derived>
            <LedgerLine label={`Total rent for ${a.units} units`} value={`${money(a.grossRent)}/mo`} />
          </Derived>
        )}
      </Section>

      <Section title="Your loan">
        <NumberField id={id('down')} label="Down payment" suffix="%" value={deal.downPct} onChange={set('downPct')} max={100} step={1} hint={money(a.downPayment)} />
        <NumberField
          id={id('rate')}
          label="Interest rate"
          suffix="%"
          value={deal.rate}
          onChange={set('rate')}
          max={30}
          step={0.125}
          decimals={3}
          hint={ca ? 'Compounded semi-annually' : undefined}
        />
        <div className="col-span-2">
          <SelectField id={id('term')} label="Paid off over" value={deal.termYears} onChange={(e) => onChange({ termYears: Number(e.target.value) })}>
            {[...new Set([10, 15, 20, 25, 30, 35, 40, Number(deal.termYears)])].sort((p, q) => p - q).map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </SelectField>
        </div>
        <Derived>
          <LedgerLine label="Loan" value={money(a.loanAmount)} />
          <LedgerLine label="Payment" value={`${money(a.pi)}/mo`} />
        </Derived>
      </Section>

      <Section title={ca ? 'Taxes, insurance & utilities' : 'Taxes, insurance & HOA'}>
        <NumberField id={id('tax')} label="Property taxes" prefix="$" suffix="/yr" value={deal.taxesAnnual} onChange={set('taxesAnnual')} step={100} decimals={0} hint={`${money(a.taxes)}/mo`} />
        <NumberField id={id('ins')} label="Insurance" prefix="$" suffix="/yr" value={deal.insuranceAnnual} onChange={set('insuranceAnnual')} step={100} decimals={0} hint={`${money(a.insurance)}/mo`} />
        <NumberField
          id={id('hoa')}
          label={ca ? 'Condo fees & utilities' : 'HOA fees'}
          tip={ca ? 'utilities' : undefined}
          prefix="$"
          suffix="/mo"
          value={deal.hoaMonthly}
          onChange={set('hoaMonthly')}
          step={10}
          decimals={0}
          hint={ca ? undefined : 'Leave at 0 if there are none'}
        />
        <Derived>
          <LedgerLine label="Loan, taxes & insurance (PITIA)" value={`${money(a.pitia)}/mo`} />
        </Derived>
      </Section>

      <Section title="Running costs" collapsible defaultOpen={false} summary={`${pct(opexPct)} of rent · ${money(a.opex.total)}/mo`}>
        <NumberField id={id('mgmt')} label="Property management" suffix="%" value={deal.mgmtPct} onChange={set('mgmtPct')} max={50} step={0.5} hint={`${money(a.opex.management)}/mo to a manager`} />
        <NumberField id={id('maint')} label="Maintenance & repairs" suffix="%" value={deal.maintPct} onChange={set('maintPct')} max={50} step={0.5} hint={`${money(a.opex.maintenance)}/mo for repairs`} />
        <NumberField id={id('vac')} label="Empty months (vacancy)" suffix="%" value={deal.vacancyPct} onChange={set('vacancyPct')} max={50} step={0.5} hint={`${money(a.opex.vacancy)}/mo set aside`} />
        <NumberField id={id('capex')} label="Big replacements (CapEx)" suffix="%" value={deal.capexPct} onChange={set('capexPct')} max={50} step={0.5} hint={`${money(a.opex.capex)}/mo for roof, furnace…`} />
        <Derived>
          <LedgerLine label={`Running costs (${pct(opexPct)} of rent)`} value={`${money(a.opex.total)}/mo`} />
        </Derived>
      </Section>

      <Section
        title="Cash at closing"
        collapsible
        defaultOpen={false}
        summary={`${money(a.cashInvested)} in${a.reserves > 0 ? `, plus ${money(a.reserves)} kept in the bank` : ''}`}
      >
        <NumberField
          id={id('closing')}
          label={ca ? 'Other closing costs' : 'Closing costs'}
          tip={ca ? 'landTransferTax' : undefined}
          suffix="%"
          value={deal.closingPct}
          onChange={set('closingPct')}
          max={15}
          step={0.5}
          hint={ca ? `${money(a.closingCosts - a.landTransferTax)} + ${money(a.landTransferTax)} land transfer tax` : money(a.closingCosts)}
        />
        <NumberField id={id('rehab')} label="Repair budget" prefix="$" value={deal.rehabCost} onChange={set('rehabCost')} step={1000} decimals={0} />
        <div className="col-span-2">
          <NumberField
            id={id('reserves')}
            label="Lender reserves"
            tip="reserves"
            suffix="months"
            value={deal.reserveMonths}
            onChange={set('reserveMonths')}
            max={24}
            step={1}
            decimals={0}
            hint={`${money(a.reserves)} kept in the bank, not spent`}
          />
        </div>
        <Derived>
          <LedgerLine label="Cash invested (down + closing + repairs)" value={money(a.cashInvested)} />
          <LedgerLine label="Cash needed incl. reserves" value={money(a.cashNeeded)} sum />
        </Derived>
      </Section>

      <Section
        title="Loan extras"
        collapsible
        defaultOpen={a.interestOnly || Boolean(prepay)}
        summary={`${a.interestOnly ? `Interest-only for ${a.ioYears} years` : 'No interest-only period'} · ${prepay ? `${prepay} early payoff penalty` : 'no early payoff penalty'}`}
      >
        <div className="col-span-2">
          <SelectField id={id('io')} label="Interest-only period" tip="interestOnly" value={a.ioYears} onChange={(e) => onChange({ ioYears: Number(e.target.value) })}>
            {[...new Set([0, 5, 7, 10, a.ioYears])]
              .filter((y) => y === 0 || y <= Number(deal.termYears) - 1)
              .sort((p, q) => p - q)
              .map((y) => (
                <option key={y} value={y}>
                  {y === 0 ? 'None: paid down from the start' : `${y} years, then paid down`}
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
          <SelectField id={id('prepay')} label="Early payoff penalty" tip="prepay" value={deal.prepay || 'none'} onChange={(e) => onChange({ prepay: e.target.value })}>
            <option value="none">None</option>
            <option value="3-2-1">3-2-1 (3 years)</option>
            <option value="5-4-3-2-1">5-4-3-2-1 (5 years)</option>
          </SelectField>
        </div>
        <Derived>
          <LedgerLine label="Loan-to-value" value={percent(a.ltv, 1)} />
        </Derived>
      </Section>

      <Section
        title="Fix-up & refinance"
        collapsible
        defaultOpen={valueAdd}
        summary={
          valueAdd
            ? [Number(deal.arv) > 0 && `Worth ${money(Number(deal.arv))} after repairs`, deal.refiEnabled && `refinance after ${deal.refiYear} ${Number(deal.refiYear) === 1 ? 'year' : 'years'}`]
                .filter(Boolean)
                .join(' · ')
            : 'Not used'
        }
      >
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
            hint={Number(deal.arv) > 0 ? `${money(a.forcedEquity)} of equity created by the repairs` : 'Leave at 0 if repairs add no value'}
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

      <Section
        title="Growth & selling"
        collapsible
        defaultOpen={false}
        summary={`Value +${pct(deal.appreciationPct)}/yr · rent +${pct(deal.rentGrowthPct)}/yr · selling costs ${pct(deal.sellingCostPct)}`}
      >
        <NumberField id={id('appr')} label="Value growth" suffix="%/yr" value={deal.appreciationPct} onChange={set('appreciationPct')} min={-10} max={20} step={0.5} />
        <NumberField id={id('rentg')} label="Rent growth" suffix="%/yr" value={deal.rentGrowthPct} onChange={set('rentGrowthPct')} min={-10} max={20} step={0.5} />
        <NumberField
          id={id('expg')}
          label="Bills growth"
          suffix="%/yr"
          value={deal.expenseGrowthPct}
          onChange={set('expenseGrowthPct')}
          min={-10}
          max={20}
          step={0.5}
          hint={ca ? 'Taxes, insurance, utilities' : 'Taxes, insurance, HOA'}
        />
        <NumberField
          id={id('sell')}
          label="Selling costs"
          suffix="% of sale"
          value={deal.sellingCostPct}
          onChange={set('sellingCostPct')}
          max={20}
          step={0.5}
          hint={ca ? 'Agent commission, legal fees' : 'Agent fees, transfer tax, concessions'}
        />
        <div className="col-span-2">
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
        </div>
      </Section>

      <Section
        title="About this deal"
        collapsible
        defaultOpen={false}
        summary={[deal.status === 'owned' ? 'Owned' : 'Prospect', ca ? 'Canada (Ontario) rules' : 'US rules', deal.address].filter(Boolean).join(' · ')}
      >
        <div className="col-span-2 flex flex-wrap items-end gap-3">
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
          <div>
            <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Rules
              <InfoTip k="rules" />
            </span>
            <Segmented
              size="sm"
              label="Rules"
              value={ca ? 'ca' : 'us'}
              onChange={(v) => onChange(switchRules(deal, v))}
              options={[
                { value: 'us', label: 'US' },
                { value: 'ca', label: 'Canada' },
              ]}
            />
          </div>
        </div>
        <div className="col-span-2">
          <FieldLabel htmlFor={id('address')}>Address</FieldLabel>
          <input
            id={id('address')}
            value={deal.address ?? ''}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="123 Main St, Springfield"
            autoComplete="off"
            className="field w-full px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100"
          />
        </div>
        <div className="col-span-2">
          <FieldLabel htmlFor={id('url')}>Listing link</FieldLabel>
          <input
            id={id('url')}
            type="url"
            inputMode="url"
            value={deal.listingUrl ?? ''}
            onChange={(e) => onChange({ listingUrl: e.target.value })}
            placeholder="https://"
            autoComplete="off"
            className="field w-full px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100"
          />
        </div>
        <div className="col-span-2">
          <FieldLabel htmlFor={id('notes')}>Notes</FieldLabel>
          <textarea
            id={id('notes')}
            rows={3}
            value={deal.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Seller motivation, inspection items, comps…"
            className="field w-full resize-y px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100"
          />
        </div>
      </Section>
    </Card>
  );
}
