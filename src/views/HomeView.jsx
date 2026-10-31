import { useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { RULES, RULES_CHECKED, benefits, buyCheck, liveIn, localFor, maxPrice, monthsToSave } from '../lib/firstHome.js';
import { SUITE_KINDS, SUITE_RULES_CHECKED, allowedFor, moneyFor, stepsFor, suitePayback } from '../lib/suites.js';
import { cityByKey, guessCity, provinceName } from '../lib/canada.js';
import { dealPlace } from '../lib/finance.js';
import { money, percent } from '../lib/format.js';
import { INSURANCE_MIN } from '../lib/market.js';
import { Button, Card, CardHeader, LedgerHeading, LedgerLine, NumberField, Segmented, SelectField, SummaryCard, ViewHeader, signedClass } from '../components/ui.jsx';
import { Section, SectionGroup } from '../components/Section.jsx';
import CitySelect from '../components/CitySelect.jsx';
import { BrokerForm, ReadyChecklist, RentVsBuy } from './HomeExtras.jsx';

const checkedOn = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
const monthFrom = (months) => new Date(new Date().getFullYear(), new Date().getMonth() + months, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
const KIND = { 1: 'a house', 2: 'a duplex', 3: 'a triplex', 4: 'a fourplex' };
// "Elsewhere in Ontario" reads as "Ontario" in a sentence.
const placeName = (c) => c.name.replace(/^Elsewhere in /, '');

function Source({ url, children = 'Source' }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:text-emerald-300"
    >
      {children} <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const yesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** Your numbers: what a lender and the savings plan need to know. */
function Profile({ p, onHome }) {
  const f = (key, props) => <NumberField id={`home-${key}`} value={p[key]} onChange={(v) => onHome({ [key]: v, entered: true })} {...props} />;
  const local = localFor(p);
  const reset = (key, words) => (
    <button type="button" onClick={() => onHome({ [key]: null })} className="mt-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400">
      Use {words}
    </button>
  );
  return (
    <Card>
      <CardHeader title="Your numbers" subtitle="Saved with your deals. Only you see them." />
      <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
        <div className="col-span-2">
          <CitySelect id="home-city" value={local.city.key} onChange={(city) => onHome({ city, rentOther: null, taxPct: null, targetPrice: cityByKey(city).price, entered: true })} />
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Sets {provinceName(local.province)}’s land transfer tax and programs, and the local rent and property tax.</p>
        </div>
        <div>
          <NumberField
            id="home-rentOther"
            label="Rent a second unit gets"
            prefix="$"
            suffix="/mo"
            step={25}
            decimals={0}
            value={local.rent}
            onChange={(v) => onHome({ rentOther: v, entered: true })}
            hint={local.rentIsAverage ? `${placeName(local.city)} average, 2 bedrooms${local.city.rentEstimated ? ' (estimate)' : ''}` : undefined}
          />
          {!local.rentIsAverage && reset('rentOther', `the ${placeName(local.city)} average`)}
        </div>
        <div>
          <NumberField
            id="home-taxPct"
            label="Property tax"
            suffix="% a year"
            step={0.05}
            decimals={2}
            value={local.taxPct}
            onChange={(v) => onHome({ taxPct: v, entered: true })}
            hint={local.taxIsTypical ? `Of the price; typical for ${placeName(local.city)}` : undefined}
          />
          {!local.taxIsTypical && reset('taxPct', 'the typical rate')}
        </div>
        {f('income', { label: 'Household income', prefix: '$', suffix: '/yr', step: 1000, decimals: 0, hint: 'Before tax, everyone buying' })}
        {f('savings', { label: 'Saved for buying', prefix: '$', step: 1000, decimals: 0 })}
        {f('monthlySave', { label: 'You can save', prefix: '$', suffix: '/mo', step: 50, decimals: 0 })}
        {f('rentNow', { label: 'Rent you pay now', prefix: '$', suffix: '/mo', step: 50, decimals: 0 })}
        {f('debts', { label: 'Debt payments', prefix: '$', suffix: '/mo', step: 25, decimals: 0, hint: 'Car, student loan, cards' })}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">First home?</span>
          <Segmented size="sm" label="First home?" value={p.firstTime ? 'yes' : 'no'} onChange={(v) => onHome({ firstTime: v === 'yes' })} options={yesNo} />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Buying new-built?</span>
          <Segmented size="sm" label="Buying new-built?" value={p.newBuild ? 'yes' : 'no'} onChange={(v) => onHome({ newBuild: v === 'yes' })} options={yesNo} />
        </div>
      </div>
    </Card>
  );
}

/** One way to buy, as a ledger: the most you can pay and what it takes. */
function BuyLedger({ title, p, units, ratePct, taxPct, rentEach, insuranceMonthly }) {
  const m = maxPrice({ profile: p, units, ratePct, taxPct, rentPerOtherUnit: rentEach });
  const price = m.price;
  const c = buyCheck({ profile: p, price, units, ratePct, taxesMonthly: (price * taxPct) / 1200, rentFromOthers: rentEach * (units - 1) });
  const taxes = (price * taxPct) / 1200;
  const live = c.plan.payment + taxes + insuranceMonthly + RULES.heatMonthly - rentEach * (units - 1);
  return (
    <div>
      <LedgerHeading>{title}</LedgerHeading>
      <LedgerLine label="Most you could pay" value={price > 0 ? money(price) : 'Not yet'} valueClass="text-zinc-950 dark:text-white" />
      <LedgerLine label="Held back by" value={m.limit === 'income' ? 'your income' : 'your savings'} muted />
      <LedgerLine label={`Down payment, ${price > 0 ? percent(c.down / price, 0) : '5%'}`} value={money(c.down)} />
      <LedgerLine label="Closing costs" tip="landTransferTax" value={money(c.closing.total)} />
      <LedgerLine label="Mortgage payment" tip="mortgagePayment" value={`${money(c.plan.payment)}/mo`} />
      {units > 1 && <LedgerLine label={`Rent from ${units === 2 ? 'the other unit' : `the other ${units - 1} units`}`} value={`${money(-rentEach * (units - 1))}`} />}
      <LedgerLine
        label="Costs you each month"
        value={`${money(live)}/mo`}
        valueClass={`text-lg ${live <= p.rentNow ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'}`}
        total
      />
      <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
        Mortgage, tax, insurance and heat{units > 1 ? ', less the rent' : ''}. You pay {money(p.rentNow)}/mo now.
      </p>
    </div>
  );
}

function Benefits({ b }) {
  return (
    <div className="grid gap-4 p-5 @3xl:grid-cols-2">
      {b.list.map((x) => (
        <div key={x.key} className="rounded-md border border-hairline p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{x.name}</h3>
            <span className="tabular shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {x.amount > 0 ? `${money(x.amount)}${x.per === 'a year' ? '/yr' : ''}` : x.access ? `Up to ${money(x.access)}` : 'Ask your lender'}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{x.what}</p>
          <div className="mt-2">
            <Source url={x.url}>How it works</Source>
          </div>
        </div>
      ))}
    </div>
  );
}

function Path({ p, onHome, ratePct, taxPct, rentEach }) {
  const units = p.targetUnits;
  const c = buyCheck({ profile: p, price: p.targetPrice, units, ratePct, taxesMonthly: (p.targetPrice * taxPct) / 1200, rentFromOthers: rentEach * (units - 1) });
  const months = monthsToSave({ profile: p, target: c.cashNeeded });
  return (
    <div className="grid gap-6 p-5 @3xl:grid-cols-2">
      <div className="grid content-start grid-cols-2 gap-3">
        <NumberField id="home-target" label="The home you’re saving for" prefix="$" value={p.targetPrice} onChange={(v) => onHome({ targetPrice: v })} step={5000} decimals={0} />
        <SelectField id="home-units" label="Type" value={units} onChange={(e) => onHome({ targetUnits: Number(e.target.value) })}>
          {[1, 2, 3, 4].map((u) => (
            <option key={u} value={u}>
              {['House', 'Duplex', 'Triplex', 'Fourplex'][u - 1]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="text-sm">
        <LedgerHeading>To buy {KIND[units]} at {money(p.targetPrice)}</LedgerHeading>
        <LedgerLine label="Down payment" value={money(c.down)} />
        <LedgerLine label="Closing costs" value={money(c.closing.total)} />
        <LedgerLine label="Cash you need" value={money(c.cashNeeded)} sum />
        <LedgerLine label="You have" value={money(-p.savings)} />
        <LedgerLine label="Still to save" value={money(c.shortCash)} sum />
        <LedgerLine
          label="Ready by"
          value={months === 0 ? 'Now' : months == null ? 'Save more each month' : monthFrom(months)}
          valueClass={`text-lg ${months === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'}`}
          total
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Saving {money(p.monthlySave)} a month{p.firstTime ? ' in an FHSA, with each spring’s tax refund added back' : ''}.{' '}
          {c.qualify.pass ? 'Your income would qualify for it.' : 'Your income wouldn’t qualify for it yet: look at a cheaper home, more units, or less debt.'}
        </p>
      </div>
    </div>
  );
}

function LiveInDeal({ p, items, dealId, onPick, ratePct, onOpen }) {
  const item = items.find((x) => x.deal.id === dealId) ?? items[0];
  const deal = item.deal;
  const units = Math.min(Math.max(Math.round(Number(deal.units) || 1), 1), 4);
  const rentFromOthers = (Number(deal.rentPerUnit) || 0) * (units - 1);
  // A Canadian deal's own place sets its transfer tax; a US one is priced as if it were where you're buying.
  const city = deal.country === 'ca' ? dealPlace(deal).key : p.city;
  const c = buyCheck({ profile: p, price: Number(deal.price) || 0, units, ratePct, taxesMonthly: (Number(deal.taxesAnnual) || 0) / 12, rentFromOthers, city });
  const l = liveIn({ deal: { ...deal, units }, payment: c.plan.payment });
  const save = p.rentNow - l.costToLive;
  const reasons = [
    !c.qualify.pass && `the payments would take ${percent(c.qualify.tds, 0)} of your income (lenders allow ${percent(RULES.tds, 0)})`,
    c.shortCash > 0 && `you’re ${money(c.shortCash)} short of the cash it takes`,
  ].filter(Boolean);
  return (
    <div className="grid gap-6 p-5 @3xl:grid-cols-2">
      <div className="grid content-start gap-3">
        <SelectField id="home-deal" label="Deal" value={deal.id} onChange={(e) => onPick(e.target.value)}>
          {items.map((x) => (
            <option key={x.deal.id} value={x.deal.id}>
              {x.deal.name}
            </option>
          ))}
        </SelectField>
        <p className={`flex items-start gap-1.5 text-[15px] font-semibold ${c.canBuy ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
          {c.canBuy ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {c.canBuy ? 'You could buy this one' : `Not yet: ${reasons.join(', and ')}`}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {units > 1
            ? `Live in one unit and rent the other${units > 2 ? 's' : ''}. Lenders count ${units === 2 ? 'all' : 'half'} of that rent as your income.`
            : 'A one-unit home: no rent coming in, so the full cost is yours.'}
        </p>
        <Button className="justify-self-start" onClick={() => onOpen(deal.id)}>
          Open the full analysis <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="text-sm">
        <LedgerHeading>Each month, living there</LedgerHeading>
        <LedgerLine label={`Mortgage, ${money(c.down)} down`} tip="mortgagePayment" value={money(l.payment)} />
        <LedgerLine label="Property tax and insurance" value={money(l.taxes + l.insurance)} />
        {l.utilities > 0 && <LedgerLine label="Utilities you pay" value={money(l.utilities)} />}
        <LedgerLine label="Repairs and empty months" value={money(l.setAside)} />
        {l.rentIn > 0 && <LedgerLine label="Rent coming in" value={money(-l.rentIn)} />}
        <LedgerLine label="Your cost to live there" value={`${money(l.costToLive)}/mo`} valueClass="text-xl text-zinc-950 dark:text-white" total />
        <LedgerLine
          label="Versus your rent now"
          value={`${money(save, { signed: true })}/mo`}
          valueClass={signedClass(save)}
        />
      </div>
    </div>
  );
}

function SuiteGuide({ s, onSuite, city }) {
  const kind = SUITE_KINDS.find((k) => k.key === s.kind);
  const place = cityByKey(city);
  const STEPS = stepsFor(place.key);
  const pay = suitePayback({ buildCost: s.buildCost, rent: s.rent, borrowPct: s.borrowPct });
  const done = new Set(s.done);
  const toggle = (key) => onSuite({ done: done.has(key) ? s.done.filter((k) => k !== key) : [...s.done, key] });
  return (
    <div className="grid gap-8 p-5 @3xl:grid-cols-2">
      <div className="grid content-start gap-5">
        <Segmented label="What you’d build" value={s.kind} onChange={(kind) => onSuite({ kind })} options={SUITE_KINDS.map((k) => ({ value: k.key, label: k.label }))} />
        <div>
          <LedgerHeading>What’s allowed</LedgerHeading>
          <ul className="grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            {allowedFor(place.key).map((a) => (
              <li key={a.text}>
                {a.text} <Source url={a.url} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <LedgerHeading aside={`${done.size} of ${STEPS.length} done`}>Steps to a legal unit</LedgerHeading>
          <ol className="grid gap-3">
            {STEPS.map((step, i) => (
              <li key={step.key} className="flex gap-3">
                <input
                  id={`suite-${step.key}`}
                  type="checkbox"
                  checked={done.has(step.key)}
                  onChange={() => toggle(step.key)}
                  className="mt-0.5 size-4 shrink-0 accent-emerald-600"
                />
                <div className="min-w-0">
                  <label htmlFor={`suite-${step.key}`} className={`block text-sm font-semibold ${done.has(step.key) ? 'text-zinc-500 line-through dark:text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                    {i + 1}. {step.title}
                  </label>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{step.body}</p>
                  <Source url={step.url}>City page</Source>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="grid content-start gap-5">
        <div className="text-sm">
          <LedgerHeading>Does {kind.words} pay for itself?</LedgerHeading>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <NumberField id="suite-cost" label="Cost to build" prefix="$" value={s.buildCost} onChange={(v) => onSuite({ buildCost: v })} step={5000} decimals={0} />
            <NumberField id="suite-rent" label="Rent" prefix="$" suffix="/mo" value={s.rent} onChange={(v) => onSuite({ rent: v })} step={50} decimals={0} />
            <NumberField id="suite-borrow" label="Borrowed" suffix="%" value={s.borrowPct} onChange={(v) => onSuite({ borrowPct: v })} max={100} step={10} decimals={0} />
          </div>
          <LedgerLine label="Rent, less empty months and upkeep" value={`${money(pay.netRent)}/mo`} />
          {pay.borrowed > 0 && <LedgerLine label={`Payment on ${money(pay.borrowed)} borrowed`} value={`${money(-pay.payment)}/mo`} />}
          <LedgerLine label="In your pocket" value={`${money(pay.monthly, { signed: true })}/mo`} valueClass={`text-lg ${signedClass(pay.monthly)}`} total />
          <LedgerLine label="Your cash back in" value={pay.cashIn === 0 ? 'None put in' : pay.paybackYears == null ? 'Never' : `${pay.paybackYears.toFixed(1)} years`} />
        </div>
        <div>
          <LedgerHeading>Money for building</LedgerHeading>
          <ul className="grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            {moneyFor(place.key).map((m) => (
              <li key={m.text}>
                {m.text} <Source url={m.url} />
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Checked {checkedOn(SUITE_RULES_CHECKED)}. Rules and grants change: confirm with {place.key.endsWith('-other') ? 'your city’s' : `the City of ${place.name}’s`} building department before you build.</p>
      </div>
    </div>
  );
}

/**
 * First visit: where, and four numbers, before any result, so the first
 * number a person sees is about them.
 */
function Start({ onHome }) {
  const [v, setV] = useState({ income: null, savings: null, debts: null, rentNow: null });
  const [city, setCity] = useState(guessCity);
  const [missing, setMissing] = useState([]);
  const set = (key) => (n) => {
    setV((x) => ({ ...x, [key]: n }));
    setMissing((m) => m.filter((k) => k !== key));
  };
  const submit = (e) => {
    e.preventDefault();
    const gaps = ['income', 'savings', 'rentNow'].filter((k) => !Number.isFinite(v[k]));
    if (gaps.length) {
      setMissing(gaps);
      document.getElementById(`start-${gaps[0]}`)?.focus();
      return;
    }
    onHome({ city, rentOther: null, taxPct: null, targetPrice: cityByKey(city).price, income: v.income, savings: v.savings, debts: Number.isFinite(v.debts) ? v.debts : 0, rentNow: v.rentNow, entered: true });
  };
  const label = { income: 'your income', savings: 'what you’ve saved', rentNow: 'the rent you pay' };
  return (
    <Card>
      <form onSubmit={submit} noValidate aria-labelledby="start-title">
        <div className="border-b border-hairline px-5 py-5 sm:px-6">
          <h2 id="start-title" className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
            Five questions, then your answer
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            What a bank would lend you, alone and with a tenant, and what it would cost you each month. Your answers stay in this browser.
          </p>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div className="sm:col-span-2">
            <CitySelect id="start-city" label="Where are you buying?" value={city} onChange={setCity} />
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Land transfer tax, provincial programs, rent and property tax all depend on it.</p>
          </div>
          <NumberField id="start-income" label="Household income, before tax" prefix="$" suffix="/yr" step={1000} decimals={0} value={v.income} onChange={set('income')} hint="Everyone who’ll be on the mortgage" />
          <NumberField id="start-savings" label="Saved for buying" prefix="$" step={1000} decimals={0} value={v.savings} onChange={set('savings')} hint="Bank, TFSA, FHSA, RRSP: anything for the down payment" />
          <NumberField id="start-rentNow" label="Rent you pay now" prefix="$" suffix="/mo" step={50} decimals={0} value={v.rentNow} onChange={set('rentNow')} hint="Your share, if you split it" />
          <NumberField id="start-debts" label="Monthly debt payments" prefix="$" suffix="/mo" step={25} decimals={0} value={v.debts} onChange={set('debts')} hint="Car, student loan, card minimums. Leave blank if none" />
        </div>
        <div className="flex flex-col gap-3 border-t border-hairline px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {missing.length > 0 && `Add ${missing.map((k) => label[k]).join(', ').replace(/, ([^,]*)$/, ' and $1')} to see your answer.`}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button type="submit" variant="primary">
              See what I can buy <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/**
 * The Home tab: for someone buying their first home. What you could buy on
 * your own or with a tenant, the government money you can get, when you'll
 * be ready, what living in one of your deals would cost, and how to add a
 * rental unit through the permits.
 */
export default function HomeView({ profile: p, suite, ready = {}, rvb = {}, market, items, liveDealId, onHome, onSuite, onReady, onRvb, onPickDeal, onOpen }) {
  const ratePct = Number(market.rate);
  // Rent for a second unit and property tax where the profile is buying (the city's, unless they set their own).
  const local = localFor(p);
  const taxPct = local.taxPct;
  const rentEach = local.rent;
  const insurance = (units) => Math.max((Number(market.insurancePerUnit) || 0) * units, INSURANCE_MIN) / 12;
  const b = useMemo(() => benefits({ profile: p, price: p.targetPrice, units: p.targetUnits }), [p]);
  const solo = maxPrice({ profile: p, units: 1, ratePct, taxPct });
  const duplex = maxPrice({ profile: p, units: 2, ratePct, taxPct, rentPerOtherUnit: rentEach });

  const header = (
    <ViewHeader title="Your first home">
      How close you are to owning {p.entered ? `in ${placeName(local.city)}` : 'a home anywhere in Canada'}, the money you can get, and how to make a home pay for itself. Estimates, not financial advice: a mortgage broker
      confirms the real numbers.
    </ViewHeader>
  );

  if (!p.entered) {
    return (
      <div className="space-y-6">
        {header}
        <Start onHome={onHome} />
        <SectionGroup>
          <Section id="home-suite" title="Add a suite or backyard home" meaning="Turn a house you own (or buy) into one that pays you rent: what’s allowed where you are, the permit steps, and whether it pays.">
            <SuiteGuide s={suite} onSuite={onSuite} city={guessCity()} />
          </Section>
        </SectionGroup>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <SummaryCard
        id="home-summary"
        head={
          <>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              {duplex.price > 0 ? `You could buy up to ${money(duplex.price)}` : 'Let’s get you ready to buy'}
            </h2>
            <p className="mt-4 flex items-start gap-1.5 text-[15px] font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              {duplex.price > solo.price ? `${money(duplex.price - solo.price)} more by renting out half a duplex` : 'Renting out a unit is your strongest lever'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              On your own, a bank would lend on about {money(solo.byIncome)}; with a tenant paying {money(rentEach)} a month, about {money(duplex.byIncome)}. Your savings cover
              the down payment and closing costs up to {money(duplex.bySavings)}. A typical house in {placeName(local.city)} sells for about {money(local.city.price)}
              {local.city.priceEstimated ? ' (estimate)' : ''}. And there’s about {money(b.total)} in government money you can claim.
            </p>
          </>
        }
      >
        <div className="grid gap-x-10 gap-y-6 text-sm sm:grid-cols-2">
          <BuyLedger title="A house, on your own" p={p} units={1} ratePct={ratePct} taxPct={taxPct} rentEach={0} insuranceMonthly={insurance(1)} />
          <BuyLedger title="A duplex, renting one unit" p={p} units={2} ratePct={ratePct} taxPct={taxPct} rentEach={rentEach} insuranceMonthly={insurance(2)} />
        </div>
      </SummaryCard>

      <Profile p={p} onHome={onHome} />

      <SectionGroup>
        <Section id="home-money" title="Money you can get" value={money(b.total)} valueClass="text-emerald-700 dark:text-emerald-400" meaning="Government programs for first-time buyers: tax refunds, rebates and access to your own RRSP." defaultOpen>
          <Benefits b={b} />
        </Section>
        <Section id="home-path" title="When you’ll be ready" meaning="How long until your savings cover the down payment and closing costs on the home you want.">
          <Path p={p} onHome={onHome} ratePct={ratePct} taxPct={taxPct} rentEach={rentEach} />
        </Section>
        <Section id="home-ready" title="Am I ready?" meaning="Every step from saving to closing day, with the ones your numbers already cover ticked for you.">
          <ReadyChecklist p={p} ready={ready} onReady={onReady} ratePct={ratePct} taxPct={taxPct} rentEach={rentEach} benefitsTotal={b.total} />
        </Section>
        <Section id="home-rvb" title="Rent or buy, over 10 years" meaning="What you’d be worth after ten years if you bought the home you’re aiming for, against renting and investing the difference.">
          <RentVsBuy p={p} rvb={rvb} onRvb={onRvb} ratePct={ratePct} taxPct={taxPct} rentEach={rentEach} insuranceMonthly={insurance(p.targetUnits)} />
        </Section>
        <Section id="home-live" title="Live in one of your deals" meaning="Could you buy it, and what would it cost you each month once the other units’ rent comes in?">
          <LiveInDeal p={p} items={items} dealId={liveDealId} onPick={onPickDeal} ratePct={ratePct} onOpen={onOpen} />
        </Section>
        <Section id="home-suite" title="Add a suite or backyard home" meaning="Turn a house you own (or buy) into one that pays you rent: what’s allowed where you are, the permit steps, and whether it pays.">
          <SuiteGuide s={suite} onSuite={onSuite} city={local.city.key} />
        </Section>
        <Section id="home-broker" title="Talk to a mortgage broker" meaning="Get pre-approved: a licensed broker compares lenders for you, free and with no obligation.">
          <BrokerForm p={p} maxPrice={duplex.price} />
        </Section>
      </SectionGroup>

      <p className="px-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Lending rules checked {checkedOn(RULES_CHECKED)}: 5% down on the first $500,000 and 10% above (10% on 3–4 units), insured below 20% down with a 30-year
        amortization for first-time buyers, the stress test at {RULES.minQualifyingRate}% or your rate plus 2, and debt limits of 39% and 44% of income. Rent counts: all of
        a second unit’s, half on three or four units. Uses the {ratePct}% rate and {taxPct}% property tax from your listing assumptions. A lender, a lawyer and the City
        decide the real answers.
      </p>
    </div>
  );
}
