import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Building2, ClipboardCheck, Home, Landmark, ListChecks, Lock, Plus } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { DEFAULT_PROFILE, RULES, RULES_CHECKED, benefits, buyCheck, homeFor, incomeToQualify } from '../lib/firstHome.js';
import { stepsFor } from '../lib/suites.js';
import { cityByKey, guessCity } from '../lib/canada.js';
import CitySelect from '../components/CitySelect.jsx';
import { DEFAULT_MARKET, INSURANCE_MIN, MARKET, listingToDeal } from '../lib/market.js';
import { money } from '../lib/format.js';

/**
 * The website's front page at /. Every number on it comes from the same
 * engine as the app, worked out for a sample buyer (DEFAULT_PROFILE) and
 * the city the visitor picks (their time zone's guess to start), and the
 * listings are today's Thunder Bay feed.
 */

const APP = '/app/';
const open = (view) => `${APP}?view=${view}`;
const FEED_URL = `/data/${MARKET.doc}.json`;
const SAMPLE = DEFAULT_PROFILE;
const placeName = (c) => c.name.replace(/^Elsewhere in /, '');

const shell = 'mx-auto w-full max-w-6xl px-4 sm:px-6';
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400';
const h2 = 'text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-zinc-950 sm:text-4xl dark:text-white';
const lede = 'mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400';
const primary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-(--accent) px-5 py-3 text-[15px] font-semibold text-(--accent-ink) transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)';
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

function useFeed() {
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    let live = true;
    fetch(FEED_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((f) => live && setFeed(f && Array.isArray(f.listings) ? f : false))
      .catch(() => live && setFeed(false));
    return () => {
      live = false;
    };
  }, []);
  return feed;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

const longDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

export default function Landing() {
  const feed = useFeed();
  const [city, setCity] = useState(guessCity);
  return (
    <div className="min-h-dvh bg-(--page) text-zinc-900 antialiased dark:text-zinc-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-(--panel) focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Compare city={city} onCity={setCity} />
        <How />
        <Features />
        <Money city={city} />
        <Today feed={feed} />
        <RedTape city={city} />
        <Trust />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-(--page)/90 backdrop-blur supports-[backdrop-filter]:bg-(--page)/75">
      <div className={`${shell} flex h-16 items-center justify-between gap-4`}>
        <a href="/" aria-label="Bedrock home" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)">
          <Logo />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-400">
          <a className="hover:text-zinc-950 dark:hover:text-white" href="#today">
            Listings
          </a>
          <a className="hover:text-zinc-950 dark:hover:text-white" href="#how">
            How it works
          </a>
          <a className="hover:text-zinc-950 dark:hover:text-white" href="#money">
            Money you can get
          </a>
          <a className="hover:text-zinc-950 dark:hover:text-white" href="#faq">
            Questions
          </a>
        </nav>
        <a href={APP} className={`${primary} px-4 py-2 text-sm`}>
          Open the app
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-hairline">
      <div className={`${shell} pb-16 pt-14 sm:pt-20 lg:pb-24`}>
        <p className={eyebrow}>For first-time buyers across Canada</p>
        <h1 className="mt-5 max-w-4xl text-[40px] font-semibold leading-[1.04] tracking-[-0.04em] text-balance text-zinc-950 sm:text-6xl lg:text-[76px] dark:text-white">
          Own your first home. Let a tenant help pay for it.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">
          Bedrock shows what a bank would lend you, the government money you can claim where you live, and how renting out part of a home cuts both the income you need and what it costs you each month.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href={open('home')} className={primary}>
            See what you can buy <ArrowRight className="size-4" aria-hidden />
          </a>
          <a href={open('listings')} className={secondary}>
            Browse today’s listings
          </a>
        </div>
        <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">Free. No sign-up. Your numbers stay in your browser.</p>

        <div className="relative mt-14 sm:mt-20">
          <figure className="overflow-hidden rounded-md border border-(--line-strong) bg-(--panel) max-sm:hidden">
            <img
              src="/landing/desktop-listings.webp"
              width="1600"
              height="1000"
              alt="Bedrock’s Listings tab: Thunder Bay homes for sale ranked by cash flow, each with what it would cost to live in, the lender’s DSCR and the return."
              className="block h-auto w-full"
              fetchPriority="high"
            />
          </figure>
          <figure className="mx-auto max-w-[300px] overflow-hidden rounded-[22px] border border-(--line-strong) bg-(--panel) sm:absolute sm:-bottom-10 sm:right-6 sm:w-[24%] sm:max-w-[250px] lg:-bottom-14 lg:right-10">
            <img
              src="/landing/phone-home.webp"
              width="780"
              height="1688"
              alt="Bedrock on a phone, the Home tab: you could buy up to $293,000, with what renting out a unit adds."
              className="block h-auto w-full"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

/** Today's Thunder Bay feed, run through the same numbers as the app's Listings tab. */
function Today({ feed }) {
  const data = useMemo(() => {
    if (!feed) return null;
    const active = feed.listings.filter((l) => l.status !== 'removed');
    const homes = active
      .filter((l) => l.units >= 2 && l.units <= 4)
      .map((l) => ({ l, h: homeFor(listingToDeal(l, DEFAULT_MARKET, 'own'), SAMPLE, DEFAULT_MARKET.rate) }))
      .filter((x) => x.h)
      .sort((a, b) => a.h.costToLive - b.h.costToLive);
    return {
      count: active.length,
      added: feed.lastRun?.added ?? 0,
      date: feed.lastRun?.date,
      median: median(active.map((l) => Number(l.price) || 0).filter(Boolean)),
      underRent: homes.filter((x) => x.h.costToLive < SAMPLE.rentNow).length,
      top: homes.slice(0, 3),
    };
  }, [feed]);

  const stats = [
    ['Thunder Bay homes for sale we track', data ? String(data.count) : '—'],
    ['New in the latest update', data ? String(data.added) : '—'],
    ['Typical asking price', data ? money(data.median) : '—'],
    [`2–4 units that cost under ${money(SAMPLE.rentNow)}/mo to live in`, data ? String(data.underRent) : '—'],
  ];

  return (
    <section id="today" aria-labelledby="today-title" className="scroll-mt-16 border-b border-hairline">
      <div className={`${shell} py-16 sm:py-24`}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className={eyebrow}>Daily listings · Thunder Bay, more cities coming</p>
            <h2 id="today-title" className={`${h2} mt-3`}>
              Found every morning. Worked out for you.
            </h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {data ? `Updated ${longDate(data.date)}` : feed === false ? 'Couldn’t load today’s listings.' : 'Loading today’s listings…'}
          </p>
        </div>

        <dl className="mt-10 grid grid-cols-2 border-y border-hairline lg:grid-cols-4">
          {stats.map(([label, value], i) => (
            <div key={label} className={`py-6 pr-4 ${i % 2 ? 'pl-4 sm:pl-6' : ''} ${i >= 2 ? 'max-lg:border-t max-lg:border-hairline' : ''} lg:border-l lg:border-hairline lg:pl-6 lg:first:border-l-0 lg:first:pl-0`}>
              <dt className="text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{value}</dd>
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
          <a href={open('listings')} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            See all {data ? data.count : ''} listings <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
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
      <div className={`${shell} py-16 sm:py-24`}>
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
        <div className="mt-8 grid overflow-hidden rounded-md border border-(--line-strong) bg-(--panel) md:grid-cols-2">
          <Option title="On your own" o={solo} rentToday={place.rent} where={where} />
          <Option title="With a basement suite rented out" o={suite} rentToday={place.rent} where={where} accent className="max-md:border-t md:border-l border-hairline" />
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          A typical detached house, fall 2026{place.priceEstimated ? ' (our estimate from the local average)' : ', from the local real estate board'}. {Math.round(solo.downPct * 100)}% down
          {solo.downPct >= 0.2 ? ' (homes over $1.5 million can’t be insured, so 20% is the least)' : ' with mortgage insurance'}, a {DEFAULT_MARKET.rate}% five-year fixed rate
          over 30 years, the land transfer tax in {where} after first-buyer relief, property tax of about {place.taxPct}% of the price, and a suite renting for{' '}
          {money(suite.rentIn)} a month. The same price both ways; a house that already has a legal suite often costs more. Estimates, not financial advice.
        </p>
      </div>
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
      <div className={`${shell} py-16 sm:py-24`}>
        <p className={eyebrow}>How it works</p>
        <h2 id="how-title" className={`${h2} mt-3`}>
          From “can I even?” to a shortlist.
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-md border border-(--line-strong) bg-(--line-strong) md:grid-cols-3">
          {steps.map(([t, b], i) => (
            <li key={t} className="bg-(--panel) p-6 sm:p-8">
              <span className="text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">0{i + 1}</span>
              <h3 className="mt-6 text-lg font-semibold text-zinc-950 dark:text-white">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    [Home, 'Home check', 'The most you could pay, held back by your income or your savings, and what it costs you each month next to your rent.', 'home'],
    [Landmark, 'Money you can get', 'FHSA refunds, the land transfer tax refund, the buyers’ tax credit and the RRSP Home Buyers’ Plan, added up for you.', 'home'],
    [ListChecks, 'Morning listings', 'Homes for sale found each morning, with the cost to live in each and whether a bank would say yes. Thunder Bay for now; more cities are coming.', 'listings'],
    [ClipboardCheck, 'Permit guide', 'Adding a basement suite or a backyard home, step by step: what your province and city allow, what to submit, and whether it pays.', 'home'],
    [Building2, 'Rental math', 'Every cost of a rental, the lender’s DSCR test, a stress test and a 10-year outlook, in plain words.', 'analyze'],
  ];
  return (
    <section aria-labelledby="features-title" className="border-b border-hairline">
      <div className={`${shell} py-16 sm:py-24`}>
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_minmax(0,26rem)]">
          <div>
            <p className={eyebrow}>What’s inside</p>
            <h2 id="features-title" className={`${h2} mt-3`}>
              Everything a broker would check, before you call one.
            </h2>
            <ul className="mt-10 divide-y divide-hairline border-y border-hairline">
              {items.map(([Icon, t, b, view]) => (
                <li key={t}>
                  <a href={open(view)} className="group grid grid-cols-[2rem_1fr_auto] gap-x-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)">
                    <Icon className="mt-0.5 size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                    <span>
                      <span className="block font-semibold text-zinc-950 dark:text-white">{t}</span>
                      <span className="mt-1 block text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</span>
                    </span>
                    <ArrowUpRight className="mt-0.5 size-4 text-zinc-400 transition group-hover:text-emerald-700 dark:text-zinc-600 dark:group-hover:text-emerald-400" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <figure className="mx-auto w-full max-w-[22rem] overflow-hidden rounded-[22px] border border-(--line-strong) bg-(--panel) lg:sticky lg:top-24">
            <img
              src="/landing/phone-listings.webp"
              width="780"
              height="1688"
              loading="lazy"
              alt="Bedrock’s Listings tab on a phone, with each home’s cost to live in."
              className="block h-auto w-full"
            />
          </figure>
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
      <div className={`${shell} py-16 sm:py-24`}>
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
      </div>
    </section>
  );
}

function RedTape({ city }) {
  const steps = stepsFor(city);
  return (
    <section aria-labelledby="tape-title" className="border-b border-hairline">
      <div className={`${shell} py-16 sm:py-24`}>
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
      </div>
    </section>
  );
}

function Trust() {
  const items = [
    [ClipboardCheck, `Rules checked ${longDate(RULES_CHECKED)}`, 'Down payments, insurance premiums, the stress test and every program amount, each linked to its official source.'],
    [Lock, 'Your numbers stay with you', 'No account and no server storing your income. Everything is saved in your own browser.'],
    [Landmark, 'Free to use', 'No account and nothing to pay. Every figure shows how it was worked out, so you can check it with your broker.'],
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
    'Public listing sites, searched each morning, in Thunder Bay for now. Each one links to its original page, and Bedrock fills gaps like rent with local averages you can change.',
  ],
  [
    'Does it work where I live?',
    'Yes, anywhere in Canada. Pick your city and Bedrock uses your province’s land transfer tax and first-buyer programs, with local rent and property tax you can change. The morning listings are Thunder Bay only for now; more cities are coming.',
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

function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className={`${shell} flex flex-col gap-6 py-10 text-sm text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <Logo />
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <a className="hover:text-zinc-950 dark:hover:text-white" href={open('home')}>
            First home
          </a>
          <a className="hover:text-zinc-950 dark:hover:text-white" href={open('listings')}>
            Listings
          </a>
          <a className="hover:text-zinc-950 dark:hover:text-white" href={open('analyze')}>
            Rental calculator
          </a>
        </nav>
        <p>Estimates, not financial advice. © {new Date().getFullYear()} Bedrock</p>
      </div>
    </footer>
  );
}
