import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Home, Tag } from 'lucide-react';
import Logo from './Logo.jsx';
import CitySelect from './CitySelect.jsx';
import { Button, NumberField, Segmented } from './ui.jsx';
import { cityByKey, guessCity } from '../lib/canada.js';
import { normalizeProfile } from '../lib/firstHome.js';
import { FINANCE, GOALS, PORTFOLIO, buyingRange, investingReach, startMode } from '../lib/onboarding.js';
import { INSURANCE_MIN } from '../lib/market.js';
import { money } from '../lib/format.js';

const ICONS = { buy: Home, invest: Building2, sell: Tag };
const UNITS = [
  { value: 1, label: 'House' },
  { value: 2, label: 'Duplex' },
  { value: 3, label: 'Triplex' },
  { value: 4, label: 'Fourplex' },
  { value: 5, label: '5+ units' },
];
const today = () => new Date().toISOString().slice(0, 10);
const given = (v) => v != null && Number.isFinite(Number(v));

/** A big tappable choice: a card with a check when picked. */
function Choice({ picked, onClick, title, hint, icon: Icon, role = 'checkbox' }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={picked}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl p-4 text-left ring-1 transition ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
        picked ? 'bg-emerald-500/[0.08] ring-emerald-600/50 dark:bg-[#73ff6a]/[0.07] dark:ring-[#73ff6a]/50' : 'ring-(--line-strong) hover:bg-well'
      }`}
    >
      {Icon && (
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${picked ? 'bg-emerald-600 text-white dark:bg-[#73ff6a] dark:text-black' : 'bg-well text-zinc-600 dark:text-zinc-300'}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-zinc-950 dark:text-white">{title}</span>
        {hint && <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">{hint}</span>}
      </span>
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-inset ${picked ? 'bg-emerald-600 text-white ring-emerald-600 dark:bg-[#73ff6a] dark:text-black dark:ring-[#73ff6a]' : 'ring-(--line-strong)'}`}>
        {picked && <Check className="size-3.5" aria-hidden />}
      </span>
    </button>
  );
}

/** A row of small pills for one answer out of a few. */
function Pills({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`tabular h-10 rounded-full px-4 text-sm font-semibold ring-1 transition ring-inset ${
            value === o.value ? 'bg-emerald-600 text-white ring-emerald-600 dark:bg-[#73ff6a] dark:text-black dark:ring-[#73ff6a]' : 'text-zinc-700 ring-(--line-strong) hover:bg-well dark:text-zinc-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Range({ label, value, sub, strong }) {
  return (
    <div className={`rounded-xl p-4 ring-1 ring-inset ${strong ? 'bg-emerald-500/[0.08] ring-emerald-600/30 dark:bg-[#73ff6a]/[0.06] dark:ring-[#73ff6a]/30' : 'ring-(--line-strong)'}`}>
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold tracking-tight ${strong ? 'text-emerald-800 dark:text-[#73ff6a]' : 'text-zinc-950 dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

/**
 * The first time someone opens the app with their new account: what they're
 * here for, then a few numbers, then their own ranges. Their answers fill in
 * the Buy, Invest and Sell tabs. Everything can be skipped and changed later.
 */
export default function Onboarding({ settings, onFinish, onSkip }) {
  const home = normalizeProfile(settings.home);
  const before = settings.onboarding ?? {};
  const [goals, setGoals] = useState(before.goals?.length ? before.goals : []);
  const [city, setCity] = useState(home.entered ? home.city : guessCity());
  const [buy, setBuy] = useState(() =>
    home.entered
      ? { firstTime: home.firstTime, income: home.income, savings: home.savings, rentNow: home.rentNow, debts: home.debts, living: home.living, monthlySave: home.monthlySave }
      : { firstTime: true, income: null, savings: null, rentNow: null, debts: null, living: null, monthlySave: null },
  );
  const [inv, setInv] = useState({ portfolio: before.portfolio ?? null, finance: before.finance ?? null, cash: before.investCash ?? null });
  const sellBefore = settings.sell ?? {};
  const [sell, setSell] = useState({ units: sellBefore.units ?? 1, price: sellBefore.price ?? null, mortgage: sellBefore.mortgage || null });
  const [step, setStep] = useState(0);
  const [missing, setMissing] = useState('');
  // The app behind stays still while the questions are open.
  useEffect(() => {
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = was;
    };
  }, []);

  const steps = useMemo(
    () => ['goals', 'where', ...(goals.includes('buy') ? ['money', 'monthly'] : []), ...(goals.includes('invest') ? ['portfolio'] : []), ...(goals.includes('sell') ? ['selling'] : []), 'result'],
    [goals],
  );
  const at = steps[Math.min(step, steps.length - 1)];
  const place = cityByKey(city);
  const market = settings.market ?? {};
  const ratePct = Number(market.rate) || 5;
  const insuranceMonthly = Math.max((Number(market.insurancePerUnit) || 0) * 1, INSURANCE_MIN) / 12;

  const profile = { ...settings.home, ...buy, debts: buy.debts ?? 0, city, entered: true };
  const range = goals.includes('buy') && given(buy.income) && given(buy.savings) ? buyingRange({ profile, living: buy.living, ratePct, insuranceMonthly }) : null;
  const reach = goals.includes('invest') ? investingReach({ cash: inv.cash, finance: inv.finance ?? 'bank', city }) : null;

  const toggleGoal = (g) => setGoals((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));
  const setB = (k) => (v) => (setBuy((b) => ({ ...b, [k]: v })), setMissing(''));

  const next = () => {
    if (at === 'goals' && !goals.length) return setMissing('Pick at least one, or skip for now.');
    if (at === 'money' && (!given(buy.income) || !given(buy.savings))) return setMissing('Add your household income and what you’ve saved, or skip for now.');
    setMissing('');
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => (setMissing(''), setStep((s) => Math.max(s - 1, 0)));

  const finish = () =>
    onFinish({
      onboarding: { done: true, skipped: false, at: today(), goals, portfolio: goals.includes('invest') ? inv.portfolio : null, investCash: goals.includes('invest') ? inv.cash : null, finance: goals.includes('invest') ? inv.finance : null },
      home: goals.includes('buy')
        ? {
            city,
            rentOther: null,
            taxPct: null,
            firstTime: buy.firstTime,
            income: buy.income,
            savings: buy.savings,
            rentNow: buy.rentNow ?? home.rentNow,
            debts: buy.debts ?? 0,
            living: buy.living ?? null,
            ...(given(buy.monthlySave) ? { monthlySave: buy.monthlySave } : {}),
            targetPrice: range?.comfortable || range?.max || place.price,
            entered: true,
          }
        : home.entered
          ? null
          : { city, targetPrice: place.price },
      market: { listingCity: city, ...(goals.includes('invest') && inv.finance ? { lens: inv.finance === 'dscr' ? 'dscr' : 'own' } : {}) },
      sell: goals.includes('sell') ? { city, units: sell.units, price: sell.price ?? null, mortgage: sell.mortgage ?? 0 } : null,
      mode: startMode(goals),
    });

  const title = {
    goals: 'What brings you to Squarely?',
    where: 'Where are you looking?',
    money: 'Your money, roughly',
    monthly: 'Each month',
    portfolio: 'Your rentals',
    selling: 'What you’re selling',
    result: 'Here’s where you stand',
  }[at];
  const sub = {
    goals: 'Pick all that apply. It sets up the app around what you want to do.',
    where: 'Prices, rents, property tax and land transfer tax all depend on it.',
    money: 'Close is fine. Only you see these, and you can change them any time.',
    monthly: 'What you spend now tells us what you can afford comfortably, not just what a bank would lend.',
    portfolio: 'So the numbers fit where you are, whether it’s your first rental or your hundredth.',
    selling: 'We’ll estimate what it’s worth from listings near you and what you’d walk away with.',
    result: 'Estimates from today’s rates and your answers. You’ll find the full workings in the app.',
  }[at];

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-(--page)" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="hero-backdrop pointer-events-none fixed inset-0" aria-hidden />
      <div className="relative mx-auto flex min-h-full max-w-xl flex-col px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between">
          <Logo />
          <button type="button" onClick={onSkip} className="rounded-md px-2 py-1 text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white">
            Skip for now
          </button>
        </div>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-zinc-950/[0.07] dark:bg-white/[0.08]" role="progressbar" aria-label="Setup" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
          <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 dark:bg-[#73ff6a]" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <p className="tabular mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {step + 1} of {steps.length}
        </p>

        <h1 id="ob-title" className="mt-4 text-2xl font-bold tracking-tight text-balance text-zinc-950 sm:text-3xl dark:text-white">
          {title}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{sub}</p>

        <div className="mt-6 flex-1 space-y-4">
          {at === 'goals' && (
            <div className="space-y-3" role="group" aria-label="What you’re here for">
              {GOALS.map((g) => (
                <Choice key={g.value} picked={goals.includes(g.value)} onClick={() => toggleGoal(g.value)} title={g.label} hint={g.hint} icon={ICONS[g.value]} />
              ))}
            </div>
          )}

          {at === 'where' && <CitySelect id="ob-city" label="City" value={city} onChange={setCity} />}

          {at === 'money' && (
            <>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Have you owned a home before?</p>
                <Segmented
                  label="Owned a home before"
                  value={buy.firstTime ? 'no' : 'yes'}
                  onChange={(v) => setB('firstTime')(v === 'no')}
                  options={[
                    { value: 'no', label: 'No, this is my first' },
                    { value: 'yes', label: 'Yes' },
                  ]}
                />
              </div>
              <NumberField id="ob-income" label="Household income, before tax" prefix="$" suffix="/yr" step={1000} decimals={0} value={buy.income} onChange={setB('income')} hint="Everyone who’ll be on the mortgage" />
              <NumberField id="ob-savings" label="Saved for buying" prefix="$" step={1000} decimals={0} value={buy.savings} onChange={setB('savings')} hint="Bank, TFSA, FHSA, RRSP: anything for the down payment and closing" />
            </>
          )}

          {at === 'monthly' && (
            <>
              <NumberField id="ob-living" label="Everyday costs" prefix="$" suffix="/mo" step={100} decimals={0} value={buy.living} onChange={setB('living')} hint="Groceries, car and gas, phone, insurance, childcare, fun. Not rent, not debt payments" />
              <NumberField id="ob-debts" label="Debt payments" prefix="$" suffix="/mo" step={25} decimals={0} value={buy.debts} onChange={setB('debts')} hint="Car loan, student loan, card minimums. Blank if none" />
              <NumberField id="ob-rent" label="Rent you pay now" prefix="$" suffix="/mo" step={50} decimals={0} value={buy.rentNow} onChange={setB('rentNow')} hint="Your share, if you split it" />
              <NumberField id="ob-save" label="You could save each month" prefix="$" suffix="/mo" step={50} decimals={0} value={buy.monthlySave} onChange={setB('monthlySave')} hint="A guess is fine" />
            </>
          )}

          {at === 'portfolio' && (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">How many properties do you own now?</p>
                <Pills label="Properties you own" options={PORTFOLIO} value={inv.portfolio} onChange={(v) => setInv((x) => ({ ...x, portfolio: v }))} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">How do you plan to pay for the next one?</p>
                <div className="space-y-2" role="radiogroup" aria-label="How you’ll pay">
                  {FINANCE.map((f) => (
                    <Choice key={f.value} role="radio" picked={inv.finance === f.value} onClick={() => setInv((x) => ({ ...x, finance: f.value }))} title={f.label} hint={f.hint} />
                  ))}
                </div>
              </div>
              <NumberField id="ob-invest-cash" label="Cash you could put into your next property" prefix="$" step={5000} decimals={0} value={inv.cash} onChange={(v) => setInv((x) => ({ ...x, cash: v }))} hint="For the down payment and closing costs" />
            </>
          )}

          {at === 'selling' && (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">What kind of property?</p>
                <Pills label="Kind of property" options={UNITS} value={sell.units} onChange={(v) => setSell((x) => ({ ...x, units: v }))} />
              </div>
              <NumberField id="ob-sell-price" label="What you think it’s worth (optional)" prefix="$" step={5000} decimals={0} value={sell.price} onChange={(v) => setSell((x) => ({ ...x, price: v }))} hint="Leave blank and we’ll estimate it from listings near you" />
              <NumberField id="ob-sell-mortgage" label="Left on the mortgage" prefix="$" step={5000} decimals={0} value={sell.mortgage} onChange={(v) => setSell((x) => ({ ...x, mortgage: v }))} hint="Blank if it’s paid off" />
            </>
          )}

          {at === 'result' && (
            <div className="space-y-4">
              {goals.includes('buy') &&
                (range ? (
                  <section aria-label="Buying" className="space-y-3">
                    <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">A home in {place.name}, on your own</h2>
                    {range.comfortable != null && range.comfortable >= range.max ? (
                      <Range
                        strong
                        label="Comfortable, and the most you could buy"
                        value={`Up to ${money(range.max)}`}
                        sub={`About ${money(range.monthlyAtMax)}/mo all in, which fits your budget. ${range.limit === 'savings' ? `Your savings set the limit; a bank would lend up to ${money(range.byIncome)}.` : 'That’s also what a bank would approve with the least down.'}`}
                      />
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {range.comfortable != null && (
                          <Range strong label="Comfortable" value={`Up to ${money(range.comfortable)}`} sub={`About ${money(range.monthlyAtComfort)}/mo all in, leaving room for your everyday costs and some savings.`} />
                        )}
                        <Range
                          strong={range.comfortable == null}
                          label="The most you could buy"
                          value={money(range.max)}
                          sub={range.limit === 'savings' ? `Your savings set the limit; a bank would lend up to ${money(range.byIncome)}.` : `What a bank would approve with the least down. About ${money(range.monthlyAtMax)}/mo.`}
                        />
                      </div>
                    )}
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {range.comfortable != null && range.comfortable < range.max && (
                        <>
                          Your range: <strong className="tabular font-semibold text-zinc-950 dark:text-white">{money(range.comfortable)} to {money(range.max)}</strong>.{' '}
                        </>
                      )}
                      A duplex with a tenant can stretch it further; the Buy tab shows how.
                    </p>
                  </section>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Add your income and savings in the Buy tab to see what you can buy.</p>
                ))}

              {goals.includes('invest') && (
                <section aria-label="Investing" className="space-y-3">
                  <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Investing{inv.portfolio && inv.portfolio !== '0' ? `, with ${PORTFOLIO.find((p) => p.value === inv.portfolio)?.label} properties` : ''}</h2>
                  {reach ? (
                    <Range
                      strong
                      label={inv.finance === 'cash' ? 'A rental you could buy outright' : 'A rental your cash could buy'}
                      value={`Up to ${money(reach.price)}`}
                      sub={inv.finance === 'cash' ? `The price plus about ${money(reach.closing)} in closing costs.` : `${money(reach.down)} down (20%) and about ${money(reach.closing)} in closing costs.${inv.finance === 'dscr' ? ' Rental loans look at the rent; listings show which ones cover it.' : ' The bank will also look at your income.'}`}
                    />
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Add the cash you could invest any time to see what it buys.</p>
                  )}
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {inv.portfolio && !['0', '1-10'].includes(inv.portfolio)
                      ? 'Add your properties in Portfolio to see your equity and cash flow together, and run your rentals from Landlord.'
                      : 'Listings rank today’s rentals by cash flow, and Analyze runs the numbers on any one you find.'}
                  </p>
                </section>
              )}

              {goals.includes('sell') && (
                <section aria-label="Selling" className="space-y-2">
                  <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Selling</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    The Sell tab estimates what your {UNITS.find((u) => u.value === sell.units)?.label.toLowerCase()} is worth from listings in {place.name}, then shows what you’d walk away with after commission, legal costs and the mortgage.
                  </p>
                </section>
              )}
            </div>
          )}
        </div>

        <p role="alert" className="mt-4 min-h-5 text-sm text-red-700 dark:text-red-300">
          {missing}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-hairline pt-4">
          {step > 0 ? (
            <Button variant="ghost" onClick={back}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
          ) : (
            <span />
          )}
          {at === 'result' ? (
            <Button variant="primary" className="h-11 px-5" onClick={finish}>
              Open Squarely <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button variant="primary" className="h-11 px-5" onClick={next}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
