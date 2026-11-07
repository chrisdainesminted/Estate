import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ClipboardCheck, Hammer, Home, KeyRound, Landmark, Menu, Plus, Sparkles, Tag, TrendingUp, X } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { DEFAULT_PROFILE, RULES_CHECKED, homeFor, maxPrice } from '../lib/firstHome.js';
import { CountUp, Reveal } from './motion.jsx';
import { cityByKey, guessCity } from '../lib/canada.js';
import CitySelect from '../components/CitySelect.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import AccountLink from '../components/AccountLink.jsx';
import { DEFAULT_MARKET, INDEX_DOC, dedupeListings, feedDoc, listingCity, listingTaxes, listingToDeal, localMarket, unitsOf } from '../lib/market.js';
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
  const raw = useData(feedDoc(shown), isFeed);
  // The same home found twice (its address written two ways) counts once.
  const feed = useMemo(() => (raw ? { ...raw, listings: dedupeListings(raw.listings) } : raw), [raw]);
  return { feed, shown, index };
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
        <Paths />
        <How />
        <Features />
        <Today feed={feed} shown={shown} picked={city} index={index} />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

const NAV = [
  ['Find a home', '/homes/'],
  ['Find a lender', '/lenders/'],
  ['Your account', '/account/'],
  ['Sell free', '/sell/'],
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
      <div className={`${shell} flex h-16 items-center justify-between gap-4 max-[380px]:gap-2`}>
        <a href="/" aria-label="Squarely home" className="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)">
          <Logo />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-400">
          {NAV.filter(([, href]) => href !== '/account/').map(([label, href]) => (
            <a key={label} className="hover:text-zinc-950 dark:hover:text-white" href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 max-[380px]:gap-0">
          <AccountLink className="max-sm:hidden" />
          <a href={APP} className={`${primary} px-4 py-2 text-sm whitespace-nowrap max-[380px]:px-3`}>
            Open <span className="max-[380px]:hidden">the </span>app
          </a>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? 'Close menu' : 'Menu'}
            className="grid size-10 place-items-center rounded-md text-zinc-700 hover:bg-well max-[380px]:size-9 md:hidden dark:text-zinc-300"
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

/** The hero's second line: what the site does, one phrase at a time. */
const ROTATE = [
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
const GRADIENT =
  'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 bg-clip-text text-transparent dark:from-emerald-300 dark:via-emerald-400 dark:to-emerald-200';

const HOLD = 2600; // ms each phrase stays before the next spin
const SPIN_MS = 750;
const COPIES = 4; // the strip repeats the phrases so a spin can pass them all twice

/**
 * A wheel: every phrase sits on one vertical strip behind a window one
 * phrase tall. Each spin whips the strip past every phrase twice and stops
 * dead on the next one, then quietly jumps back to the same phrase on an
 * earlier copy so the strip never runs out. All phrases also sit invisibly
 * in one grid cell, which sets the window to the longest phrase's size, so
 * the page never jumps. Screen readers hear the first phrase only, and with
 * reduced motion the wheel never turns.
 */
function Rotator() {
  const n = ROTATE.length;
  const sizer = useRef(null);
  const [h, setH] = useState(0);
  const [pos, setPos] = useState(n); // index on the strip, starting on the second copy
  const [spinning, setSpinning] = useState(false);
  const [tick, setTick] = useState(0); // retries a spin skipped while the tab was hidden

  useEffect(() => {
    const el = sizer.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!h || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (spinning) {
      // Land even if the browser never reports the end of the spin.
      const t = setTimeout(() => landed(), SPIN_MS + 150);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (document.visibilityState !== 'visible') return setTick((k) => k + 1);
      setSpinning(true);
      setPos((p) => n * (COPIES - 1) + (((p % n) + 1) % n));
    }, HOLD);
    return () => clearTimeout(t);
  }, [h, pos, n, spinning, tick]);

  function landed() {
    setSpinning(false);
    setPos((p) => n + (p % n));
  }

  return (
    <span className="relative grid">
      <span className="sr-only">{ROTATE[0]}</span>
      <span ref={sizer} aria-hidden className="invisible col-start-1 row-start-1 grid">
        {ROTATE.map((t) => (
          <span key={t} className="col-start-1 row-start-1 pb-[0.08em]">
            {t}
          </span>
        ))}
      </span>
      {h > 0 ? (
        <span aria-hidden className="absolute inset-0 overflow-hidden">
          <span
            className={`block will-change-transform ${spinning ? 'wheel-spin' : ''}`}
            style={{
              transform: `translate3d(0, ${-pos * h}px, 0)`,
              transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 0.84, 0.3, 1)` : 'none',
              animationDuration: `${SPIN_MS}ms`,
            }}
            onTransitionEnd={(e) => e.target === e.currentTarget && landed()}
          >
            {Array.from({ length: n * COPIES }, (_, k) => (
              <span key={k} className={`${GRADIENT} block pb-[0.08em]`} style={{ height: h }}>
                {ROTATE[k % n]}
              </span>
            ))}
          </span>
        </span>
      ) : (
        <span aria-hidden className={`${GRADIENT} col-start-1 row-start-1 pb-[0.08em]`}>
          {ROTATE[0]}
        </span>
      )}
    </span>
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
              <span className="live-dot" aria-hidden /> For buyers, sellers and investors across Canada
            </p>
            <h1 className="mt-6 max-w-4xl text-[40px] font-extrabold leading-[1.02] tracking-[-0.042em] text-balance text-zinc-950 sm:text-6xl lg:text-[72px] dark:text-white">
              Real estate shouldn’t be scary. <Rotator />
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-pretty text-zinc-600 sm:text-xl dark:text-zinc-400">
              Your first home, your next sale, your next rental: real numbers and the next step, all in one place.
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
              src="/landing/desktop-listings-3.webp"
              width="1600"
              height="1000"
              alt="Squarely’s Listings tab: homes for sale in Thunder Bay ranked by cash flow per door, each with what it would cost to live in, the lender’s DSCR and the return."
              className="block h-auto w-full"
              loading="lazy"
            />
          </figure>
          <figure className="shot mx-auto max-w-[300px] overflow-hidden rounded-[22px] bg-(--panel) sm:absolute sm:-bottom-10 sm:right-6 sm:w-[24%] sm:max-w-[250px] lg:-bottom-14 lg:right-10">
            <img
              src="/landing/phone-home-3.webp"
              width="780"
              height="1328"
              alt="Squarely on a phone, My plan: you could buy up to $490,000 today, $401,000 on your own and $89,000 more with a rental unit."
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
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${accent ? 'bg-gradient-to-r from-emerald-500 to-emerald-300' : 'bg-zinc-400 dark:bg-zinc-500'}`}
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
      // Only homes with a real tax bill: a cost to live built on a guess isn't shown.
      .filter((l) => unitsOf(l) >= 2 && unitsOf(l) <= 4 && listingTaxes(l, market) != null)
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
                  : `The morning run hasn’t reached ${placeName(wanted)} yet; it searches every city about every nine days. Here’s ${placeName(place)} meanwhile.`}
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
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{x ? `${['', '', 'Duplex', 'Triplex', 'Fourplex'][unitsOf(x.l)]} · ${money(x.l.price)}` : ' '}</span>
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

const PATHS = [
  {
    icon: Home,
    title: 'Buying',
    lead: 'From “can I even?” to the keys.',
    points: ['What you could buy today, and the cash to close', 'Homes that fit you, marked fits, stretch or not yet', 'Every step from credit check to moving day'],
    view: 'home',
    cta: 'Start my plan',
  },
  {
    icon: Hammer,
    title: 'Building',
    lead: 'From a blueprint to a shopping list.',
    points: ['Upload your floor plan and we read the rooms', 'Studs, drywall, insulation, paint and floors, counted', 'A search at Home Depot, RONA, Home Hardware and Canadian Tire for each'],
    view: 'build',
    cta: 'Price my build',
  },
  {
    icon: Tag,
    title: 'Selling',
    lead: 'Know your number before an agent does.',
    points: ['What it’s likely worth, from similar homes for sale now', 'What you walk away with after commission and the mortgage', 'A sell-ready checklist, and a free listing to sell privately'],
    view: 'sell',
    cta: 'What’s my home worth?',
  },
  {
    icon: TrendingUp,
    title: 'Investing',
    lead: 'Every deal, run the way a lender runs it.',
    points: ['Cash flow, DSCR and the most you should pay', 'Listings across Canada ranked every morning', 'Landlord tools: rent, repairs and your T776 at tax time'],
    view: 'analyze',
    cta: 'Analyze a deal',
  },
];

function Paths() {
  return (
    <section aria-labelledby="paths-title" className="border-b border-hairline">
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-2xl">
          <p className={eyebrow}>One place for all of it</p>
          <h2 id="paths-title" className={`${h2} mt-3`}>
            Whatever you’re doing with a home.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PATHS.map((p, i) => (
            <Reveal key={p.title} delay={i * 50}>
              <a
                href={open(p.view)}
                className="tile group flex h-full flex-col rounded-2xl border border-hairline bg-(--panel) p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) sm:p-6"
              >
                <p.icon className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                <span className="mt-5 block text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">{p.title}</span>
                <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{p.lead}</span>
                <ul className="mt-4 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {p.points.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {x}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {p.cta} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
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
  const free = ['Your buying plan, checklists and next steps', 'Homes for you, every morning', 'What your home is worth, and what you’d walk away with', 'Materials lists from rooms you type in', 'Deal analysis, listings and calculators'];
  const plus = ['Pro deals: tax sales and lender, estate and court sales, with the numbers run', 'Blueprints read for you: upload a plan, get the materials list', 'Daily emails when a price drops or a new home fits you', 'Pricing report for your home, as a PDF', 'Deal memos and materials lists as PDFs', 'Ask Squarely: questions answered from your own numbers'];
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 border-b border-hairline">
      <div className={`${shell} ${section}`}>
        <Reveal className="max-w-2xl">
          <p className={eyebrow}>Pricing</p>
          <h2 id="pricing-title" className={`${h2} mt-3`}>
            Free to start. Plus when it saves you time.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-hairline bg-(--panel) p-6">
            <p className="text-lg font-semibold text-zinc-950 dark:text-white">Free</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">$0</p>
            <ul className="mt-5 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              {free.map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-emerald-600/60 bg-(--panel) p-6">
            <p className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-white">
              <Sparkles className="size-4 text-emerald-600" aria-hidden /> Plus
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              $12<span className="text-base font-medium text-zinc-500">/month</span>
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <li className="flex gap-2 font-medium">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Everything in Free
              </li>
              {plus.map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {x}
                </li>
              ))}
            </ul>
            <a href={open('home')} className={`${primary} mt-6`}>
              Start free, upgrade any time
            </a>
          </div>
          <div className="rounded-2xl border border-hairline bg-(--panel) p-6">
            <p className="text-lg font-semibold text-zinc-950 dark:text-white">Landlords</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              2%<span className="text-base font-medium text-zinc-500"> of rent tracked</span>
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              {['Listings where people apply and book viewings', 'Rent tracking, reminders and receipts', 'Repairs, expenses and your T776 tax pack', 'At most $30 a unit; your first unit is free'].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
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
                src="/landing/phone-listings-3.webp"
                width="780"
                height="1328"
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
    'Plans, checklists, listings and calculators are free, and listing a home is free. Squarely Plus is $12 a month for blueprint reading, daily price-drop and fit emails, pricing reports and PDFs. Landlords who track rent pay 2% of each tenanted unit’s rent, at most $30 a unit, and the first unit is free.',
  ],
  [
    'I’ve never talked to a lender. Where do I start?',
    <>
      Start with our{' '}
      <a href="/lenders/" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
        guide to finding a lender
      </a>
      : who lends, what to bring, what to ask, and how to check a broker’s licence in your province. Or ask us to introduce you to a licensed mortgage broker, free.
    </>,
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
