import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, ClipboardCheck, Home, KeyRound, Landmark, Menu, Plus, X } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { DEFAULT_PROFILE, RULES_CHECKED, homeFor, maxPrice } from '../lib/firstHome.js';
import { CountUp, Reveal } from './motion.jsx';
import { cityByKey, guessCity } from '../lib/canada.js';
import CitySelect from '../components/CitySelect.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import AccountLink from '../components/AccountLink.jsx';
import { DEFAULT_MARKET, INDEX_DOC, feedDoc, listingCity, listingToDeal, localMarket } from '../lib/market.js';
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
const h2 = 'text-balance text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-950 sm:text-[34px] dark:text-white';
const section = 'py-14 sm:py-20';
const lede = 'mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400';
const primary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-(--accent) px-5 py-3 text-[15px] font-semibold text-(--accent-ink) shadow-[0_10px_30px_-10px_rgb(16_185_129/0.7),inset_0_1px_0_rgb(255_255_255/0.25)] transition hover:-translate-y-px hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)';
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-md border border-(--line-strong) px-5 py-3 text-[15px] font-semibold text-zinc-900 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) dark:text-zinc-100 dark:hover:bg-white/5';

/** A basement suite rents for about 80% of the city's two-bedroom average (a one-bedroom). */
const suiteRent = (place) => Math.round((place.rent * 0.8) / 25) * 25;

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
        <How />
        <Features />
        <Today feed={feed} shown={shown} picked={city} index={index} />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

const NAV = [
  ['Find a home', '/homes/'],
  ['Your account', '/account/'],
  ['List a home', '/app/?view=landlord'],
  ['How it works', '#how'],
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
        <a href="/" aria-label="Squarely home" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)">
          <Logo />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-400">
          {NAV.filter(([, href]) => href !== '/account/').map(([label, href]) => (
            <a key={label} className="hover:text-zinc-950 dark:hover:text-white" href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <AccountLink className="max-sm:hidden" />
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
      <div className={`${shell} relative pb-14 pt-12 sm:pt-16 lg:pb-20`}>
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_minmax(0,27rem)] lg:gap-16">
          <div className="rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-(--line-strong) bg-(--panel)/60 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:text-zinc-300">
              <span className="live-dot" aria-hidden /> For first-time buyers across Canada
            </p>
            <h1 className="mt-6 max-w-4xl text-[40px] font-extrabold leading-[1.02] tracking-[-0.042em] text-balance text-zinc-950 sm:text-6xl lg:text-[72px] dark:text-white">
              Own your first home.{' '}
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-emerald-400 dark:to-teal-300">
                Let a tenant help pay for it.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">
              See what a bank would lend you, the money you can claim, and how renting out a suite makes your first home cost less than rent.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={open('home')} className={primary}>
                See what you can buy <ArrowRight className="size-4" aria-hidden />
              </a>
              <a href="/homes/" className={secondary}>
                Find a home to rent or buy
              </a>
            </div>
            <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">Free · No sign-up · Anywhere in Canada</p>
          </div>
          <Estimator city={city} onCity={onCity} />
        </div>

        <Reveal className="relative mt-14 sm:mt-20">
          <figure className="shot overflow-hidden rounded-lg bg-(--panel) max-sm:hidden">
            <img
              src="/landing/desktop-listings-2.webp"
              width="1600"
              height="1000"
              alt="Squarely’s Listings tab: homes for sale ranked by cash flow, each with what it would cost to live in, the lender’s DSCR and the return."
              className="block h-auto w-full"
              loading="lazy"
            />
          </figure>
          <figure className="shot mx-auto max-w-[300px] overflow-hidden rounded-[22px] bg-(--panel) sm:absolute sm:-bottom-10 sm:right-6 sm:w-[24%] sm:max-w-[250px] lg:-bottom-14 lg:right-10">
            <img
              src="/landing/phone-home-2.webp"
              width="780"
              height="1688"
              alt="Squarely on a phone, the Home tab: you could buy up to $293,000, with what renting out a unit adds."
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
      top: homes.slice(0, 3),
    };
  }, [feed, shown]);

  return (
    <section id="today" aria-labelledby="today-title" className="scroll-mt-16 border-b border-hairline">
      <Reveal className={`${shell} ${section}`}>
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


        <div className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Cheapest to live in right now</h3>
            <p className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
              {data ? `${data.count} homes tracked · ${data.added} new · typical ${money(data.median)}` : ' '}
            </p>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Live in one unit, rent the others: what it costs you each month.</p>
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

function How() {
  const steps = [
    ['Tell it about you', 'Income, savings and the rent you pay now. Two minutes, and it stays on your device.'],
    ['See what you can buy', 'On your own and with a tenant, under the real rules for your province.'],
    ['Find the home', 'Listings sorted by what each would cost you to live in, every morning.'],
  ];
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-16 border-b border-hairline">
      <Reveal className={`${shell} ${section}`}>
        <p className={eyebrow}>How it works</p>
        <h2 id="how-title" className={`${h2} mt-3`}>
          From “can I even?” to a shortlist.
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map(([t, b], i) => (
            <li key={t} className="border-t border-(--line-strong) pt-5">
              <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">{t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

function Features() {
  const items = [
    [Home, 'Home check', 'What a bank would lend you, and what it costs each month next to your rent.', 'home'],
    [Landmark, 'Money you can get', 'FHSA, land transfer tax refunds, the buyers’ credit and the RRSP plan, added up.', 'home'],
    [ClipboardCheck, 'Suite permit guide', 'What your city allows, what to submit, and whether the rent pays it back.', 'home'],
    [KeyRound, 'Landlord tools', 'List a home free, then handle applications, rent and repairs in one place.', 'landlord'],
  ];
  return (
    <section aria-labelledby="features-title" className="border-b border-hairline">
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-2xl">
          <p className={eyebrow}>What’s inside</p>
          <h2 id="features-title" className={`${h2} mt-3`}>
            Everything a broker would check, before you call one.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <a
              href={open('listings')}
              className="tile group relative flex h-full min-h-72 flex-col overflow-hidden rounded-2xl border border-hairline bg-(--panel) p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) sm:p-7"
            >
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                <span className="live-dot" aria-hidden /> Updated every morning
              </span>
              <span className="mt-3 block text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">Every listing, run through your numbers.</span>
              <span className="mt-2 block max-w-sm text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">Homes for sale in 27 cities, with the cost to live in each.</span>
              <img
                src="/landing/phone-listings-2.webp"
                width="780"
                height="1688"
                loading="lazy"
                alt="Squarely’s Listings tab on a phone, with each home’s cost to live in."
                className="shot mx-auto mt-6 -mb-48 w-[56%] max-w-[15rem] rounded-[20px] transition duration-500 group-hover:-translate-y-2 sm:-mb-60 lg:mt-auto lg:-mb-72"
              />
            </a>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(([Icon, t, b, view], i) => (
              <Reveal key={t} delay={i * 50}>
                <a
                  href={open(view)}
                  className="tile group flex h-full flex-col rounded-2xl border border-hairline bg-(--panel) p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) sm:p-6"
                >
                  <span className="flex items-center justify-between">
                    <Icon className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                    <ArrowUpRight className="size-4 text-zinc-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-zinc-600 dark:group-hover:text-emerald-400" aria-hidden />
                  </span>
                  <span className="mt-6 block font-semibold text-zinc-950 dark:text-white">{t}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  [
    'Can I really buy a duplex with 5% down?',
    'Yes, if you live in one of the units. Two units need the same minimum as a house: 5% of the first $500,000 and 10% of the rest. Three and four units need at least 10%.',
  ],
  [
    'Will a bank count the rent from the other unit?',
    'For a two-unit home you live in, insured lenders can count the rent toward your income; with three or four units, about half of it. Squarely uses those rules.',
  ],
  [
    'What does it cost?',
    'Nothing for renters, buyers or the calculators, and listing a home is free. Landlords who track rent pay 2% of each tenanted unit’s rent, at most $30 a unit, and the first unit is free.',
  ],
  [
    'Is this financial advice?',
    'No. Squarely gives you careful estimates so you walk into a broker’s office knowing your numbers. A mortgage broker or lender confirms the real ones.',
  ],
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-b border-hairline">
      <div className={`${shell} grid gap-10 ${section} lg:grid-cols-[minmax(0,24rem)_1fr]`}>
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
    <section aria-labelledby="closing-title" className="relative isolate overflow-hidden">
      <div className="hero-backdrop opacity-70" aria-hidden />
      <div className={`${shell} relative py-20 text-center sm:py-24`}>
        <h2 id="closing-title" className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-zinc-950 sm:text-5xl dark:text-white">
          Find out how close you are.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">Two minutes, free, and nothing to sign up for.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={open('home')} className={primary}>
            See what you can buy <ArrowRight className="size-4" aria-hidden />
          </a>
          <a href="/homes/" className={secondary}>
            Browse homes
          </a>
        </div>
        <p className="mt-8 text-[13px] text-zinc-500 dark:text-zinc-400">Rules checked {longDate(RULES_CHECKED)} · Your numbers stay in your browser · Free for renters and buyers</p>
      </div>
    </section>
  );

}
