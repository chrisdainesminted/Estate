import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Menu, Plus, X } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { DEFAULT_PROFILE, RULES_CHECKED, closingCash, homeFor, maxPrice, minDownPayment, mortgagePlan } from '../lib/firstHome.js';
import { loanRate, monthlyPI } from '../lib/finance.js';
import { Reveal } from './motion.jsx';
import { cityByKey, guessCity } from '../lib/canada.js';
import CitySelect from '../components/CitySelect.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import AccountLink from '../components/AccountLink.jsx';
import { DEFAULT_MARKET, INDEX_DOC, dedupeListings, feedDoc, listingCity, listingTaxes, listingToDeal, localMarket, unitsOf } from '../lib/market.js';
import { money } from '../lib/format.js';

/**
 * Homeward's front page at /. The look and words are Homeward's; every
 * number comes from the same engine as the app (the buying rules, the
 * mortgage maths, the morning run's listings), and every link opens the
 * real tool. (This file replaces src/landing/Landing.jsx on the Homeward
 * copy of the site; see scripts/rebrand.mjs.)
 */

const APP = '/app/';
const open = (view) => `${APP}?view=${view}`;
const SAMPLE = DEFAULT_PROFILE;
const placeName = (c) => c.name.replace(/^Elsewhere in /, '');
const suiteRent = (place) => Math.round((place.rent * 0.8) / 25) * 25;

const shell = 'mx-auto w-full max-w-6xl px-4 sm:px-6';
const eyebrow = 'text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300';
const h2 = 'font-display text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-zinc-900 sm:text-[48px] dark:text-white';
const lede = 'mt-5 max-w-2xl text-[17px] leading-relaxed text-zinc-500 sm:text-lg dark:text-zinc-400';
const section = 'py-14 sm:py-20';
const card = 'rounded-[24px] border border-hairline bg-(--panel)';
const soft = 'bg-(--soft)';
const primary =
  'inline-flex items-center justify-center gap-2 rounded-[12px] border border-(--accent) bg-(--accent) px-5 py-3 text-[15px] font-semibold text-(--accent-ink) transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)';
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-[12px] border border-(--line-strong) bg-(--panel)/60 px-5 py-3 text-[15px] font-semibold text-zinc-900 transition hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) dark:text-zinc-100';
const textLink = 'inline-flex items-center gap-1.5 text-[15px] font-bold text-emerald-700 hover:underline underline-offset-4 dark:text-emerald-300';
const field = 'field w-full px-3.5 py-3 text-[15px] text-zinc-900 tabular-nums dark:text-zinc-100';
const label = 'mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200';

/** A file the morning run publishes under /data/: null while loading, false if it isn't there. */
function useData(doc, isValid) {
  const [state, setState] = useState({ doc: null, data: null });
  useEffect(() => {
    let live = true;
    fetch(`/data/${doc}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((f) => live && setState({ doc, data: isValid(f) ? f : false }))
      .catch(() => live && setState({ doc, data: false }));
    return () => {
      live = false;
    };
  }, [doc, isValid]);
  return state.doc === doc ? state.data : null;
}
const isFeed = (f) => Array.isArray(f?.listings);
const isIndex = (f) => !!f?.cities;

function useFeed(city) {
  const index = useData(INDEX_DOC, isIndex);
  const shown = listingCity(null, city, index || null);
  const raw = useData(feedDoc(shown), isFeed);
  const feed = useMemo(() => (raw ? { ...raw, listings: dedupeListings(raw.listings) } : raw), [raw]);
  return { feed, shown, index };
}

const longDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

/** "1234567.5" as "1,234,567.5": commas in the whole part, the decimals as typed. */
const withCommas = (raw) => {
  const [whole, dec] = String(raw).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
};
const plain = (v) => (Number.isFinite(v) ? String(v) : '');

/** A number field that shows commas as you type and hands back a number. */
function NumberField({ id, children, value, onChange, suffix }) {
  const [text, setText] = useState(() => withCommas(plain(value)));
  const change = (e) => {
    // Digits and one decimal point; commas are put back in their places.
    const [whole = '', ...rest] = e.target.value.replace(/[^\d.]/g, '').split('.');
    const clean = rest.length ? `${whole}.${rest.join('')}` : whole;
    setText(withCommas(clean));
    onChange(clean === '' || clean === '.' ? NaN : Number(clean));
  };
  return (
    <div>
      <label htmlFor={id} className={label}>
        {children}
      </label>
      <div className="relative">
        <input id={id} type="text" inputMode="decimal" autoComplete="off" value={text} onChange={change} className={`${field} ${suffix ? 'pr-12' : ''}`} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 grid place-items-center text-sm text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}
const n0 = (v) => (Number.isFinite(v) ? v : 0);

export default function Landing() {
  const [city, setCity] = useState(guessCity);
  const { feed, shown, index } = useFeed(city);
  return (
    <div className="min-h-dvh bg-(--page) text-zinc-900 antialiased dark:text-zinc-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-(--panel) focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero city={city} onCity={setCity} />
        <Today feed={feed} shown={shown} picked={city} index={index} />
        <Paths />
        <Calculators city={city} onCity={setCity} />
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
      <StickyStart />
    </div>
  );
}

const NAV = [
  ['Explore homes', '/homes/'],
  ['Listings', open('listings')],
  ['Calculators', '#calculator'],
  ['Pricing', '#pricing'],
  ['For owners', '#paths'],
  ['Ask a question', '/contact/'],
];

function Nav() {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-(--page)/90 backdrop-blur supports-[backdrop-filter]:bg-(--page)/80">
      <div className={`${shell} flex h-[84px] items-center justify-between gap-4`}>
        <a href="/" aria-label="Homeward home" className="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)">
          <Logo />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-5 text-sm font-semibold text-zinc-600 lg:flex dark:text-zinc-400">
          {NAV.map(([text, href]) => (
            <a key={text} className="hover:text-zinc-900 dark:hover:text-white" href={href}>
              {text}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <AccountLink className="max-sm:hidden" />
          <a href={open('portfolio')} className={`${secondary} max-sm:hidden px-5 py-2.5 text-sm whitespace-nowrap`}>
            My properties
          </a>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? 'Close menu' : 'Menu'}
            className="grid size-11 place-items-center rounded-[12px] border border-(--line-strong) text-zinc-700 hover:bg-well lg:hidden dark:text-zinc-300"
          >
            {menu ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {menu && (
        <nav id="site-menu" aria-label="Menu" className="border-t border-hairline lg:hidden">
          <ul className={`${shell} divide-y divide-hairline py-2`}>
            {[...NAV, ['My properties', open('portfolio')], ['Sign in or your account', '/account/']].map(([text, href]) => (
              <li key={text}>
                <a href={href} onClick={() => setMenu(false)} className="block py-3 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

const PHRASES = [
  'Let a tenant help pay for it.',
  'Know your real budget.',
  'Claim every rebate.',
  'See the real monthly cost.',
  'Find a home that fits.',
  'Add a suite that pays.',
  'Build it for less.',
  'Sell for what it’s worth.',
  'Find your next deal.',
];

/**
 * The first screen answers the question people come with, "what could I
 * buy?", before they scroll: a short headline on the left and the live
 * estimate on the right (under the headline on phones). The same engine as
 * the app works out the most a lender would let you pay in the picked city,
 * on your own and with a basement suite rented out.
 */
function Hero({ city, onCity }) {
  const [income, setIncome] = useState(SAMPLE.income);
  const [savings, setSavings] = useState(60000);
  const place = cityByKey(city);
  const result = useMemo(() => {
    const profile = { ...SAMPLE, income: n0(income), savings: n0(savings), city: place.key, entered: true };
    const common = { profile, ratePct: DEFAULT_MARKET.rate, taxPct: place.taxPct, city: place.key };
    return { alone: maxPrice({ ...common, units: 1 }), suite: maxPrice({ ...common, units: 2, rentPerOtherUnit: suiteRent(place) }) };
  }, [income, savings, place]);
  const gain = result.suite.price - result.alone.price;
  return (
    <section id="top" className="border-b border-hairline">
      <div className={`${shell} pb-12 pt-8 sm:pt-14 lg:pb-16`}>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-14">
          <div className="rise">
            <p className={eyebrow}>For buyers, sellers and investors across Canada</p>
            <h1 className="mt-4 text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] text-zinc-900 sm:text-[64px] lg:text-[76px] dark:text-white">
              Real estate shouldn’t be <span className="text-emerald-600 dark:text-emerald-300">scary.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-zinc-500 sm:text-lg dark:text-zinc-400">
              See what you can afford, what a home really costs each month, and the homes that fit, in plain numbers.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm font-semibold text-zinc-600 max-lg:hidden dark:text-zinc-300">
              {['Free to use', 'No sign-up', 'Anywhere in Canada'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-(--soft) px-3 py-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-300" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-3 max-lg:hidden">
              <a href="/homes/" className={secondary}>
                Find a home to rent or buy
              </a>
              <a href={open('portfolio')} className={secondary}>
                I already own a home
              </a>
            </div>
          </div>
          <div id="tryit" className={`${card} rise scroll-mt-24 p-5 sm:p-7`} style={{ animationDelay: '80ms' }}>
            <p className="font-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">What could you buy?</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
              <div className="col-span-2">
                <CitySelect id="try-city" label="Where" value={city} onChange={onCity} />
              </div>
              <NumberField id="try-income" value={income} onChange={setIncome}>
                Income, before tax
              </NumberField>
              <NumberField id="try-savings" value={savings} onChange={setSavings}>
                Saved for buying
              </NumberField>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3" aria-live="polite">
              <div className="rounded-[14px] bg-(--soft) p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-300">On your own</p>
                <p className="mt-1 font-display text-[24px] font-semibold tracking-[-0.03em] tabular-nums text-zinc-900 sm:text-[28px] dark:text-white">{money(result.alone.price)}</p>
              </div>
              <div className="rounded-[14px] border border-emerald-600/70 bg-(--soft) p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-300">With a suite</p>
                <p className="mt-1 font-display text-[24px] font-semibold tracking-[-0.03em] tabular-nums text-zinc-900 sm:text-[28px] dark:text-white">{money(result.suite.price)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {gain > 0 ? `A rented suite adds ${money(gain)}: lenders count its ${money(suiteRent(place))}/mo rent. ` : ''}A typical house in {placeName(place)} is {money(place.price)}.
            </p>
            <a href={open('home')} className={`${primary} mt-5 w-full`}>
              See your full plan <ArrowRight className="size-4" aria-hidden />
            </a>
            <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">Free · No sign-up · Real lending rules at a {DEFAULT_MARKET.rate}% rate</p>
          </div>
        </div>
      </div>
      <div className="overflow-hidden border-t border-hairline py-4" aria-hidden>
        <div className="hw-marquee flex w-max gap-10 whitespace-nowrap font-display text-lg font-semibold tracking-[-0.02em] text-zinc-400 sm:text-xl">
          {[...PHRASES, ...PHRASES].map((p, i) => (
            <span key={i} className="flex items-center gap-10">
              {p}
              <span className="size-1.5 rounded-full bg-emerald-500" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** On phones, once the first screen has scrolled away, one button back to the answer. */
function StickyStart() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > window.innerHeight * 1.2 && window.innerHeight + window.scrollY < document.body.scrollHeight - 400);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-(--page)/95 p-3 backdrop-blur transition-transform duration-300 lg:hidden ${show ? 'translate-y-0' : 'translate-y-full'}`} style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }} aria-hidden={!show}>
      <a href={open('home')} tabIndex={show ? 0 : -1} className={`${primary} w-full`}>
        See what you can buy
      </a>
    </div>
  );
}

/** The morning run's feed for the city shown, run through the same numbers as the app's Listings tab. */
function Today({ feed, shown, picked, index }) {
  const place = cityByKey(shown);
  const wanted = cityByKey(picked);
  const covered = index ? Object.values(index.cities).filter((c) => c.count > 0).length : 0;
  const data = useMemo(() => {
    if (!feed) return null;
    const market = localMarket(DEFAULT_MARKET, shown);
    const active = feed.listings.filter((l) => (l.status ?? 'active') === 'active');
    const homes = active
      .filter((l) => unitsOf(l) >= 2 && unitsOf(l) <= 4 && listingTaxes(l, market) != null)
      .map((l) => ({ l, h: homeFor(listingToDeal(l, market, 'own'), { ...SAMPLE, city: shown }, market.rate) }))
      .filter((x) => x.h)
      .sort((a, b) => a.h.costToLive - b.h.costToLive);
    return { count: active.length, date: feed.lastRun?.date, top: homes.slice(0, 3) };
  }, [feed, shown]);
  return (
    <section id="listings" aria-labelledby="listings-title" className="scroll-mt-24 border-b border-hairline">
      <div className={`${shell} ${section}`}>
        <Reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className={eyebrow}>Daily listings · {covered > 1 ? `${covered} cities` : 'worked out for you'}</p>
            <h2 id="listings-title" className={`${h2} mt-4`}>
              Properties worth a closer look, selected for you
            </h2>
            <p className={lede}>Live in one unit, rent the others: this is what it would cost you each month, ranked from the lowest.</p>
            {shown !== picked && (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                {wanted.key.endsWith('-other')
                  ? `Here’s ${placeName(place)} to show how it works.`
                  : `The morning run hasn’t reached ${placeName(wanted)} yet. Here’s ${placeName(place)} meanwhile.`}
              </p>
            )}
          </div>
          <a href="#calculator" className={`${secondary} shrink-0`}>
            Run my own numbers
          </a>
        </Reveal>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Lowest cost to live in right now</h3>
              <span className="rounded-full bg-(--soft) px-3 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300" aria-live="polite">
                {data ? `Updated ${longDate(data.date)}` : feed === false ? 'Couldn’t load listings' : 'Loading…'}
              </span>
            </div>
            <ol className="mt-4 grid gap-3">
              {(data?.top ?? [null, null, null]).map((x, i) => (
                <li key={x?.l.id ?? i} className={`${card} flex items-center gap-4 rounded-[18px] p-4 sm:p-5`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-(--soft) text-sm font-bold tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-zinc-900 dark:text-white">{x ? x.l.address : ' '}</span>
                    <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {x ? `${['', '', 'Duplex', 'Triplex', 'Fourplex'][unitsOf(x.l)]} · ${placeName(place)} · ${money(x.l.price)}` : ' '}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-lg font-semibold tabular-nums text-zinc-900 sm:text-xl dark:text-white">{x ? money(x.h.costToLive) : ''}</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">{x ? `a month to live in · ${money(x.h.down)} down` : ''}</span>
                  </span>
                </li>
              ))}
            </ol>
            <a href={`${open('listings')}&city=${shown}`} className={`${textLink} mt-6`}>
              See all {data ? data.count : ''} worked-out listings <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <aside className="h-max rounded-[24px] border border-hairline bg-(--soft) p-6 sm:p-7">
            <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-white">The criteria behind each recommendation</h3>
            <ul className="mt-5 grid gap-3 text-[15px] text-zinc-600 dark:text-zinc-300">
              {['Real homes for sale, found this week, each with its real tax bill', 'What you put down, and what stays on the mortgage', 'What it costs you to live in once the other units’ rent comes in'].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-(--line-strong) pt-5 text-sm text-zinc-500 dark:text-zinc-400">
              Worked out for a sample buyer with {money(SAMPLE.income)} a year. Rents are the city’s averages; check your city’s suite rules and what a lender will accept.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

const TABS = [
  ['mortgage', 'Monthly payment'],
  ['afford', 'Buying power'],
  ['closing', 'Upfront costs'],
  ['rental', 'Rental help'],
];

/** Four calculators on the real rules: payment, what you can buy, cash to close, and what a suite adds. */
function Calculators({ city, onCity }) {
  const [tab, setTab] = useState('mortgage');
  const place = cityByKey(city);
  const [price, setPrice] = useState(500000);
  const [downPct, setDownPct] = useState(10);
  const [rate, setRate] = useState(DEFAULT_MARKET.rate);
  const [amort, setAmort] = useState(25);
  const [income, setIncome] = useState(SAMPLE.income);
  const [debts, setDebts] = useState(SAMPLE.debts);
  const [savings, setSavings] = useState(40000);
  const [suite, setSuite] = useState(() => suiteRent(place));

  const out = useMemo(() => {
    const p = n0(price);
    const down = (p * n0(downPct)) / 100;
    const profile = { ...SAMPLE, income: n0(income), debts: n0(debts), savings: n0(savings), city: place.key, entered: true };
    const common = { profile, ratePct: n0(rate), taxPct: place.taxPct, city: place.key };
    if (tab === 'mortgage') {
      const plan = mortgagePlan({ price: p, down, ratePct: n0(rate), province: place.province });
      const years = Math.min(Math.max(n0(amort), 1), 30);
      const payment = monthlyPI(plan.loan, loanRate(n0(rate), { country: 'ca' }), years);
      const short = down + 0.5 < minDownPayment(p, 1);
      return {
        label: 'Estimated monthly mortgage payment',
        value: `${money(payment)}/mo`,
        notes: [
          short ? `The least you can put down on ${money(p)} is ${money(minDownPayment(p, 1))}.` : null,
          plan.insured && plan.insurable ? `Includes ${money(plan.premium)} of mortgage default insurance, added to the loan.` : null,
          `${money(plan.loan)} borrowed at ${n0(rate)}% over ${years} years.`,
        ],
      };
    }
    if (tab === 'afford') {
      const r = maxPrice({ ...common, units: 1 });
      return {
        label: 'The most a lender would likely approve',
        value: money(r.price),
        notes: [r.limit === 'savings' ? 'Your savings set the limit: the down payment and closing costs.' : 'Your income sets the limit, under the stress test.', `Property tax at ${place.taxPct}% of the price a year, typical for ${placeName(place)}.`],
      };
    }
    if (tab === 'closing') {
      const plan = mortgagePlan({ price: p, down, ratePct: n0(rate), province: place.province });
      const c = closingCash({ price: p, city: place.key, premiumPst: plan.premiumPst });
      return {
        label: 'Cash you need to close',
        value: money(down + c.total),
        notes: [
          `${money(down)} down payment.`,
          `${money(c.ltt)} land transfer tax${c.refund > 0 ? `, less ${money(c.refund)} back for a first-time buyer` : ''}.`,
          c.premiumPst > 0 ? `${money(c.premiumPst)} sales tax on the mortgage insurance, due at closing.` : null,
          `${money(c.other)} for legal fees, inspection and adjustments (about 1.5%).`,
        ],
      };
    }
    const alone = maxPrice({ ...common, units: 1 });
    const two = maxPrice({ ...common, units: 2, rentPerOtherUnit: n0(suite) });
    return {
      label: 'What you could buy with a suite rented out',
      value: money(two.price),
      notes: [`${money(alone.price)} on your own, so the suite adds ${money(Math.max(two.price - alone.price, 0))}.`, 'Insured lenders count the suite’s rent toward your income on a two-unit home you live in.'],
    };
  }, [tab, price, downPct, rate, amort, income, debts, savings, suite, place]);

  const inputs = {
    mortgage: [
      ['price', 'Home price', price, setPrice, 1000],
      ['down', 'Down payment', downPct, setDownPct, 0.5, '%'],
      ['rate', 'Interest rate', rate, setRate, 0.01, '%'],
      ['amort', 'Amortization', amort, setAmort, 1, 'yrs'],
    ],
    afford: [
      ['income', 'Household income, before tax', income, setIncome, 1000],
      ['debts', 'Monthly debt payments', debts, setDebts, 50],
      ['savings', 'Saved for buying', savings, setSavings, 1000],
      ['rate', 'Interest rate', rate, setRate, 0.01, '%'],
    ],
    closing: [
      ['price', 'Home price', price, setPrice, 1000],
      ['down', 'Down payment', downPct, setDownPct, 0.5, '%'],
    ],
    rental: [
      ['income', 'Household income, before tax', income, setIncome, 1000],
      ['savings', 'Saved for buying', savings, setSavings, 1000],
      ['debts', 'Monthly debt payments', debts, setDebts, 50],
      ['suite', 'Monthly rent the suite could bring', suite, setSuite, 25],
    ],
  }[tab];

  return (
    <section id="calculator" aria-labelledby="calc-title" className={`scroll-mt-24 ${soft}`}>
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-3xl">
          <p className={eyebrow}>A little clarity goes a long way</p>
          <h2 id="calc-title" className={`${h2} mt-4`}>
            Making sense of the numbers that matter.
          </h2>
          <p className={lede}>No sign-up. No commitment. Just a starting point for a more confident conversation.</p>
        </Reveal>
        <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Calculators">
          {TABS.map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-[12px] border px-4 py-2.5 text-sm font-bold transition ${tab === key ? 'border-(--accent) bg-(--accent) text-(--accent-ink)' : 'border-(--line-strong) bg-(--panel) text-zinc-700 hover:border-emerald-500 dark:text-zinc-300'}`}
            >
              {text}
            </button>
          ))}
        </div>
        <div className={`${card} mt-5 grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.2fr_1fr]`} role="tabpanel">
          <div className="grid content-start gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <CitySelect id="calc-city" label="Where" value={city} onChange={onCity} />
            </div>
            {inputs.map(([id, text, value, set, , suffix]) => (
              <NumberField key={`${tab}-${id}`} id={`calc-${id}`} value={value} onChange={set} suffix={suffix}>
                {text}
              </NumberField>
            ))}
          </div>
          <div className="flex flex-col rounded-[18px] bg-(--soft) p-6" aria-live="polite">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">Your starting point</p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{out.label}</p>
            <p className="mt-1 font-display text-[40px] font-semibold leading-tight tracking-[-0.03em] tabular-nums text-zinc-900 dark:text-white">{out.value}</p>
            <ul className="mt-4 grid gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
              {out.notes.filter(Boolean).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <a href={open('home')} className={`${textLink} mt-auto pt-6`}>
              Get the full picture <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Estimates on the rules checked {longDate(RULES_CHECKED)}, not lending advice or a pre-approval. A lender or licensed broker confirms your real options.
        </p>
      </div>
    </section>
  );
}

const PATHS = [
  ['keys', 'Buying', 'From “can I even?” to the keys.', 'What you can buy, the cash to close, and homes that fit you.', 'Start my plan', open('home')],
  ['house', 'Selling', 'Know your number before an agent does.', 'What it’s likely worth, and what you walk away with.', 'What’s my home worth?', open('sell')],
  ['townhome', 'Investing', 'Every deal, run the way a lender runs it.', 'Cash flow, the debt cover ratio, and the most to pay.', 'Analyze a deal', open('analyze')],
  ['owners', 'Owning & renting out', 'Your properties, all in one place.', 'Rent, repairs, work done and tax time, kept together.', 'Open My properties', open('portfolio')],
];

/** Four ways in, one card each, so people pick their own path instead of reading about all of them. */
function Paths() {
  return (
    <section id="paths" aria-labelledby="paths-title" className="scroll-mt-24 border-b border-hairline">
      <div className={`${shell} py-14 sm:py-20`}>
        <Reveal className="max-w-3xl">
          <p className={eyebrow}>Start wherever you are</p>
          <h2 id="paths-title" className={`${h2} mt-3`}>
            What brings you here?
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PATHS.map(([img, title, lead, body, cta, href], i) => (
            <Reveal key={title} delay={i * 50}>
              <a href={href} className={`${card} tile group flex h-full flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)`}>
                <img src={`/landing/hw/${img}.webp`} width="1200" height="670" loading="lazy" alt="" className="aspect-[16/10] w-full object-cover" />
                <span className="flex flex-1 flex-col p-5">
                  <span className="text-xl font-semibold tracking-tight text-zinc-900 font-display dark:text-white">{title}</span>
                  <span className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-300">{lead}</span>
                  <span className="mt-3 text-[15px] text-zinc-600 dark:text-zinc-400">{body}</span>
                  <span className={`${textLink} mt-auto pt-4`}>
                    {cta} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      unit: 'forever',
      lead: 'Enough to see exactly where you stand today.',
      points: ['Your buying plan, checklists and next steps', 'Homes that fit you, every morning', 'What your home is worth, and what you’d walk away with', 'Materials lists from the rooms you type in', 'Deal analysis, listings and calculators'],
      cta: ['Start free', open('home')],
    },
    {
      name: 'Plus',
      tag: 'Most asked about',
      price: '$12',
      unit: '/ month',
      lead: 'For when the numbers start turning into an actual plan.',
      points: ['Everything in Free', 'Pro deals: tax sales and lender, estate and court sales, with the numbers run', 'Blueprints read for you: send a plan, get the materials list', 'A note when a price drops or a new home fits you', 'A pricing report for your home, ready to print', 'Deal memos and materials lists you can share'],
      cta: ['Start free, upgrade any time', open('home')],
    },
    {
      name: 'Landlords',
      price: '2%',
      unit: 'of rent tracked',
      lead: 'A small share of the rent you actually collect, with a ceiling per unit.',
      points: ['Listings where people apply and book viewings', 'Rent tracking, reminders and receipts', 'Repairs, expenses and your tax pack', 'At most $30 a unit; your first unit is free'],
      cta: ['Open landlord tools', open('landlord')],
    },
  ];
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-24 border-b border-hairline">
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-3xl">
          <h2 id="pricing-title" className={h2}>
            Free to start.
          </h2>
          <p className={lede}>No account needed to look around. Plus is there when it saves you time.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`${card} flex flex-col p-7 ${p.tag ? 'border-2 border-emerald-600/70' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-white">{p.name}</h3>
                {p.tag && <span className="rounded-full bg-(--soft) px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">{p.tag}</span>}
              </div>
              <p className="mt-4 font-display text-[40px] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">
                {p.price} <span className="text-base font-medium tracking-normal text-zinc-500">{p.unit}</span>
              </p>
              <p className="mt-2 text-[15px] text-zinc-600 dark:text-zinc-400">{p.lead}</p>
              <ul className="mt-6 grid gap-2.5 border-t border-hairline pt-6 text-[15px] text-zinc-700 dark:text-zinc-300">
                {p.points.slice(0, 4).map((x) => (
                  <li key={x} className="flex gap-2.5">
                    <Check className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden /> {x}
                  </li>
                ))}
              </ul>
              <a href={p.cta[1]} className={`${p.tag ? primary : secondary} mt-8`}>
                {p.cta[0]}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  [
    'Can I really buy a duplex with 5% down?',
    'In Canada, often yes, if you live in one of the units. A two-unit home uses the same minimums as a house: 5% of the first $500,000 and 10% of the rest. Three and four units need at least 10%.',
  ],
  [
    'Will a bank count the rent from the other unit?',
    'For a two-unit home you live in, insured lenders can count the rent toward your income; with three or four units, about half of it. The Rental help calculator shows both numbers side by side.',
  ],
  [
    'What does it cost?',
    'Looking around, the calculators, listings and plans cost nothing, and listing a home is free. Plus is $12 a month. Landlords who track rent pay 2% of each tenanted unit’s rent, at most $30 a unit, and the first unit is free.',
  ],
  ['Is this financial advice?', 'No. These are careful estimates so you walk into a broker’s office knowing your numbers. A mortgage broker or lender confirms the real ones.'],
];

function Faq() {
  return (
    <section id="questions" aria-labelledby="faq-title" className={`scroll-mt-24 ${soft}`}>
      <div className={`${shell} ${section} grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr]`}>
        <div>
          <p className={eyebrow}>Good to know</p>
          <h2 id="faq-title" className={`${h2} mt-4`}>
            Good questions.
            <br />
            Clear answers.
          </h2>
          <p className={lede}>There’s no such thing as being “too early” to ask.</p>
          <a href="/contact/" className={`${secondary} mt-8`}>
            Ask your own question
          </a>
        </div>
        <div className="grid content-start gap-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-[18px] border border-hairline bg-(--panel)">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 font-bold text-zinc-900 marker:hidden dark:text-white [&::-webkit-details-marker]:hidden">
                {q}
                <Plus className="size-5 shrink-0 text-emerald-600 transition group-open:rotate-45 dark:text-emerald-300" aria-hidden />
              </summary>
              <p className="-mt-1 px-5 pb-5 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
