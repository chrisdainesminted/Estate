import { useMemo } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, CalendarClock, CheckCircle2, ListOrdered, Scale, Target, XCircle } from 'lucide-react';
import { allCash, analyzeDeal, loanConstant, maxOffer, paybackYears, projectDeal, saleAnalysis } from '../lib/finance.js';
import {
  cashIncomeMeaning,
  cashRentMeaning,
  cashSaleMeaning,
  cashSentence,
  cashYearsMeaning,
  cocMeaning,
  leverageMeaning,
  offerMeaning,
  outrightCashMeaning,
  paybackMeaning,
} from '../lib/explain.js';
import { TONE_CLASSES } from '../lib/dscr.js';
import { money, percent } from '../lib/format.js';
import { UNIT_TYPES } from '../lib/presets.js';
import { Button, Card, ExampleTag, KpiTile, NumberField, signedClass } from '../components/ui.jsx';
import { InfoTip, Num } from '../components/motion.jsx';
import { Section } from '../components/Section.jsx';
import { TargetRow } from '../components/MaxOfferCard.jsx';
import TaxCard from '../components/TaxCard.jsx';

const YEARS = 10;
const TONE_GLOW = {
  bad: 'from-red-500/30 via-rose-400/10',
  warn: 'from-amber-400/30 via-yellow-300/10',
  good: 'from-emerald-400/35 via-teal-300/10',
};

const yearsText = (y) => (y == null ? 'Never' : `${y < 10 ? y.toFixed(1) : Math.round(y)} years`);

/** How an all-cash deal stacks up against your cash-on-cash target. */
function cashVerdict(c, targets) {
  if (c.netCashFlow < 0) return { tone: 'bad', icon: XCircle, label: 'Loses money even with no loan' };
  if (!targets.useCoc) return { tone: 'good', icon: CheckCircle2, label: 'Pays you an income' };
  return c.coc * 100 >= Number(targets.coc)
    ? { tone: 'good', icon: CheckCircle2, label: `Beats your ${Number(targets.coc)}% target` }
    : { tone: 'warn', icon: AlertTriangle, label: `Below your ${Number(targets.coc)}% target` };
}

function CashSummary({ deal, c, targets }) {
  const v = cashVerdict(c, targets);
  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const facts = [money(c.price), type?.key === 'multiplex' ? `Multiplex, ${c.units} units` : type?.label, `${money(c.grossRent)}/mo rent`, deal.country === 'ca' && 'Ontario rules'].filter(Boolean);
  return (
    <Card id="cash-summary" className="relative overflow-hidden">
      <div aria-hidden className={`pointer-events-none absolute -top-40 -right-24 size-[28rem] rounded-full bg-radial ${TONE_GLOW[v.tone]} to-transparent to-70% blur-2xl`} />
      <div className="relative px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="eyebrow">Bought with your own money</p>
            <h3 className="mt-1 flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
              <span className="truncate">{deal.name}</span>
              {deal.example && <ExampleTag />}
            </h3>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset backdrop-blur ${TONE_CLASSES[v.tone]}`}>
            <v.icon className="size-4" aria-hidden />
            {v.label}
          </span>
        </div>
        <p className="tabular mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{facts.join(' · ')}</p>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed font-medium text-zinc-900 sm:text-base dark:text-zinc-100">{cashSentence(c)}</p>
      </div>
      <dl className="relative mt-5 grid grid-cols-2 border-t border-hairline lg:grid-cols-4">
        <KpiTile
          label="Monthly income"
          tip="allCash"
          value={
            <>
              <Num value={c.netCashFlow} format={(x) => money(x, { signed: true })} />
              <span className="ml-1 text-sm font-medium tracking-normal text-zinc-500 dark:text-zinc-400">/mo</span>
            </>
          }
          valueClass={signedClass(c.netCashFlow)}
          meaning={cashIncomeMeaning(c)}
        />
        <KpiTile label="Cash-on-cash return" tip="coc" value={<Num value={c.coc} format={(x) => percent(x, 1)} />} valueClass={signedClass(c.coc)} meaning={cocMeaning(c, targets)} />
        <KpiTile label="Cash you put in" tip="cashInvested" value={<Num value={c.cashInvested} format={(x) => money(x)} />} meaning={outrightCashMeaning(c)} />
        <KpiTile label="Money back in" tip="payback" value={yearsText(paybackYears(c))} meaning={paybackMeaning(c)} />
      </dl>
    </Card>
  );
}

/** Rent, then each cost of owning it outright, as a share of the rent. */
function RentSection({ deal, c }) {
  const costs = [
    ['Property taxes', c.taxes],
    ['Insurance', c.insurance],
    ...(c.hoa > 0 ? [[deal.country === 'ca' ? 'Condo fees & utilities' : 'HOA', c.hoa]] : []),
    ['Property management', c.opex.management],
    ['Maintenance & repairs', c.opex.maintenance],
    ['Vacancy reserve', c.opex.vacancy],
    ['CapEx reserve', c.opex.capex],
  ];
  const share = (v) => (c.grossRent > 0 ? `${Math.min(Math.abs(v) / c.grossRent, 1) * 100}%` : '0%');
  return (
    <Section
      id="cash-rent"
      icon={Scale}
      title="Where the rent goes"
      value={`${money(c.netCashFlow, { signed: true })}/mo`}
      valueClass={signedClass(c.netCashFlow)}
      meaning={cashRentMeaning(c)}
      subtitle="Bought outright, the only costs are the ones that come with owning the property."
    >
      <div className="grid gap-1 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Rent</span>
          <span className="tabular text-sm text-zinc-700 dark:text-zinc-300">{money(c.grossRent)}</span>
          <div className="col-span-2 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
        </div>
        {costs.map(([label, v]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1">
            <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
            <span className="tabular text-sm text-zinc-700 dark:text-zinc-300">−{money(v)}</span>
            <div className="col-span-2 h-1.5 rounded-full bg-well">
              <div className="h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" style={{ width: share(v) }} />
            </div>
          </div>
        ))}
        <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-2">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Left for you each month</span>
          <span className={`tabular text-lg font-semibold ${signedClass(c.netCashFlow)}`}>{money(c.netCashFlow, { signed: true })}</span>
        </div>
      </div>
    </Section>
  );
}

/** The same deal two ways: all cash, or with the financing in its inputs. */
function LeverageSection({ deal, c, loan, cashSale, loanSale }) {
  const k = loanConstant(loan);
  const rows = [
    ['Cash you put in', money(c.cashInvested), money(loan.cashInvested)],
    ['Lender reserves to hold', '—', money(loan.reserves)],
    ['Monthly cash flow', money(c.netCashFlow, { signed: true }), money(loan.netCashFlow, { signed: true }), [c.netCashFlow, loan.netCashFlow]],
    ['Cash-on-cash return', percent(c.coc, 1), percent(loan.coc, 1), [c.coc, loan.coc]],
    [`Profit if sold in year ${YEARS}`, money(cashSale.profit, { signed: true }), money(loanSale.profit, { signed: true }), [cashSale.profit, loanSale.profit]],
    ['Yearly return to then (IRR)', Number.isFinite(cashSale.irr) ? percent(cashSale.irr, 1) : '—', Number.isFinite(loanSale.irr) ? percent(loanSale.irr, 1) : '—', [cashSale.irr, loanSale.irr]],
  ];
  return (
    <Section
      id="cash-leverage"
      icon={ArrowLeftRight}
      title="Cash or a mortgage?"
      value={k == null ? null : `${percent(c.coc, 1)} vs ${percent(loan.coc, 1)}`}
      meaning={leverageMeaning(c, loan)}
      subtitle={k == null ? undefined : `With a mortgage means the financing in this deal’s inputs: ${Number(deal.downPct)}% down at ${Number(deal.rate)}% over ${deal.termYears} years.`}
    >
      {k != null && (
        <div className="p-4 sm:p-5">
          <table className="w-full text-sm">
            <caption className="sr-only">This deal bought with all cash, and with a mortgage</caption>
            <thead>
              <tr className="eyebrow">
                <th scope="col" className="py-1.5 text-left font-medium">
                  <span className="sr-only">Measure</span>
                </th>
                <th scope="col" className="py-1.5 pl-2 text-right font-medium">All cash</th>
                <th scope="col" className="py-1.5 pl-2 text-right font-medium">Mortgage</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map(([label, cash, mortgage, raw]) => (
                <tr key={label} className="border-t border-hairline">
                  <th scope="row" className="py-2 text-left font-normal text-zinc-700 dark:text-zinc-300">{label}</th>
                  <td className={`py-2 pl-2 text-right font-medium whitespace-nowrap ${raw ? signedClass(raw[0]) : 'text-zinc-900 dark:text-zinc-100'}`}>{cash}</td>
                  <td className={`py-2 pl-2 text-right font-medium whitespace-nowrap ${raw ? signedClass(raw[1]) : 'text-zinc-900 dark:text-zinc-100'}`}>{mortgage}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            A year of this loan’s payments costs {percent(k, 1)} of what you’d borrow.
            <InfoTip k="loanConstant" />
          </p>
        </div>
      )}
    </Section>
  );
}

/** The most to pay in cash and still hit your cash-on-cash and per-door targets. */
function CashOfferSection({ deal, targets, onTargets, onUsePrice }) {
  const asking = Number(deal.price) || 0;
  const m = useMemo(() => maxOffer(allCash(deal), { ...targets, useDscr: false }), [deal, targets]);
  const finite = m.price != null && m.feasible && Number.isFinite(m.price);
  const rounded = finite ? Math.floor(m.price / 500) * 500 : null;
  return (
    <Section
      id="cash-offer"
      icon={Target}
      title="Most you should pay in cash"
      value={m.price == null || !m.feasible ? null : finite ? money(m.price) : 'No limit'}
      meaning={offerMeaning(m, asking)}
      subtitle="The highest cash price that still hits your targets. There’s no lender, so the DSCR target doesn’t apply."
    >
      <div className="grid gap-5 p-5 @3xl:grid-cols-2">
        <div className="grid content-start gap-2">
          <TargetRow id={`${deal.id}-ct-coc`} on={targets.useCoc} onToggle={(v) => onTargets({ useCoc: v })}>
            <NumberField id={`${deal.id}-ct-coc`} label="Cash-on-cash at least" tip="coc" suffix="%" value={targets.coc} onChange={(v) => onTargets({ coc: v })} max={100} step={0.5} decimals={2} />
          </TargetRow>
          <TargetRow id={`${deal.id}-ct-cf`} on={targets.useCashFlow} onToggle={(v) => onTargets({ useCashFlow: v })}>
            <NumberField
              id={`${deal.id}-ct-cf`}
              label="Income per door at least"
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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/5 to-transparent p-6 ring-1 ring-emerald-600/15 ring-inset dark:from-emerald-400/15 dark:ring-emerald-300/15">
            <div className="eyebrow">Pay up to, in cash</div>
            <div className="mt-1.5 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
              <Num value={m.price} format={(v) => money(v)} />
            </div>
            <p className={`tabular mt-2 text-sm font-medium ${m.price >= asking ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {m.price >= asking ? `Asking works, with ${money(m.price - asking)} of room` : `${money(asking - m.price)} under asking (${percent((m.price - asking) / asking, 1)})`}
            </p>
            {Math.abs(rounded - asking) >= 500 && (
              <Button variant="primary" className="mt-4" onClick={() => onUsePrice(rounded)}>
                <ArrowDownToLine className="size-4" aria-hidden /> Use {money(rounded)} as the price
              </Button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

/** Income year by year, how much of your cash it has paid back, and a sale at the end. */
function YearsSection({ deal, c, rows, sale }) {
  return (
    <Section
      id="cash-years"
      icon={CalendarClock}
      title={`Income over ${rows.length} years`}
      value={money(rows[rows.length - 1].cumCashFlow, { signed: true })}
      valueClass={signedClass(rows[rows.length - 1].cumCashFlow)}
      meaning={cashYearsMeaning(c, rows, deal.rentGrowthPct)}
    >
      <div tabIndex={0} role="region" aria-label="Income by year" className="thin-scroll overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500">
        <table className="w-full text-sm">
          <caption className="sr-only">Income by year, bought outright</caption>
          <thead>
            <tr className="eyebrow">
              {['Year', 'Income', 'So far', 'Cash back'].map((h, i) => (
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

/** Every deal in the library, ranked by what it would pay on cash. */
function DealRanking({ items, activeId, onSelect }) {
  const ranked = useMemo(
    () =>
      items
        .map((x) => {
          const c = analyzeDeal(allCash(x.deal));
          return { deal: x.deal, c, years: paybackYears(c) };
        })
        .sort((p, q) => q.c.coc - p.c.coc),
    [items],
  );
  const top = ranked[0];
  return (
    <Section
      id="cash-deals"
      icon={ListOrdered}
      title="Your deals, bought outright"
      value={`${ranked.length} ${ranked.length === 1 ? 'deal' : 'deals'}`}
      meaning={top ? `${top.deal.name} would pay the most on your cash: ${percent(top.c.coc, 1)} a year.` : null}
      subtitle="Tap one to see it here."
    >
      <ol aria-label="Deals by cash-on-cash return, bought outright">
        {ranked.map(({ deal, c, years }, i) => (
          <li key={deal.id} className="border-t border-hairline first:border-t-0">
            <button
              type="button"
              onClick={() => onSelect(deal.id)}
              aria-current={deal.id === activeId ? 'true' : undefined}
              className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-zinc-950/[0.025] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 dark:hover:bg-white/[0.03] ${
                deal.id === activeId ? 'bg-emerald-500/[0.06]' : ''
              }`}
            >
              <span aria-hidden className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-zinc-950/[0.05] text-xs font-semibold text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
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
 * The Cash tab: any deal bought outright with your own money. No loan means
 * no lender and no DSCR, only the income the property pays on your cash.
 */
export default function CashView({ deal, items, targets, onTargets, tax, onTax, onSelect, onUsePrice }) {
  const cashDeal = useMemo(() => allCash(deal), [deal]);
  const c = useMemo(() => analyzeDeal(cashDeal), [cashDeal]);
  const loan = useMemo(() => analyzeDeal(deal), [deal]);
  const rows = useMemo(() => projectDeal(cashDeal, YEARS), [cashDeal]);
  const cashSale = useMemo(() => saleAnalysis(cashDeal, rows), [cashDeal, rows]);
  const loanSale = useMemo(() => saleAnalysis(deal, projectDeal(deal, YEARS)), [deal]);

  return (
    <div className="space-y-6">
      <div className="rise px-1 pt-1">
        <p className="eyebrow">Own money · no loan</p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">What your cash earns</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Any deal, bought outright with your own money. No mortgage means no lender and no DSCR: only the income the property pays on the cash you put in.
        </p>
      </div>

      <CashSummary deal={deal} c={c} targets={targets} />

      <div className="space-y-3">
        <RentSection deal={deal} c={c} />
        <LeverageSection deal={deal} c={c} loan={loan} cashSale={cashSale} loanSale={loanSale} />
        <CashOfferSection deal={deal} targets={targets} onTargets={onTargets} onUsePrice={onUsePrice} />
        <YearsSection deal={deal} c={c} rows={rows} sale={cashSale} />
        <TaxCard id="cash-tax" deal={cashDeal} tax={tax} onTax={onTax} />
        <DealRanking items={items} activeId={deal.id} onSelect={onSelect} />
      </div>
    </div>
  );
}
