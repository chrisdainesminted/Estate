import PageShell, { a, h1, h2, lede, prose } from './PageShell.jsx';
import { RULES, RULES_CHECKED, premiumRate } from '../lib/firstHome.js';
import { DEFAULT_MARKET, LISTING_CITIES } from '../lib/market.js';
import { DEFAULT_TARGETS } from '../lib/finance.js';
import { RENT_VS_BUY_DEFAULTS } from '../lib/rentVsBuy.js';
import { CANADA_CHECKED } from '../lib/canada.js';
import { money } from '../lib/format.js';

/**
 * How Bedrock works out its numbers. Every figure here is read from the
 * same constants the app runs on, so this page can't drift from the code.
 */

const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
const pct = (x, d = 1) => `${(x * 100).toFixed(d).replace(/\.0+$/, '')}%`;

function Formula({ children }) {
  return <p className="my-3 overflow-x-auto rounded-md border border-hairline bg-(--panel) px-4 py-3 font-mono text-[13px] text-zinc-800 dark:text-zinc-200">{children}</p>;
}

function Table({ head, rows }) {
  return (
    <div className="my-4 overflow-x-auto rounded-md border border-hairline">
      <table className="w-full text-sm">
        <thead className="bg-(--panel) text-left text-xs text-zinc-500 dark:text-zinc-400">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline tabular-nums">
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className="px-4 py-2 text-zinc-800 dark:text-zinc-200">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS = [
  ['buy', 'What you could buy'],
  ['insurance', 'Mortgage insurance'],
  ['closing', 'Closing costs'],
  ['money', 'Government money'],
  ['live', 'Cost to live in a home'],
  ['rental', 'Rental math'],
  ['listings', 'Listings'],
  ['rvb', 'Rent or buy'],
  ['sources', 'Sources'],
];

export default function Methods() {
  const m = DEFAULT_MARKET;
  return (
    <PageShell>
      <h1 className={h1}>How we calculate</h1>
      <p className={lede}>
        Every number Bedrock shows, and where it comes from. Lending rules were last checked {day(RULES_CHECKED)}; provincial taxes and programs {day(CANADA_CHECKED)}. These
        are estimates: a lender, a lawyer and your city decide the real answers.
      </p>
      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2 text-sm">
        {SECTIONS.map(([id, t]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-hairline px-3 py-1 text-zinc-600 hover:border-(--line-strong) hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            {t}
          </a>
        ))}
      </nav>

      <section id="buy" className="scroll-mt-6">
        <h2 className={h2}>What you could buy</h2>
        <div className={prose}>
          <p>The most you could pay is the lower of two limits: what a lender would approve on your income, and what your savings cover on closing day.</p>
          <p>
            <strong className="text-zinc-950 dark:text-white">Down payment.</strong> At least 5% of the first $500,000 and 10% of the rest; at least 10% on a three- or
            four-unit home; 20% on homes of {money(RULES.insuredCap)} or more, which can’t be insured.
          </p>
          <p>
            <strong className="text-zinc-950 dark:text-white">The stress test.</strong> Lenders qualify you at the higher of your rate plus {RULES.stressAdd} points or{' '}
            {RULES.minQualifyingRate}%. Canadian fixed rates compound twice a year, so a quoted rate is converted to its monthly equivalent first.
          </p>
          <Formula>
            GDS = (qualifying payment + property tax + heat + ½ condo fees) ÷ income ≤ {pct(RULES.gds, 0)}
            <br />
            TDS = (housing costs above + other debts) ÷ income ≤ {pct(RULES.tds, 0)}
          </Formula>
          <p>
            Heat counts as {money(RULES.heatMonthly)} a month when unknown.{' '}
            <strong className="text-zinc-950 dark:text-white">Rent from the other units counts as income:</strong> all of a second unit’s rent, half on a three- or four-unit
            home. That’s why a duplex can raise what you can afford.
          </p>
          <p>
            Insured mortgages for first-time buyers run {RULES.amortFirstTime} years; other insured ones {RULES.amortInsured}; uninsured ones up to {RULES.amortConventional}.
          </p>
        </div>
      </section>

      <section id="insurance" className="scroll-mt-6">
        <h2 className={h2}>Mortgage insurance</h2>
        <div className={prose}>
          <p>Below 20% down the mortgage must be insured. The premium is a share of the loan, added to it:</p>
        </div>
        <Table
          head={['Borrowed (share of price)', 'Premium', `Over 25 years`]}
          rows={[0.8, 0.85, 0.9, 0.95].map((ltv) => [`up to ${pct(ltv, 0)}`, `${(premiumRate(ltv, 25) * 100).toFixed(2)}%`, `${(premiumRate(ltv, 30) * 100).toFixed(2)}%`])}
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Ontario, Québec and Saskatchewan charge sales tax on the premium, paid in cash at closing.</p>
      </section>

      <section id="closing" className="scroll-mt-6">
        <h2 className={h2}>Closing costs</h2>
        <div className={prose}>
          <p>
            Land transfer tax by province (and Toronto’s own on top), less any first-buyer refund; legal and other costs of about 1.5% of the price; and any tax on the
            insurance premium. Provinces without a transfer tax use their registration fees instead.
          </p>
        </div>
      </section>

      <section id="money" className="scroll-mt-6">
        <h2 className={h2}>Government money</h2>
        <div className={prose}>
          <p>
            <strong className="text-zinc-950 dark:text-white">FHSA:</strong> deposits of up to {money(RULES.fhsaYear)} a year ({money(RULES.fhsaLifetime)} in all) come off
            your taxable income; the refund is worked out with your province’s and the federal tax brackets.{' '}
            <strong className="text-zinc-950 dark:text-white">Home Buyers’ Plan:</strong> borrow up to {money(RULES.hbp)} from your RRSP.{' '}
            <strong className="text-zinc-950 dark:text-white">Home buyers’ tax credit:</strong> {money(RULES.homeBuyersCredit)}.{' '}
            <strong className="text-zinc-950 dark:text-white">New homes:</strong> the first-time buyers’ GST/HST rebate, up to {money(RULES.gstRebateMax)}. Plus your
            province’s and city’s land transfer tax refunds where they exist.
          </p>
        </div>
      </section>

      <section id="live" className="scroll-mt-6">
        <h2 className={h2}>Cost to live in a home</h2>
        <Formula>cost to live = mortgage payment + property tax + insurance + owner-paid utilities + upkeep and capital reserve − rent from the other units (less vacancy)</Formula>
        <div className={prose}>
          <p>
            A second unit’s rent defaults to your city’s average and you can change it. Property tax uses the listing’s figure when it gives one, otherwise your city’s typical
            share of the price.
          </p>
        </div>
      </section>

      <section id="rental" className="scroll-mt-6">
        <h2 className={h2}>Rental math</h2>
        <Formula>
          DSCR = gross monthly rent ÷ (principal + interest + taxes + insurance + condo/HOA)
          <br />
          cash flow = rent − vacancy − every cost (management, upkeep, capital reserve, tax, insurance, utilities) − mortgage
          <br />
          cash-on-cash = yearly cash flow ÷ cash invested (down payment + closing + repairs)
        </Formula>
        <div className={prose}>
          <p>
            Listings start from these assumptions, each yours to change: {m.mgmtPct}% management, {m.maintPct}% upkeep, {m.vacancyPct}% vacancy and {m.capexPct}% capital
            reserve (all of rent); insurance {money(m.insurancePerUnit)} a unit a year (at least $1,500); {money(m.utilitiesPerUnit)} a unit a month of owner-paid utilities in
            buildings of two or more; a DSCR loan at {m.dscrDownPct}% down and {m.dscrRate}%, or your own 20% down at {m.rate}%. Default targets: DSCR {DEFAULT_TARGETS.dscr},{' '}
            {money(DEFAULT_TARGETS.cashFlowPerDoor)} a door, {DEFAULT_TARGETS.coc}% cash-on-cash.
          </p>
        </div>
      </section>

      <section id="listings" className="scroll-mt-6">
        <h2 className={h2}>Listings</h2>
        <div className={prose}>
          <p>
            Every morning a run searches public listing sites (Thunder Bay daily, and {LISTING_CITIES.length - 1} more cities in turn, so each about weekly). Only listings with
            their own page are kept; sold, conditional and expired ones are dropped, and a listing not seen again for a week or so leaves the list.
          </p>
          <p>
            Where a listing doesn’t state rents, Bedrock estimates them from a rent table by bedroom count, scaled to each city by its average rent. A home is tagged{' '}
            <em>under the going rate</em> when its price per door is at least 15% below the median of similar homes (houses, 2–4 units or 5+ units) on that city’s list.
          </p>
        </div>
      </section>

      <section id="rvb" className="scroll-mt-6">
        <h2 className={h2}>Rent or buy</h2>
        <div className={prose}>
          <p>
            Two households start with the same savings. One buys with the least down; the other rents and invests the down payment and closing costs. Each month, whoever pays
            less invests the difference. After {RENT_VS_BUY_DEFAULTS.years} years we compare the home’s value after {RENT_VS_BUY_DEFAULTS.sellPct}% selling costs and the
            mortgage, plus investments, against the renter’s investments. Defaults: home value +{RENT_VS_BUY_DEFAULTS.appreciationPct}% a year, rent +
            {RENT_VS_BUY_DEFAULTS.rentGrowthPct}%, investments {RENT_VS_BUY_DEFAULTS.investPct}%, upkeep {RENT_VS_BUY_DEFAULTS.maintPct}% of value, tax and insurance +
            {RENT_VS_BUY_DEFAULTS.costGrowthPct}%.
          </p>
        </div>
      </section>

      <section id="sources" className="scroll-mt-6">
        <h2 className={h2}>Sources</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>
            <a className={a} href="https://www.canada.ca/en/financial-consumer-agency/services/mortgages.html" target="_blank" rel="noopener noreferrer">
              Financial Consumer Agency of Canada: mortgages
            </a>
          </li>
          <li>
            <a className={a} href="https://www.cmhc-schl.gc.ca/consumers/home-buying/mortgage-loan-insurance-for-consumers" target="_blank" rel="noopener noreferrer">
              CMHC: mortgage loan insurance
            </a>{' '}
            and its rental market survey for average rents
          </li>
          <li>
            <a className={a} href="https://www.osfi-bsif.gc.ca/en/supervision/financial-institutions/banks/minimum-qualifying-rate-uninsured-mortgages" target="_blank" rel="noopener noreferrer">
              OSFI: the minimum qualifying rate
            </a>
          </li>
          <li>
            <a className={a} href="https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html" target="_blank" rel="noopener noreferrer">
              Canada Revenue Agency: FHSA
            </a>
            ,{' '}
            <a className={a} href="https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/what-home-buyers-plan.html" target="_blank" rel="noopener noreferrer">
              Home Buyers’ Plan
            </a>
          </li>
          <li>Provincial land transfer tax, tenancy and first-buyer program pages, linked beside each figure in the app</li>
          <li>Local real estate boards for typical house prices</li>
        </ul>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Spotted something out of date? <a className={a} href="/contact/">Tell us</a>.
        </p>
      </section>
    </PageShell>
  );
}
