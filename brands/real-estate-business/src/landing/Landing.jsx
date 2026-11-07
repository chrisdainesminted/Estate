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
const section = 'py-16 sm:py-24';
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

/** A number field that keeps what's typed and hands back a number. */
function NumberField({ id, children, value, onChange, step = 1, min = 0, suffix }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {children}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          className={`${field} ${suffix ? 'pr-12' : ''}`}
        />
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
        <Hero />
        <TryIt city={city} onCity={setCity} />
        <How />
        <Homes />
        <Today feed={feed} shown={shown} picked={city} index={index} />
        <Calculators city={city} onCity={setCity} />
        <Paths />
        <Inside />
        <Owners />
        <Pricing />
        <Faq />
        <Contact />
      </main>
      <SiteFooter />
    </div>
  );
}

const NAV = [
  ['Explore homes', '/homes/'],
  ['Listings', open('listings')],
  ['Calculators', '#calculator'],
  ['Pricing', '#pricing'],
  ['For owners', '#owners'],
  ['Ask a question', '#contact'],
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

function Hero() {
  return (
    <section id="top" className="border-b border-hairline">
      <div className={`${shell} pb-14 pt-12 sm:pt-20 lg:pb-20`}>
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="rise">
            <p className={eyebrow}>For buyers, sellers and investors across Canada</p>
            <h1 className="mt-6 text-[48px] font-semibold leading-[1.02] tracking-[-0.045em] text-zinc-900 sm:text-[68px] lg:text-[80px] dark:text-white">
              Real estate shouldn’t be <span className="text-emerald-600 dark:text-emerald-300">scary.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[17px] leading-[1.65] text-zinc-500 sm:text-lg dark:text-zinc-400">
              Our mission is to make real estate easier to understand, property ownership more transparent, and property management simpler. We give Canadians the knowledge and
              tools to make confident decisions, whether they’re buying their first property, investing, or managing rentals.
            </p>
            <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-300">Clear information. Smarter decisions. Simpler real estate.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={open('home')} className={primary}>
                See what you can buy
              </a>
              <a href="/homes/" className={secondary}>
                Find a home to rent or buy
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              {['Free to use', 'No sign-up', 'Anywhere in Canada'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-(--soft) px-3 py-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-300" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <figure className="rise" style={{ animationDelay: '80ms' }}>
            <img
              src="/landing/hw/keys.webp"
              width="1200"
              height="800"
              alt="One hand passing a set of house keys to another, over signed papers."
              className="aspect-[4/3.6] w-full rounded-[28px] object-cover lg:aspect-[1/1.05]"
            />
            <figcaption className="mt-4 flex items-center gap-3.5 px-1">
              <span className="size-11 shrink-0 rounded-[12px] bg-(--soft)" aria-hidden />
              <span className="text-sm leading-snug">
                <span className="block font-bold text-zinc-900 dark:text-white">Big decisions. Small, comfortable steps.</span>
                <span className="text-zinc-500 dark:text-zinc-400">No need to have it all figured out.</span>
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
      <div className="overflow-hidden border-t border-hairline py-5" aria-hidden>
        <div className="hw-marquee flex w-max gap-10 whitespace-nowrap font-display text-xl font-semibold tracking-[-0.02em] text-zinc-400 sm:text-2xl">
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

/**
 * Try it: the same engine as the app works out the most a lender would let
 * you pay in the picked city, on your own and with a basement suite rented out.
 */
function TryIt({ city, onCity }) {
  const [income, setIncome] = useState(SAMPLE.income);
  const [savings, setSavings] = useState(60000);
  const place = cityByKey(city);
  const result = useMemo(() => {
    const profile = { ...SAMPLE, income: n0(income), savings: n0(savings), city: place.key, entered: true };
    const common = { profile, ratePct: DEFAULT_MARKET.rate, taxPct: place.taxPct, city: place.key };
    return { alone: maxPrice({ ...common, units: 1 }), suite: maxPrice({ ...common, units: 2, rentPerOtherUnit: suiteRent(place) }) };
  }, [income, savings, place]);
  const gain = result.suite.price - result.alone.price;
  const held = (r) => (r.limit === 'savings' ? 'Held back by your savings.' : 'Held back by your income.');
  return (
    <section id="tryit" aria-labelledby="tryit-title" className="scroll-mt-24">
      <div className={`${shell} py-14 sm:py-20`}>
        <Reveal className={`${card} grid gap-10 p-6 sm:p-10 lg:grid-cols-2 lg:gap-14`}>
          <div>
            <p className={eyebrow}>Try it: what could you buy?</p>
            <h2 id="tryit-title" className="mt-4 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-zinc-900 sm:text-[44px] dark:text-white">
              See how much a rented suite could add.
            </h2>
            <p className="mt-4 max-w-md text-zinc-500 dark:text-zinc-400">Two numbers change everything: what you earn, and what a suite could bring in each month.</p>
            <div className="mt-7 grid max-w-md gap-5">
              <CitySelect id="try-city" label="Where" value={city} onChange={onCity} />
              <NumberField id="try-income" value={income} onChange={setIncome} step={1000}>
                Household income, before tax
              </NumberField>
              <NumberField id="try-savings" value={savings} onChange={setSavings} step={1000}>
                Saved for buying
              </NumberField>
            </div>
            <p className="mt-5 max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Uses the real lending limits (39% of income for housing, 44% with debts) and the stress test. Your details stay in this page.
            </p>
          </div>
          <div className="flex flex-col gap-4" aria-live="polite">
            <div className="rounded-[18px] border border-hairline bg-(--soft) p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">On your own</p>
              <p className="mt-2 font-display text-[32px] font-semibold tracking-[-0.03em] tabular-nums text-zinc-900 dark:text-white">{money(result.alone.price)}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{held(result.alone)}</p>
            </div>
            <div className="rounded-[18px] border border-emerald-600/70 bg-(--soft) p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">With a suite rented out</p>
              <p className="mt-2 font-display text-[32px] font-semibold tracking-[-0.03em] tabular-nums text-zinc-900 dark:text-white">{money(result.suite.price)}</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {gain > 0 ? `${money(gain)} more, because a lender can count the suite’s ${money(suiteRent(place))}/mo rent. ` : ''}
                {held(result.suite)}
              </p>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              A typical house in {placeName(place)}: {money(place.price)}. Counts {money(SAMPLE.debts)}/mo of debts and a {DEFAULT_MARKET.rate}% rate.
            </p>
            <a href={open('home')} className={`${primary} w-full`}>
              Get your full answer
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    ['Tell it about you', 'Income, savings and the rent you pay now. Two minutes, and it stays on your device.', ['Browse homes', '/homes/']],
    ['View your estimates', 'On your own and with a tenant, under the real rules of your province.', ['Run my own numbers', '#calculator']],
    ['Find the home', 'Listings sorted by what each would cost you to live in, every morning.', ['See worked-out listings', open('listings')]],
  ];
  return (
    <section id="how" aria-labelledby="how-title" className={`scroll-mt-24 ${soft}`}>
      <Reveal className={`${shell} ${section}`}>
        <p className={eyebrow}>How does it work?</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <h2 id="how-title" className={h2}>
              From “can I even?” to a shortlist.
            </h2>
            <p className={lede}>Compare the costs of living in a property or renting it out, with calculations based on your province’s rules.</p>
          </div>
          <p className="text-[15px] leading-relaxed text-zinc-600 lg:justify-self-end dark:text-zinc-400">
            The asking price is one number. What it costs you to live there is another, and that one sits beside every home.
          </p>
        </div>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map(([t, b, [cta, href]], i) => (
            <li key={t} className="border-t border-(--line-strong) pt-6">
              <span className="font-display text-[36px] font-medium tabular-nums text-emerald-500">0{i + 1}</span>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
              <a href={href} className={`${textLink} mt-5`}>
                {cta}
              </a>
            </li>
          ))}
        </ol>
        <div className="mt-14 border-t border-(--line-strong) pt-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-300">What each estimate covers</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            {['Mortgage payment', 'Mortgage insurance', 'Property taxes', 'Home insurance', 'Condo or suite fees', 'Rent from other units'].map((t) => (
              <li key={t} className="rounded-full border border-(--line-strong) px-3 py-1">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Utilities, moving costs and closing costs are listed separately, never folded in silently. Every figure is an estimate until a lender or licensed professional confirms
            it.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/** Ways in by kind of home: each opens the real tools, not a made-up listing. */
function Homes() {
  const homes = [
    ['condo', 'Condo', 'A bright start in the city', 'A light-filled layout, a little room to work from home, and an easy sense of everyday comfort.', ['Condos for sale', '/homes/']],
    ['townhome', 'Townhome', 'Room for your next chapter', 'Space for slow mornings, shared dinners, and whatever your next few years have in store.', ['See what you can buy', open('home')]],
    ['house', 'House with a suite', 'A little more breathing room', 'A family home with a suite downstairs, where the rent helps carry the mortgage.', ['Run the numbers', open('home')]],
  ];
  return (
    <section id="homes" aria-labelledby="homes-title" className="scroll-mt-24 border-b border-hairline">
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-3xl">
          <p className={eyebrow}>A place to start imagining</p>
          <h2 id="homes-title" className={`${h2} mt-4`}>
            Different homes.
            <br />
            Different next chapters.
          </h2>
          <p className={lede}>Pick the kind of home you have in mind, and see what the numbers look like for you.</p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {homes.map(([img, kind, title, body, [cta, href]], i) => (
            <Reveal key={img} delay={i * 60} className={`${card} flex flex-col overflow-hidden`}>
              <div className="relative">
                <img src={`/landing/hw/${img}.webp`} width="1200" height="670" loading="lazy" alt="" className="aspect-[1.4/1] w-full object-cover" />
                <span className="absolute left-4 top-4 rounded-full bg-(--panel) px-3 py-1 text-xs font-bold text-zinc-900 dark:text-white">{kind}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
                <a href={href} className={`${textLink} mt-auto border-t border-hairline pt-5`}>
                  {cta}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Photos show the kind of home, not a particular one for sale.</p>
      </div>
    </section>
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
            {inputs.map(([id, text, value, set, step, suffix]) => (
              <NumberField key={`${tab}-${id}`} id={`calc-${id}`} value={value} onChange={set} step={step} suffix={suffix}>
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
  ['Buying', 'From “can I even?” to the keys.', ['What you could buy today, and the cash to close', 'Homes that fit you, marked as a fit, a stretch, or not yet', 'Every step from the first check to moving day'], 'Start my plan', open('home')],
  ['Building', 'From a blueprint to a shopping list.', ['Walk through the rooms and what each one needs', 'Studs, drywall, insulation, paint and floors, counted', 'A materials list you can price at the hardware store'], 'Price my build', open('build')],
  ['Selling', 'Know your number before an agent does.', ['What it’s likely worth, next to similar homes', 'What you walk away with after commission and the mortgage', 'A sell-ready checklist, and a free listing to sell privately'], 'What’s my home worth?', open('sell')],
  ['Investing', 'Every deal, run the way a lender runs it.', ['Cash flow, the debt cover ratio, and the most you should pay', 'Rent you can count toward your next purchase', 'Rent, repairs and tax time in one place'], 'Analyze a deal', open('analyze')],
];

function Paths() {
  return (
    <section id="paths" aria-labelledby="paths-title" className="border-b border-hairline">
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-3xl">
          <p className={eyebrow}>One place for all of it</p>
          <h2 id="paths-title" className={`${h2} mt-4`}>
            Let’s get started
          </h2>
          <p className={lede}>Start wherever you are. Each path begins with numbers you can understand.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PATHS.map(([title, lead, points, cta, href], i) => (
            <Reveal key={title} delay={i * 50} className={`${card} flex flex-col p-7`}>
              <span className="size-11 rounded-[12px] bg-(--soft)" aria-hidden />
              <h3 className="mt-7 text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-300">{lead}</p>
              <ul className="mt-5 grid gap-2.5 text-[15px] text-zinc-600 dark:text-zinc-400">
                {points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <a href={href} className={`${textLink} mt-auto pt-6`}>
                {cta}
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Inside() {
  const items = [
    ['Morning listings', 'Homes with what each would cost you to live in, worked out beside your numbers.', 'See today’s shortlist', open('listings')],
    ['Home check', 'What a lender would probably approve you for, and what it costs each month next to your rent.', 'Check my numbers', open('home')],
    ['Money you can get', 'First-home savings, land transfer tax refunds, the buyers’ credit and the RRSP plan, added up.', 'Run the numbers', open('home')],
    ['Find a lender', 'Who lends, what to bring, what to ask, and how to check a broker’s licence.', 'Read the guide', '/lenders/'],
    ['Landlord tools', 'List a home free, then keep applications, rent and repairs in one place.', 'Open landlord tools', open('landlord')],
    ['Your property space', 'Sign in, then keep the homes you own, their work, rent and tax lines together.', 'Open My properties', open('portfolio')],
  ];
  return (
    <section id="inside" aria-labelledby="inside-title" className={`scroll-mt-24 ${soft}`}>
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-3xl">
          <p className={eyebrow}>What’s inside</p>
          <h2 id="inside-title" className={`${h2} mt-4`}>
            Everything a broker would check, before you call one.
          </h2>
          <p className={lede}>A short set of tools, each one built to answer a specific question, and a straight answer about what it cannot tell you.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([t, b, cta, href], i) => (
            <Reveal key={t} delay={i * 40} className={`${card} flex flex-col p-7`}>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
              <a href={href} className={`${textLink} mt-auto pt-5`}>
                {cta}
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Owners() {
  const points = [
    ['Getting a property rental-ready', 'Set up the unit, list it free, and take applications and viewings in one place.'],
    ['Keeping the everyday organized', 'Rent, repairs and expenses tracked, with the tax lines ready for your accountant.'],
    ['A smarter perspective on what’s next', 'What each home is worth today, what work added to it, and when a refinance makes sense.'],
  ];
  return (
    <section id="owners" aria-labelledby="owners-title" className="scroll-mt-24 border-b border-hairline">
      <div className={`${shell} ${section} grid items-center gap-12 lg:grid-cols-2`}>
        <Reveal>
          <img src="/landing/hw/owners.webp" width="1200" height="670" loading="lazy" alt="Two people at a kitchen table looking over a chart on a tablet." className="aspect-[4/3] w-full rounded-[28px] object-cover" />
          <div className="mt-5 flex gap-4 rounded-[24px] border border-hairline bg-(--soft) p-6">
            <span className="size-11 shrink-0 rounded-[12px] bg-(--panel)" aria-hidden />
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Your properties, all in one place.</h3>
              <p className="mt-1.5 text-[15px] text-zinc-600 dark:text-zinc-400">Add the homes you own, the work you’ve put in, and what they bring in each month.</p>
              <a href={open('portfolio')} className={`${textLink} mt-4`}>
                Open my property space
              </a>
            </div>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <p className={eyebrow}>For the ownership side of life</p>
          <h2 id="owners-title" className={`${h2} mt-4`}>
            Navigate property ownership with greater confidence.
          </h2>
          <p className={lede}>Whether you have one home or a growing list of questions, start with the tools that make sense for you.</p>
          <ul className="mt-8 grid gap-6">
            {points.map(([t, b]) => (
              <li key={t} className="flex gap-4">
                <span className="size-11 shrink-0 rounded-[12px] bg-(--soft)" aria-hidden />
                <span>
                  <span className="block font-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">{t}</span>
                  <span className="mt-1 block text-[15px] text-zinc-600 dark:text-zinc-400">{b}</span>
                </span>
              </li>
            ))}
          </ul>
          <a href={open('landlord')} className={`${secondary} mt-8`}>
            Open landlord tools
          </a>
        </Reveal>
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
                {p.points.map((x) => (
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
  [
    'I’ve never talked to a lender. Where do I start?',
    <>
      Start with the calculators above, then our{' '}
      <a href="/lenders/" className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">
        guide to finding a lender
      </a>
      : who lends, what to bring, what to ask, and how to check a broker’s licence in your province.
    </>,
  ],
  [
    'What can I do in My properties?',
    'Add the homes you own, with what you paid, the mortgage, the rent and the work you’ve put in. You see what each is worth and brings in, and the tax lines are ready at year end. Sign in to keep it on every device.',
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
          <a href="#contact" className={`${secondary} mt-8`}>
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

const TOPICS = ['Just exploring', 'Buying a home', 'Building a home', 'Selling a home', 'Investing or rental income', 'Landlord tools or billing', 'A number looks wrong', 'Something else'];

/** The contact form: it goes to the same inbox as the contact page. */
function Contact() {
  const [f, setF] = useState({ name: '', email: '', topic: TOPICS[0], message: '', website: '' });
  const [state, setState] = useState({ status: 'idle', error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const send = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Couldn’t send that. Try again in a minute.');
      setState({ status: 'sent', error: '' });
    } catch (err) {
      setState({ status: 'idle', error: err.message });
    }
  };
  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-24">
      <div className={`${shell} ${section} grid gap-12 lg:grid-cols-2`}>
        <div>
          <p className={eyebrow}>A conversation, not a commitment</p>
          <h2 id="contact-title" className={`${h2} mt-4`}>
            Find out how
            <br />
            close you are.
          </h2>
          <p className={lede}>Two minutes, free, and nothing to sign up for. Tell us where you’re at and we’ll reply by email.</p>
          <div className="mt-8 flex gap-4 rounded-[24px] bg-(--soft) p-6">
            <span className="size-11 shrink-0 rounded-[12px] bg-(--panel)" aria-hidden />
            <p className="text-[15px] text-zinc-600 dark:text-zinc-300">
              <span className="block font-bold text-zinc-900 dark:text-white">Real questions welcome.</span>
              No pressure to take the next step.
            </p>
          </div>
          <a href="/homes/" className={`${secondary} mt-6`}>
            Browse homes first
          </a>
        </div>
        {state.status === 'sent' ? (
          <div className={`${card} h-max p-8`} role="status">
            <p className="font-display text-2xl font-semibold text-zinc-900 dark:text-white">Thanks, {f.name.split(' ')[0]}. Your question is in.</p>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">We’ll reply to {f.email}, usually within two business days.</p>
          </div>
        ) : (
          <form onSubmit={send} className={`${card} grid gap-5 p-6 sm:p-8`}>
            <div>
              <label htmlFor="hw-name" className={label}>
                Your name
              </label>
              <input id="hw-name" required autoComplete="name" value={f.name} onChange={set('name')} className={field} />
            </div>
            <div>
              <label htmlFor="hw-email" className={label}>
                Email address
              </label>
              <input id="hw-email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} className={field} />
            </div>
            <div>
              <label htmlFor="hw-topic" className={label}>
                What would you like to talk about?
              </label>
              <select id="hw-topic" value={f.topic} onChange={set('topic')} className={field}>
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="hw-msg" className={label}>
                Your question
              </label>
              <textarea id="hw-msg" required minLength={5} rows={5} value={f.message} onChange={set('message')} className={field} />
            </div>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We use your details only to reply. Please don’t include banking information, identity documents or tenant details.{' '}
              <a href="/privacy/" className="underline underline-offset-2">
                Privacy
              </a>
            </p>
            {state.error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {state.error}
              </p>
            )}
            <button type="submit" disabled={state.status === 'sending'} className={`${primary} w-full disabled:opacity-60`}>
              {state.status === 'sending' ? 'Sending…' : 'Send my question'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
