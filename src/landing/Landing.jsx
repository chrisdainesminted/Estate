import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Building2, ClipboardCheck, Home, KeyRound, Landmark, ListChecks, Lock, Menu, Plus, X } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { DEFAULT_PROFILE, RULES, RULES_CHECKED, benefits, buyCheck, homeFor, incomeToQualify, maxPrice } from '../lib/firstHome.js';
import { CountUp, Reveal } from './motion.jsx';
import { stepsFor } from '../lib/suites.js';
import { cityByKey, guessCity } from '../lib/canada.js';
import CitySelect from '../components/CitySelect.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import { DEFAULT_MARKET, INDEX_DOC, INSURANCE_MIN, feedDoc, listingCity, listingToDeal, localMarket } from '../lib/market.js';
import { money } from '../lib/format.js';

/**
 * The website's front page at /. Every number on it comes from the same
 * engine as the app, worked out for a sample buyer (DEFAULT_PROFILE) and
 * the city the visitor picks (their time zone's guess to start), and the
 * listings are the morning run's feed for that city, or Thunder Bay's until
 * the run reaches it.
 */

const APP = '/app/';
const open = (view) => `${APP}?view=${view}`;
const SAMPLE = DEFAULT_PROFILE;
const placeName = (c) => c.name.replace(/^Elsewhere in /, '');

const shell = 'mx-auto w-full max-w-6xl px-4 sm:px-6';
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400';
const h2 = 'text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-zinc-950 sm:text-4xl dark:text-white';
const lede = 'mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400';
const primary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-(--accent) px-5 py-3 text-[15px] font-semibold text-(--accent-ink) shadow-[0_10px_30px_-10px_rgb(16_185_129/0.7),inset_0_1px_0_rgb(255_255_255/0.25)] transition hover:-translate-y-px hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)';
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-md border border-(--line-strong) px-5 py-3 text-[15px] font-semibold text-zinc-900 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) dark:text-zinc-100 dark:hover:bg-white/5';

/** A basement suite rents for about 80% of the city's two-bedroom average (a one-bedroom). */
const suiteRent = (place) => Math.round((place.rent * 0.8) / 25) * 25;

/**
 * The city's typical house, bought as a first home with the least down:
 * the cash it takes, what it costs each month, and the income a bank wants,
 * on your own or with a basement suite rented out.
 */
function buyOption(units, place) {
  const { rate, insurancePerUnit } = DEFAULT_MARKET;
  const { price, taxPct } = place;
  const rentIn = units > 1 ? suiteRent(place) : 0;
  const taxes = (price * taxPct) / 1200;
  const c = buyCheck({ profile: { ...SAMPLE, city: place.key, savings: Infinity, income: 1e9 }, price, units, ratePct: rate, taxesMonthly: taxes, rentFromOthers: rentIn, city: place.key });
  const insurance = Math.max(insurancePerUnit * units, INSURANCE_MIN) / 12;
  const outgoing = c.plan.payment + taxes + insurance + RULES.heatMonthly;
  const income = incomeToQualify({ price, units, ratePct: rate, taxPct, rentPerOtherUnit: rentIn, city: place.key });
  return { price, down: c.down, downPct: c.down / price, cashNeeded: c.cashNeeded, payment: c.plan.payment, rest: taxes + insurance + RULES.heatMonthly, rentIn, outgoing, live: outgoing - rentIn, income };
}

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

/** The listings for the picked city once the run has some there, else Thunder Bay's. */
function useFeed(city) {
  const index = useData(INDEX_DOC, isIndex);
  const shown = listingCity(null, city, index || null);
  return { feed: useData(feedDoc(shown), isFeed), shown, index };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

const longDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

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
        <Compare city={city} onCity={setCity} />
        <How />
        <Features />
        <Money city={city} />
        <Today feed={feed} shown={shown} picked={city} index={index} />
        <RedTape city={city} />
        <Trust />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

const NAV = [
  ['Find a home', '/homes/'],
  ['List a home', '/app/?view=landlord'],
  ['How it works', '#how'],
  ['Money you can get', '#money'],
  ['Questions', '#faq'],
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
    <header className="sticky top-0 z-30 border-b border-hairline bg-(--page)/90 backdrop-blur supports-[backdrop-filter]:bg-(--page)/75">
      <div className={`${shell} flex h-16 items-center justify-between gap-4`}>
        <a href="/" aria-label="Bedrock home" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)">
          <Logo />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-400">
          {NAV.map(([label, href]) => (
            <a key={label} className="hover:text-zinc-950 dark:hover:text-white" href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <a href={APP} className={`${primary} px-4 py-2 text-sm`}>
            Open the app
          </a>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? 'Close menu' : 'Menu'}
            className="grid size-10 place-items-center rounded-md text-zinc-700 hover:bg-well md:hidden dark:text-zinc-300"
          >
            {menu ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {menu && (
        <nav id="site-menu" aria-label="Menu" className="border-t border-hairline md:hidden">
          <ul className={`${shell} divide-y divide-hairline py-2`}>
            {NAV.map(([label, href]) => (
              <li key={label}>
                <a href={href} onClick={() => setMenu(false)} className="block py-3 text-base font-medium text-zinc-800 dark:text-zinc-200">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function Hero({ city, onCity }) {
  return (
    <section className="relative isolate border-b border-hairline">
      <div className="hero-backdrop" aria-hidden />
      <div className={`${shell} relative pb-16 pt-14 sm:pt-20 lg:pb-24`}>
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_minmax(0,27rem)] lg:gap-16">
          <div className="rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-(--line-strong) bg-(--panel)/60 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:text-zinc-300">
              <span className="live-dot" aria-hidden /> For first-time buyers across Canada
            </p>
            <h1 className="mt-6 max-w-4xl text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] text-balance text-zinc-950 sm:text-6xl lg:text-[72px] dark:text-white">
              Own your first home.{' '}
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-emerald-400 dark:to-teal-300">
                Let a tenant help pay for it.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">
              Bedrock shows what a bank would lend you, the government money you can claim where you live, and how renting out part of a home cuts both the income you need and what it costs you each month.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={open('home')} className={primary}>
                See what you can buy <ArrowRight className="size-4" aria-hidden />
              </a>
              <a href="/homes/" className={secondary}>
                Find a home to rent or buy
              </a>
            </div>
            <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">Free. No sign-up. Your numbers stay in your browser.</p>
          </div>
          <Estimator city={city} onCity={onCity} />
        </div>

        <Reveal className="relative mt-16 sm:mt-24">
          <figure className="shot overflow-hidden rounded-lg bg-(--panel) max-sm:hidden">
            <img
              src="/landing/desktop-listings.webp"
              width="1600"
              height="1000"
              alt="Bedrock’s Listings tab: homes for sale ranked by cash flow, each with what it would cost to live in, the lender’s DSCR and the return."
              className="block h-auto w-full"
              loading="lazy"
            />
          </figure>
          <figure className="shot mx-auto max-w-[300px] overflow-hidden rounded-[22px] bg-(--panel) sm:absolute sm:-bottom-10 sm:right-6 sm:w-[24%] sm:max-w-[250px] lg:-bottom-14 lg:right-10">
            <img
              src="/landing/phone-home.webp"
              width="780"
              height="1688"
              alt="Bedrock on a phone, the Home tab: you could buy up to $293,000, with what renting out a unit adds."
              className="block h-auto w-full"
              loading="lazy"
            />
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

const slider =
  'mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-(--track) accent-(--accent) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent) [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--accent) [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--focus-ring)] [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-(--accent)';

/**
 * The hero's live estimate: drag income and savings, and the same engine
 * as the app works out the most a bank would let you pay in the picked
 * city, on your own and with a basement suite rented out.
 */
function Estimator({ city, onCity }) {
  const [income, setIncome] = useState(SAMPLE.income);
  // Enough saved that income sets the limit, so the suite's effect shows straight away.
  const [savings, setSavings] = useState(60000);
  const place = cityByKey(city);
  const result = useMemo(() => {
    const profile = { ...SAMPLE, income, savings, city: place.key, entered: true };
    const common = { profile, ratePct: DEFAULT_MARKET.rate, taxPct: place.taxPct, city: place.key };
    const alone = maxPrice({ ...common, units: 1 });
    const suite = maxPrice({ ...common, units: 2, rentPerOtherUnit: suiteRent(place) });
    return { alone, suite, typical: place.price };
  }, [income, savings, place]);
  const top = Math.max(result.suite.price, result.alone.price, 1);
  const gain = result.suite.price - result.alone.price;
  const limitText = (r) => (r.limit === 'savings' ? 'Held back by your savings.' : 'Held back by your income.');
  const bar = (v, accent) => (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--track)">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${accent ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-zinc-400 dark:bg-zinc-500'}`}
        style={{ width: `${Math.max((v / top) * 100, 2)}%` }}
      />
    </div>
  );
  return (
    <div className="elevated rise relative rounded-xl p-5 sm:p-6" style={{ animationDelay: '80ms' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-950 dark:text-white">Try it: what could you buy?</p>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Live</span>
      </div>
      <div className="mt-4">
        <CitySelect id="hero-city" label="Where" value={city} onChange={onCity} />
      </div>
      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="flex items-baseline justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Household income <span className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{money(income)}/yr</span>
          </span>
          <input type="range" min="30000" max="300000" step="1000" value={income} onChange={(e) => setIncome(Number(e.target.value))} className={slider} aria-valuetext={`${money(income)} a year`} />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Saved for buying <span className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{money(savings)}</span>
          </span>
          <input type="range" min="0" max="300000" step="1000" value={savings} onChange={(e) => setSavings(Number(e.target.value))} className={slider} aria-valuetext={money(savings)} />
        </label>
      </div>

      <div className="mt-6 space-y-4 border-t border-hairline pt-5" aria-live="polite">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">On your own</span>
            <CountUp value={result.alone.price} format={money} className="text-lg font-semibold text-zinc-950 dark:text-white" />
          </div>
          {bar(result.alone.price, false)}
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{limitText(result.alone)}</p>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">With a suite rented out</span>
            <CountUp value={result.suite.price} format={money} className="text-2xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400" />
          </div>
          {bar(result.suite.price, true)}
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {gain > 0 ? `${money(gain)} more, because a bank counts the suite’s ${money(suiteRent(place))}/mo rent. ` : ''}
            {limitText(result.suite)}
          </p>
        </div>
      </div>
      <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
        A typical house in {placeName(place)}: {money(result.typical)}. {SAMPLE.debts > 0 ? `Counts ${money(SAMPLE.debts)}/mo of debts and ` : ''}a {DEFAULT_MARKET.rate}% rate with the stress test.
      </p>
      <a href={open('home')} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        Get your full answer <ArrowRight className="size-4" aria-hidden />
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
      .filter((l) => l.units >= 2 && l.units <= 4)
      .map((l) => ({ l, h: homeFor(listingToDeal(l, market, 'own'), { ...SAMPLE, city: shown }, market.rate) }))
      .filter((x) => x.h)
      .sort((a, b) => a.h.costToLive - b.h.costToLive);
    return {
      count: active.length,
      added: feed.lastRun?.added ?? 0,
      date: feed.lastRun?.date,
      median: median(active.map((l) => Number(l.price) || 0).filter(Boolean)),
      underRent: homes.filter((x) => x.h.costToLive < place.rent).length,
      top: homes.slice(0, 3),
    };
  }, [feed, shown, place.rent]);

  const stats = [
    [`${placeName(place)} homes for sale we track`, data?.count, String],
    ['New in the latest update', data?.added, String],
    ['Typical asking price', data?.median, money],
    [`2–4 units that cost less to live in than renting a two-bedroom (${money(place.rent)}/mo)`, data?.underRent, String],
  ];

  return (
    <section id="today" aria-labelledby="today-title" className="scroll-mt-16 border-b border-hairline">
      <Reveal className={`${shell} py-16 sm:py-24`}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className={eyebrow}>Daily listings · {covered > 1 ? `${covered} cities so far` : 'cities across Canada'}</p>
            <h2 id="today-title" className={`${h2} mt-3`}>
              Found every morning. Worked out for you.
            </h2>
            {shown !== picked && (
              <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                {wanted.key.endsWith('-other')
                  ? `The morning run searches 27 cities; here’s ${placeName(place)} to show how it works.`
                  : `The morning run hasn’t reached ${placeName(wanted)} yet; it searches every city about once a week. Here’s ${placeName(place)} meanwhile.`}
              </p>
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {data ? `Updated ${longDate(data.date)}` : feed === false ? 'Couldn’t load today’s listings.' : 'Loading today’s listings…'}
          </p>
        </div>

        <dl className="mt-10 grid grid-cols-2 border-y border-hairline lg:grid-cols-4">
          {stats.map(([label, value, format], i) => (
            <div key={label} className={`py-6 pr-4 ${i % 2 ? 'pl-4 sm:pl-6' : ''} ${i >= 2 ? 'max-lg:border-t max-lg:border-hairline' : ''} lg:border-l lg:border-hairline lg:pl-6 lg:first:border-l-0 lg:first:pl-0`}>
              <dt className="text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
                {data ? <CountUp value={value} format={format} /> : '—'}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Cheapest to live in right now</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Live in one unit, rent the others. Mortgage, tax, insurance, utilities and a repair fund, minus the rent coming in.</p>
          <ol className="mt-4 divide-y divide-hairline border-y border-hairline">
            {(data?.top ?? [null, null, null]).map((x, i) => (
              <li key={x?.l.id ?? i} className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-x-3 py-4 sm:grid-cols-[2rem_1fr_8rem_9rem]">
                <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-950 dark:text-white">{x ? x.l.address : ' '}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{x ? `${['', '', 'Duplex', 'Triplex', 'Fourplex'][x.l.units]} · ${money(x.l.price)}` : ' '}</span>
                </span>
                <span className="hidden text-right text-sm text-zinc-500 dark:text-zinc-400 sm:block">{x ? `${money(x.h.down)} down` : ''}</span>
                <span className="text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{x ? `${money(x.h.costToLive)}/mo` : ''}</span>
              </li>
            ))}
          </ol>
          <a href={`${open('listings')}&city=${shown}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            See all {data ? data.count : ''} listings <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </Reveal>
    </section>
  );
}

function Compare({ city, onCity }) {
  const place = cityByKey(city);
  const solo = buyOption(1, place);
  const suite = buyOption(2, place);
  const where = placeName(place);
  return (
    <section aria-labelledby="compare-title" className="border-b border-hairline">
      <Reveal className={`${shell} py-16 sm:py-24`}>
        <p className={eyebrow}>What a house really takes</p>
        <h2 id="compare-title" className={`${h2} mt-3 max-w-3xl`} aria-live="polite">
          A typical house in {where} costs about {money(place.price)}. Rent out a suite and it costs you {money(solo.live - suite.live)} a month less.
        </h2>
        <p className={lede}>
          A bank counts the suite’s rent as your income, so you need less of your own to qualify. Then the tenant pays part of the mortgage every month. Here’s the same house
          both ways.
        </p>
        <div className="mt-8 max-w-sm">
          <CitySelect id="compare-city" label="Pick a city" value={place.key} onChange={onCity} />
        </div>
        <div className="elevated mt-8 grid overflow-hidden rounded-xl md:grid-cols-2">
          <Option title="On your own" o={solo} rentToday={place.rent} where={where} />
          <Option title="With a basement suite rented out" o={suite} rentToday={place.rent} where={where} accent className="max-md:border-t md:border-l border-hairline" />
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          A typical detached house, fall 2026{place.priceEstimated ? ' (our estimate from the local average)' : ', from the local real estate board'}. {Math.round(solo.downPct * 100)}% down
          {solo.downPct >= 0.2 ? ' (homes over $1.5 million can’t be insured, so 20% is the least)' : ' with mortgage insurance'}, a {DEFAULT_MARKET.rate}% five-year fixed rate
          over 30 years, the land transfer tax in {where} after first-buyer relief, property tax of about {place.taxPct}% of the price, and a suite renting for{' '}
          {money(suite.rentIn)} a month. The same price both ways; a house that already has a legal suite often costs more. Estimates, not financial advice.
        </p>
      </Reveal>
    </section>
  );
}

function Option({ title, o, rentToday, where, accent = false, className = '' }) {
  const row = 'flex items-baseline justify-between gap-4 py-2.5 text-[15px]';
  return (
    <div className={`p-6 sm:p-8 ${className}`}>
      <h3 className="text-base font-semibold text-zinc-950 dark:text-white">{title}</h3>
      <dl className="mt-5 border-t border-hairline">
        <div className={row}>
          <dt className="text-zinc-600 dark:text-zinc-400">Household income a bank wants</dt>
          <dd className="font-semibold tabular-nums text-zinc-950 dark:text-white">{o.income ? `${money(o.income)}/yr` : 'Over $2 million'}</dd>
        </div>
        <div className={row}>
          <dt className="text-zinc-600 dark:text-zinc-400">Cash to buy it</dt>
          <dd className="tabular-nums">{money(o.cashNeeded)}</dd>
        </div>
        <div className={row}>
          <dt className="text-zinc-600 dark:text-zinc-400">Mortgage payment</dt>
          <dd className="tabular-nums">{money(o.payment)}/mo</dd>
        </div>
        <div className={row}>
          <dt className="text-zinc-600 dark:text-zinc-400">Tax, insurance and heat</dt>
          <dd className="tabular-nums">{money(o.rest)}/mo</dd>
        </div>
        <div className={row}>
          <dt className="text-zinc-600 dark:text-zinc-400">Rent from the suite</dt>
          <dd className="tabular-nums">{o.rentIn ? `−${money(o.rentIn)}/mo` : '—'}</dd>
        </div>
      </dl>
      <div className="mt-2 flex items-baseline justify-between gap-4 border-t-[3px] border-double border-(--line-strong) pt-4">
        <span className="font-semibold text-zinc-950 dark:text-white">Costs you each month</span>
        <span className={`text-3xl font-semibold tabular-nums tracking-tight ${accent ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'}`}>{money(o.live)}</span>
      </div>
      <p className="mt-2 text-right text-[13px] text-zinc-500 dark:text-zinc-400">
        Renting a two-bedroom in {where}: about {money(rentToday)}/mo
      </p>
    </div>
  );
}

function How() {
  const steps = [
    ['Tell it about you', 'Income, savings, debts and the rent you pay. Two minutes, and nothing leaves your device.'],
    ['See what you can buy', 'On your own and with a tenant, under the real rules: 5% down, mortgage insurance, the stress test and the 30-year first-buyer mortgage.'],
    ['Find the home', 'Every morning’s listings, sorted by what each would cost you to live in, with a tag on the ones you’d qualify for.'],
  ];
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-16 border-b border-hairline">
      <Reveal className={`${shell} py-16 sm:py-24`}>
        <p className={eyebrow}>How it works</p>
        <h2 id="how-title" className={`${h2} mt-3`}>
          From “can I even?” to a shortlist.
        </h2>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map(([t, b], i) => (
            <li key={t} className="elevated relative overflow-hidden rounded-xl p-6 sm:p-8">
              <span aria-hidden className="pointer-events-none absolute -right-2 -top-6 text-[120px] font-semibold leading-none tracking-tighter text-zinc-950/[0.04] dark:text-white/[0.04]">
                {i + 1}
              </span>
              <span className="grid size-8 place-items-center rounded-full bg-emerald-500/10 text-sm font-semibold tabular-nums text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-400">{i + 1}</span>
              <h3 className="mt-6 text-lg font-semibold text-zinc-950 dark:text-white">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

function Features() {
  const items = [
    [Home, 'Home check', 'The most you could pay, held back by your income or your savings, and what it costs you each month next to your rent.', 'home'],
    [Landmark, 'Money you can get', 'FHSA refunds, the land transfer tax refund, the buyers’ tax credit and the RRSP Home Buyers’ Plan, added up for you.', 'home'],
    [ListChecks, 'Morning listings', 'Homes for sale in 27 cities, with the cost to live in each and whether a bank would say yes. Thunder Bay daily, the rest about weekly.', 'listings'],
    [ClipboardCheck, 'Permit guide', 'Adding a basement suite or a backyard home, step by step: what your province and city allow, what to submit, and whether it pays.', 'home'],
    [Plus, 'List a home, free', 'Put a home up for rent or for sale with photos. People find it in Bedrock’s search, book a time to see it and message you here.', 'landlord'],
    [KeyRound, 'Landlord tools', 'Applications and viewings from your calendar, rent tracking, repair requests, and expenses sorted for tax time.', 'landlord'],
    [Building2, 'Rental math', 'Every cost of a rental, the lender’s DSCR test, a stress test and a 10-year outlook, in plain words.', 'analyze'],
  ];
  const tile = (Icon, t, b, view, i, extra = '') => (
    <Reveal key={t} delay={i * 50} className={extra}>
      <a
        href={open(view)}
        className="tile group flex h-full flex-col rounded-xl border border-hairline bg-(--panel) p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) sm:p-6"
      >
        <span className="flex items-center justify-between">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 ring-inset dark:text-emerald-400">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <ArrowUpRight className="size-4 text-zinc-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-zinc-600 dark:group-hover:text-emerald-400" aria-hidden />
        </span>
        <span className="mt-5 block font-semibold text-zinc-950 dark:text-white">{t}</span>
        <span className="mt-1.5 block text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</span>
      </a>
    </Reveal>
  );
  return (
    <section aria-labelledby="features-title" className="border-b border-hairline">
      <div className={`${shell} py-16 sm:py-24`}>
        <Reveal className="max-w-2xl">
          <p className={eyebrow}>What’s inside</p>
          <h2 id="features-title" className={`${h2} mt-3`}>
            Everything a broker would check, before you call one.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_auto_auto]">
          <Reveal className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
            <a
              href={open('listings')}
              className="tile group relative flex h-full flex-col overflow-hidden rounded-xl border border-hairline bg-(--panel) p-5 sm:p-6"
            >
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                <span className="live-dot" aria-hidden /> Updated every morning
              </span>
              <span className="mt-3 block text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">Every listing, run through your numbers.</span>
              <span className="mt-2 block max-w-md text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Cost to live in, what a bank would say, cash flow per door and the lender’s DSCR, for homes for sale in 27 cities.
              </span>
              <img
                src="/landing/phone-listings.webp"
                width="780"
                height="1688"
                loading="lazy"
                alt="Bedrock’s Listings tab on a phone, with each home’s cost to live in."
                className="shot mx-auto mt-6 -mb-40 w-[62%] max-w-[16rem] rounded-[20px] transition duration-500 group-hover:-translate-y-2 sm:-mb-56 lg:mt-auto lg:-mb-64"
              />
            </a>
          </Reveal>
          {items.map(([Icon, t, b, view], i) => tile(Icon, t, b, view, i, i === 6 ? 'sm:col-span-2 lg:col-span-2' : ''))}
        </div>
      </div>
    </section>
  );
}

function Money({ city }) {
  const place = cityByKey(city);
  // Earning what a bank wants for the city's typical house with a suite, and maxing the FHSA.
  const income = buyOption(2, place).income ?? SAMPLE.income;
  const b = benefits({ profile: { ...SAMPLE, city: place.key, income, monthlySave: 700 }, price: place.price, units: 2 });
  const list = b.list.filter((x) => x.key !== 'refi');
  return (
    <section id="money" aria-labelledby="money-title" className="scroll-mt-16 border-b border-hairline">
      <Reveal className={`${shell} py-16 sm:py-24`}>
        <p className={eyebrow}>Money you can get</p>
        <h2 id="money-title" className={`${h2} mt-3 max-w-3xl`}>
          About {money(b.total)} back in the first year, plus {money(RULES.hbp)} you can borrow from yourself.
        </h2>
        <p className={lede}>
          For a first-time buyer in {placeName(place)} buying the typical {money(place.price)} house, earning the {money(income)} a bank would want with a suite, and putting
          $8,000 a year in an FHSA. Your own amounts are one tap away.
        </p>
        <ul className="mt-10 divide-y divide-hairline border-y border-hairline">
          {list.map((x) => (
            <li key={x.key} className="grid gap-x-8 gap-y-1 py-5 sm:grid-cols-[1fr_auto]">
              <div>
                <a href={x.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-zinc-950 hover:underline dark:text-white">
                  {x.name}
                  <ArrowUpRight className="size-3.5 text-zinc-400" aria-hidden />
                  <span className="sr-only">(official page, opens in a new tab)</span>
                </a>
                <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{x.what}</p>
              </div>
              <p className="text-lg font-semibold tabular-nums text-zinc-950 sm:text-right dark:text-white">
                {x.amount ? money(x.amount) : `${money(x.access)} to borrow`}
                {x.amount > 0 && <span className="ml-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">{x.per}</span>}
              </p>
            </li>
          ))}
        </ul>
        <a href={open('home')} className={`${secondary} mt-8`}>
          Work out yours
        </a>
      </Reveal>
    </section>
  );
}

function RedTape({ city }) {
  const steps = stepsFor(city);
  return (
    <section aria-labelledby="tape-title" className="border-b border-hairline">
      <Reveal className={`${shell} py-16 sm:py-24`}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,24rem)_1fr]">
          <div>
            <p className={eyebrow}>Cutting the red tape</p>
            <h2 id="tape-title" className={`${h2} mt-3`}>
              Add a suite without getting lost at city hall.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Most Canadian cities now allow a basement suite or a backyard home on a house lot, and many allow three or four homes. Bedrock walks you through the permit, the rules
              in your province, and how fast the rent pays back the build.
            </p>
          </div>
          <ol className="divide-y divide-hairline border-y border-hairline">
            {steps.map((s, i) => (
              <li key={s.key} className="grid grid-cols-[2rem_1fr] gap-x-3 py-4">
                <span className="text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-zinc-950 hover:underline dark:text-white">
                    {s.title}
                    <span className="sr-only"> (city page, opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="font-medium text-zinc-950 dark:text-white">{s.title}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </section>
  );
}

function Trust() {
  const items = [
    [ClipboardCheck, `Rules checked ${longDate(RULES_CHECKED)}`, 'Down payments, insurance premiums, the stress test and every program amount, each linked to its official source.'],
    [Lock, 'Your numbers stay with you', 'No account and no server storing your income. Everything is saved in your own browser.'],
    [Landmark, 'Free for renters and buyers', 'Searching, applying, the calculators and the first-home tools cost nothing. Landlords track their first unit free; after that it’s 2% of rent, at most $30 a unit.'],
  ];
  return (
    <section aria-label="Why trust it" className="border-b border-hairline bg-(--panel)">
      <div className={`${shell} grid gap-10 py-14 md:grid-cols-3`}>
        {items.map(([Icon, t, b]) => (
          <div key={t}>
            <Icon className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <h3 className="mt-4 font-semibold text-zinc-950 dark:text-white">{t}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  [
    'Can I really buy a duplex with 5% down?',
    'Yes, if you live in one of the units. With two units, 5% of the first $500,000 and 10% of the rest is the minimum, the same as a house. Three and four unit homes need at least 10%.',
  ],
  [
    'Will a bank count the rent from the other unit?',
    'For a two-unit home you live in, insured lenders can count the rent toward your income. With three or four units, about half of it. Bedrock uses those rules when it works out what you can borrow.',
  ],
  [
    'Is this financial advice?',
    'No. Bedrock gives you careful estimates so you walk into a broker’s office knowing your numbers. A mortgage broker or lender confirms the real ones.',
  ],
  [
    'Where do the listings come from?',
    'Public listing sites, searched each morning: Thunder Bay every day, and 26 more cities across Canada in turn, so each is refreshed about once a week. Each one links to its original page, and Bedrock fills gaps like rent with local averages you can change.',
  ],
  [
    'What does it cost?',
    'Nothing for renters, buyers or the calculators, and listing a home is free. Landlords who track rent pay 2% of each tenanted unit’s rent a month, at most $30 a unit, and their first unit is free. A property manager usually takes 8 to 12%.',
  ],
  [
    'Does it work where I live?',
    'Yes, anywhere in Canada. Pick your city and Bedrock uses your province’s land transfer tax and first-buyer programs, with local rent and property tax you can change. The morning listings cover 27 cities, from Victoria to St. John’s.',
  ],
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-b border-hairline">
      <div className={`${shell} grid gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,24rem)_1fr]`}>
        <div>
          <p className={eyebrow}>Questions</p>
          <h2 id="faq-title" className={`${h2} mt-3`}>
            Good to know.
          </h2>
        </div>
        <div className="divide-y divide-hairline border-y border-hairline">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-zinc-950 marker:hidden dark:text-white [&::-webkit-details-marker]:hidden">
                {q}
                <Plus className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400 transition group-open:rotate-45" aria-hidden />
              </summary>
              <p className="-mt-1 pb-5 pr-8 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section aria-labelledby="closing-title">
      <div className={`${shell} py-20 text-center sm:py-28`}>
        <h2 id="closing-title" className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-zinc-950 sm:text-5xl dark:text-white">
          Find out how close you are.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">Two minutes, free, and nothing to sign up for.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={open('home')} className={primary}>
            See what you can buy <ArrowRight className="size-4" aria-hidden />
          </a>
          <a href={open('analyze')} className={secondary}>
            Run a rental deal
          </a>
        </div>
      </div>
    </section>
  );
}
