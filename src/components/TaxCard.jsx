import { useMemo } from 'react';
import { taxSnapshot } from '../lib/finance.js';
import { taxMeaning } from '../lib/explain.js';
import { money, percent } from '../lib/format.js';
import { Figure, LedgerLine, NumberField, Segmented, Stat, signedClass } from './ui.jsx';
import { InfoTip, Num } from './motion.jsx';
import { Section } from './Section.jsx';

/** Year-1 income tax on the rental: depreciation, taxable income and what's left after tax. */
export default function TaxCard({ deal, tax, onTax, id = 'sec-tax' }) {
  const t = useMemo(() => taxSnapshot(deal, tax), [deal, tax]);
  const loss = t.taxable < 0;
  const ca = t.rules === 'ca';
  // In Canada a rental loss (before CCA) always offsets other income.
  const lossUsable = ca || tax.useLosses;
  const wordFor = ca ? 'CCA' : 'Depreciation';

  const effect = loss
    ? lossUsable
      ? { label: 'Tax saved on other income', value: money(-t.taxDue), cls: 'text-emerald-700 dark:text-emerald-400' }
      : { label: 'Loss carried forward', value: money(t.carryForward), cls: 'text-zinc-900 dark:text-white' }
    : { label: `Tax at ${percent(t.rate, 0)}`, value: money(t.taxDue), cls: 'text-zinc-900 dark:text-white' };

  return (
    <Section
      id={id}
      title="Taxes in year 1"
      value={`${money(t.afterTaxCashFlow / 12, { signed: true })}/mo after tax`}
      valueClass={signedClass(t.afterTaxCashFlow)}
      meaning={taxMeaning(t)}
      subtitle={
        ca
          ? 'Capital cost allowance can shelter your rental income from tax. Canadian rules, simplified.'
          : 'Depreciation turns part of your cash flow into a paper loss. US rules, simplified.'
      }
    >
      <div className="grid gap-8 p-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="text-sm">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <NumberField id={`${deal.id}-tax-rate`} label="Your tax rate" suffix="%" value={tax.rate} onChange={(v) => onTax({ rate: v })} max={60} step={1} decimals={1} hint={ca ? 'Federal + Ontario, marginal' : 'Federal + state, marginal'} />
            <NumberField id={`${deal.id}-tax-land`} label="Land share of price" tip="land" suffix="%" value={tax.landPct} onChange={(v) => onTax({ landPct: v })} max={90} step={5} decimals={0} hint="Land isn’t depreciated" />
            {ca ? (
              <p className="col-span-2 text-xs text-zinc-600 dark:text-zinc-400">
                CCA can’t create or deepen a rental loss, but a loss from your other costs reduces tax on your other income.
              </p>
            ) : (
              <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Can you use rental losses?
                  <InfoTip k="passiveLoss" />
                </span>
                <Segmented
                  size="sm"
                  label="Can you use rental losses"
                  value={tax.useLosses ? 'yes' : 'no'}
                  onChange={(v) => onTax({ useLosses: v === 'yes' })}
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' },
                  ]}
                />
              </div>
            )}
          </div>
          <LedgerLine label="Rent collected (after vacancy)" value={money(t.rentCollected)} />
          <LedgerLine label="Operating costs" value={money(-t.operating)} />
          <LedgerLine label="Mortgage interest" value={money(-t.interest)} />
          <LedgerLine label={ca ? 'Capital cost allowance' : 'Depreciation'} tip={ca ? 'cca' : 'depreciation'} value={money(-t.depreciation)} />
          <LedgerLine label={loss ? 'Taxable loss' : 'Taxable income'} value={money(t.taxable, { signed: true })} sum />
          <LedgerLine label={effect.label} value={effect.value} valueClass={effect.cls} />
          {ca && t.ccaUnused > 0.5 && <LedgerLine label="CCA kept for later years" value={money(t.ccaUnused)} />}
        </div>

        <div className="grid content-start gap-4">
          <Figure
            label="After-tax cash flow"
            value={
              <>
                <Num value={t.afterTaxCashFlow / 12} format={(v) => money(v, { signed: true })} />
                <span className="ml-1 text-base font-medium tracking-normal text-zinc-500 dark:text-zinc-400">/mo</span>
              </>
            }
            valueClass={signedClass(t.afterTaxCashFlow)}
          >
            {t.taxDue === 0
              ? `${money(t.afterTaxCashFlow, { signed: true })} a year, the same as before tax: no tax is due.`
              : `${money(t.afterTaxCashFlow, { signed: true })} a year, versus ${money(t.preTaxCashFlow, { signed: true })} before tax.`}
            {t.depreciationSaves > 0 && ` ${wordFor} keeps ${money(t.depreciationSaves)} of tax off this deal ${ca ? 'this year' : 'each year'}.`}
          </Figure>
          <div className="grid grid-cols-2 gap-4 px-1">
            <Stat label={ca ? 'Class 1 cost' : 'Depreciable basis'} value={money(t.basis)} sub="building + closing + rehab" />
            <Stat label="After-tax cash-on-cash" tip="coc" value={percent(t.afterTaxCoc)} sub={`${percent(t.preTaxCoc)} before tax`} />
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {ca
              ? 'Estimates only, at the 4% Class 1 rate (any first-year boost isn’t counted). Tax when you sell (CCA recapture and capital gains) isn’t included. Check the numbers with an accountant.'
              : 'Estimates only. Taxes when you sell (depreciation recapture and capital gains) aren’t included. Check the numbers with a tax professional.'}
          </p>
        </div>
      </div>
    </Section>
  );
}
