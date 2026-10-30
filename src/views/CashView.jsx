import { useMemo } from 'react';
import { AlertTriangle, ArrowDownToLine, CheckCircle2, XCircle } from 'lucide-react';
import { provinceName } from '../lib/canada.js';
import { OWN_DOWN_PCT, dealPlace, allCash, analyzeDeal, loanConstant, maxOffer, ownMoney, paybackYears, projectDeal, saleAnalysis } from '../lib/finance.js';
import { cashRankingMeaning, cashRentMeaning, cashSaleMeaning, cashSentence, cashYearsMeaning, leverageMeaning, offerMeaning } from '../lib/explain.js';
import { TONE_TEXT } from '../lib/dscr.js';
import { money, percent } from '../lib/format.js';
import { UNIT_TYPES } from '../lib/presets.js';
import { Button, ExampleTag, Figure, LedgerLine, NumberField, SummaryCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { InfoTip, Num } from '../components/motion.jsx';
import { Section, SectionGroup } from '../components/Section.jsx';
import DealLedgers from '../components/DealLedgers.jsx';
import CalcInputs from '../components/CalcInputs.jsx';
import { TargetRow } from '../components/MaxOfferCard.jsx';
import TaxCard from '../components/TaxCard.jsx';

const YEARS = 10;

const yearsText = (y) => (y == null ? 'Never' : `${y < 10 ? y.toFixed(1) : Math.round(y)} years`);
const irrText = (x) => (Number.isFinite(x) ? percent(x, 1) : '—');

/** How the deal with 20% down stacks up against your cash-on-cash target. */
function cashVerdict(c, targets) {
  if (c.netCashFlow < 0) return { tone: 'bad', icon: XCircle, label: 'Loses money each month' };
  if (!targets.useCoc) return { tone: 'good', icon: CheckCircle2, label: 'Pays you each month' };
  return c.coc * 100 >= Number(targets.coc)
    ? { tone: 'good', icon: CheckCircle2, label: `Beats your ${Number(targets.coc)}% target` }
    : { tone: 'warn', icon: AlertTriangle, label: `Below your ${Number(targets.coc)}% target` };
}

function CashSummary({ deal, own, c, targets, onChange }) {
  const v = cashVerdict(c, targets);
  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const years = paybackYears(c);
  const facts = [
    type?.key === 'multiplex' ? `Multiplex, ${c.units} units` : type?.label,
    money(c.price),
    `${OWN_DOWN_PCT}% down, ${Number(deal.rate)}% over ${deal.termYears} years`,
    deal.country === 'ca' && `${provinceName(dealPlace(deal).province)} rules`,
  ].filter(Boolean);
  return (
    <SummaryCard
      id="cash-summary"
      head={
        <>
          <h3 className="text-xl font-semibold tracking-tight break-words text-zinc-950 sm:text-2xl dark:text-white">
            {deal.name}
            {deal.example && <ExampleTag className="ml-2 inline-block align-middle" />}
          </h3>
          <p className="tabular mt-1 text-xs text-zinc-500 dark:text-zinc-400">{facts.join(' · ')}</p>
          <p className={`mt-4 flex items-center gap-1.5 text-[15px] font-semibold ${TONE_TEXT[v.tone]}`}>
            <v.icon className="size-4 shrink-0" aria-hidden />
            {v.label}
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{cashSentence(c)}</p>
          {deal.estimated && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Taxes and insurance are estimated from the price: edit the deal once you know the real numbers.</p>}
        </>
      }
    >
      {onChange && <CalcInputs deal={deal} a={c} onChange={onChange} ownDown={OWN_DOWN_PCT} />}
      <DealLedgers deal={own} a={c} lender={false} heading="h4">
        <LedgerLine label="Cash flow pays it back in" value={years ? yearsText(years) : 'Never'} />
      </DealLedgers>
    </SummaryCard>
  );
}

/** Rent, then the mortgage payment and each cost of owning it, as a share of the rent. */
function RentSection({ deal, c }) {
  return (
    <Section
      id="cash-rent"
      title="Where the rent goes"
      value={`${money(c.netCashFlow, { signed: true })}/mo`}
      valueClass={signedClass(c.netCashFlow)}
      meaning={cashRentMeaning(c)}
      subtitle="The mortgage payment comes first, then the costs of owning the property."
    >
      <div className="max-w-xl p-5 text-sm">
        <LedgerLine label="Rent" value={money(c.grossRent)} />
        <LedgerLine label="Mortgage payment" value={money(-c.pi)} />
        <LedgerLine label="Property taxes" value={money(-c.taxes)} />
        <LedgerLine label="Insurance" value={money(-c.insurance)} />
        {c.hoa > 0 && <LedgerLine label={deal.country === 'ca' ? 'Condo fees & utilities' : 'HOA'} value={money(-c.hoa)} />}
        <LedgerLine label="Property management" value={money(-c.opex.management)} />
        <LedgerLine label="Maintenance & repairs" value={money(-c.opex.maintenance)} />
        <LedgerLine label="Vacancy reserve" value={money(-c.opex.vacancy)} />
        <LedgerLine label="CapEx reserve" value={money(-c.opex.capex)} />
        <LedgerLine label="Left for you each month" value={money(c.netCashFlow, { signed: true })} valueClass={`text-lg ${signedClass(c.netCashFlow)}`} total />
      </div>
    </Section>
  );
}

/** The deal with 20% down next to the same deal bought outright. */
function LeverageSection({ c, cash, sale, cashSale }) {
  const k = loanConstant(c);
  const rows = [
    ['Cash you put in', money(c.cashInvested), money(cash.cashInvested)],
    ['Mortgage payment', `${money(c.pi)}/mo`, '—'],
    ['Monthly cash flow', money(c.netCashFlow, { signed: true }), money(cash.netCashFlow, { signed: true }), [c.netCashFlow, cash.netCashFlow]],
    ['Cash-on-cash return', percent(c.coc, 1), percent(cash.coc, 1), [c.coc, cash.coc]],
    [`Profit if sold in year ${YEARS}`, money(sale.profit, { signed: true }), money(cashSale.profit, { signed: true }), [sale.profit, cashSale.profit]],
    ['Yearly return to then (IRR)', irrText(sale.irr), irrText(cashSale.irr), [sale.irr, cashSale.irr]],
  ];
  return (
    <Section
      id="cash-leverage"
      title="Mortgage or all cash?"
      value={`${percent(c.coc, 1)} vs ${percent(cash.coc, 1)}`}
      meaning={leverageMeaning(cash, c)}
      subtitle="All cash means paying the whole price yourself, with no mortgage."
    >
      <div className="p-4 sm:p-5">
        <table className="w-full text-sm">
          <caption className="sr-only">This deal with {OWN_DOWN_PCT}% down, and bought with all cash</caption>
          <thead>
            <tr className="caption">
              <th scope="col" className="py-1.5 text-left font-medium">
                <span className="sr-only">Measure</span>
              </th>
              <th scope="col" className="py-1.5 pl-2 text-right font-medium">{OWN_DOWN_PCT}% down</th>
              <th scope="col" className="py-1.5 pl-2 text-right font-medium">All cash</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(([label, down, outright, raw]) => (
              <tr key={label} className="border-t border-hairline">
                <th scope="row" className="py-2 text-left font-normal text-zinc-700 dark:text-zinc-300">{label}</th>
                <td className={`py-2 pl-2 text-right font-medium whitespace-nowrap ${raw ? signedClass(raw[0]) : 'text-zinc-900 dark:text-zinc-100'}`}>{down}</td>
                <td className={`py-2 pl-2 text-right font-medium whitespace-nowrap ${raw ? signedClass(raw[1]) : 'text-zinc-900 dark:text-zinc-100'}`}>{outright}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {k != null && (
          <p className="mt-3 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            A year of mortgage payments costs {percent(k, 1)} of the loan.
            <InfoTip k="loanConstant" />
          </p>
        )}
      </div>
    </Section>
  );
}

/** The most to pay with 20% down and still hit your cash-on-cash and per-door targets. */
function CashOfferSection({ deal, own, targets, onTargets, onUsePrice }) {
  const asking = Number(deal.price) || 0;
  const m = useMemo(() => maxOffer(own, { ...targets, useDscr: false }), [own, targets]);
  const finite = m.price != null && m.feasible && Number.isFinite(m.price);
  const rounded = finite ? Math.floor(m.price / 500) * 500 : null;
  return (
    <Section
      id="cash-offer"
      title="Most you should pay"
      value={m.price == null || !m.feasible ? null : finite ? money(m.price) : 'No limit'}
      meaning={offerMeaning(m, asking)}
      subtitle={`The highest price that still hits your targets with ${OWN_DOWN_PCT}% down. There’s no DSCR lender here, so the DSCR target doesn’t apply.`}
    >
      <div className="grid gap-5 p-5 @3xl:grid-cols-2">
        <div className="grid content-start gap-2">
          <TargetRow id={`${deal.id}-ct-coc`} on={targets.useCoc} onToggle={(v) => onTargets({ useCoc: v })}>
            <NumberField id={`${deal.id}-ct-coc`} label="Cash-on-cash at least" tip="coc" suffix="%" value={targets.coc} onChange={(v) => onTargets({ coc: v })} max={100} step={0.5} decimals={2} />
          </TargetRow>
          <TargetRow id={`${deal.id}-ct-cf`} on={targets.useCashFlow} onToggle={(v) => onTargets({ useCashFlow: v })}>
            <NumberField
              id={`${deal.id}-ct-cf`}
              label="Cash flow per door at least"
              prefix="$"
              suffix="/mo"
              value={targets.cashFlowPerDoor}
              onChange={(v) => onTargets({ cashFlowPerDoor: v })}
              min={-5000}
              step={25}
              decimals={0}
            />
          </TargetRow>
          <p className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400">These are the same targets the Analyze tab uses.</p>
        </div>
        {finite && (
          <Figure label="Pay up to" value={<Num value={m.price} format={(v) => money(v)} />}>
            <p className={`tabular text-sm font-medium ${m.price >= asking ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {m.price >= asking ? `Asking works, with ${money(m.price - asking)} of room` : `${money(asking - m.price)} under asking (${percent((m.price - asking) / asking, 1)})`}
            </p>
            {Math.abs(rounded - asking) >= 500 && (
              <Button variant="primary" className="mt-4" onClick={() => onUsePrice(rounded)}>
                <ArrowDownToLine className="size-4" aria-hidden /> Use {money(rounded)} as the price
              </Button>
            )}
          </Figure>
        )}
      </div>
    </Section>
  );
}

/** Cash flow year by year, how much of your cash it has paid back, and a sale at the end. */
function YearsSection({ deal, c, rows, sale }) {
  const last = rows[rows.length - 1];
  return (
    <Section
      id="cash-years"
      title={`Cash flow over ${rows.length} years`}
      value={money(last.cumCashFlow, { signed: true })}
      valueClass={signedClass(last.cumCashFlow)}
      meaning={cashYearsMeaning(c, rows, deal.rentGrowthPct)}
    >
      <div tabIndex={0} role="region" aria-label="Cash flow by year" className="thin-scroll overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500">
        <table className="w-full text-sm">
          <caption className="sr-only">Cash flow by year, with {OWN_DOWN_PCT}% down</caption>
          <thead>
            <tr className="caption">
              {['Year', 'Cash flow', 'So far', 'Cash back'].map((h, i) => (
                <th key={h} scope="col" className={`px-2 py-3 font-medium first:pl-4 last:pr-4 sm:px-4 sm:first:pl-5 sm:last:pr-5 ${i ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r.year} className="border-t border-hairline text-zinc-700 dark:text-zinc-300">
                <td className="py-2 pr-2 pl-4 sm:pr-4 sm:pl-5">{r.year}</td>
                <td className={`px-2 py-2 text-right sm:px-4 ${signedClass(r.cashFlow)}`}>{money(r.cashFlow, { signed: true })}</td>
                <td className="px-2 py-2 text-right sm:px-4">{money(r.cumCashFlow, { signed: true })}</td>
                <td className="py-2 pr-4 pl-2 text-right font-medium text-zinc-900 sm:pr-5 sm:pl-4 dark:text-zinc-100">
                  {c.cashInvested > 0 ? percent(Math.max(r.cumCashFlow, 0) / c.cashInvested, 0) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-hairline px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">{cashSaleMeaning(sale)}</p>
    </Section>
  );
}

/** Every deal in the library, ranked by what it would pay on your cash with 20% down. */
function DealRanking({ items, activeId, onSelect }) {
  const ranked = useMemo(
    () =>
      items
        .map((x) => {
          const c = analyzeDeal(ownMoney(x.deal));
          return { deal: x.deal, c, years: paybackYears(c) };
        })
        .sort((p, q) => q.c.coc - p.c.coc),
    [items],
  );
  return (
    <Section
      id="cash-deals"
      title={`Your deals with ${OWN_DOWN_PCT}% down`}
      value={`${ranked.length} ${ranked.length === 1 ? 'deal' : 'deals'}`}
      meaning={cashRankingMeaning(ranked[0])}
      subtitle="Tap one to see it here."
    >
      <ol aria-label={`Deals by cash-on-cash return, ${OWN_DOWN_PCT}% down`}>
        {ranked.map(({ deal, c, years }, i) => (
          <li key={deal.id} className="border-t border-hairline first:border-t-0">
            <button
              type="button"
              onClick={() => onSelect(deal.id)}
              aria-current={deal.id === activeId ? 'true' : undefined}
              className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-well focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 ${
                deal.id === activeId ? 'bg-well' : ''
              }`}
            >
              <span aria-hidden className="tabular w-5 shrink-0 text-right text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{deal.name}</span>
                <span className="tabular block text-xs text-zinc-500 dark:text-zinc-400">
                  {money(c.cashInvested)} in · {money(c.netCashFlow, { signed: true })}/mo · money back {years ? `in ${yearsText(years)}` : 'never'}
                </span>
              </span>
              <span className={`tabular shrink-0 text-sm font-semibold ${signedClass(c.coc)}`}>{percent(c.coc, 1)}</span>
            </button>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * The Cash tab: any deal with your own money as a 20% down payment and a
 * regular mortgage for the rest. No DSCR, only the cash flow after the
 * mortgage payment and the return on the cash you put in.
 */
export default function CashView({ deal, items, targets, onTargets, tax, onTax, onSelect, onUsePrice, onChange }) {
  const own = useMemo(() => ownMoney(deal), [deal]);
  const c = useMemo(() => analyzeDeal(own), [own]);
  const rows = useMemo(() => projectDeal(own, YEARS), [own]);
  const sale = useMemo(() => saleAnalysis(own, rows), [own, rows]);
  const cashDeal = useMemo(() => allCash(deal), [deal]);
  const cash = useMemo(() => analyzeDeal(cashDeal), [cashDeal]);
  const cashSale = useMemo(() => saleAnalysis(cashDeal, projectDeal(cashDeal, YEARS)), [cashDeal]);

  return (
    <div className="space-y-6">
      <ViewHeader title={`Your money, ${OWN_DOWN_PCT}% down`}>
        Any deal with your own money as a {OWN_DOWN_PCT}% down payment and a regular mortgage for the rest, at the deal’s rate and term. No lender’s DSCR test: just the
        cash flow after the mortgage payment, and the return on your cash.
      </ViewHeader>

      <CashSummary deal={deal} own={own} c={c} targets={targets} onChange={onChange} />

      <SectionGroup>
        <RentSection deal={deal} c={c} />
        <LeverageSection c={c} cash={cash} sale={sale} cashSale={cashSale} />
        <CashOfferSection deal={deal} own={own} targets={targets} onTargets={onTargets} onUsePrice={onUsePrice} />
        <YearsSection deal={deal} c={c} rows={rows} sale={sale} />
        <TaxCard id="cash-tax" deal={own} tax={tax} onTax={onTax} />
        <DealRanking items={items} activeId={deal.id} onSelect={onSelect} />
      </SectionGroup>
    </div>
  );
}
