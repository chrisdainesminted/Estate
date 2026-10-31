import { Calculator, Home, KeyRound, Lock, Scale, ShieldCheck } from 'lucide-react';
import PageShell, { a, h1, h2, lede, prose } from './PageShell.jsx';
import { RULES_CHECKED } from '../lib/firstHome.js';
import { LISTING_CITIES } from '../lib/market.js';

const checked = new Date(`${RULES_CHECKED}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });

const PRINCIPLES = [
  [Lock, 'Private by default', 'No account needed. Your income, savings and deals stay in your browser unless you choose to sync them.'],
  [Scale, 'The real rules, shown', `Down payments, mortgage insurance, the stress test, land transfer tax and every first-buyer program, for each province, checked ${checked} and linked to the official source.`],
  [Calculator, 'Every number explained', 'Each figure says what it means and how it was worked out. How we calculate lists the formulas.'],
  [ShieldCheck, 'Only real listings', 'Homes for sale come from public listing sites and link to their own page; homes posted on Squarely can be reported, and reported ones are reviewed.'],
];

export default function About() {
  return (
    <PageShell>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">About Squarely</p>
      <h1 className={`${h1} mt-3`}>Homeownership, worked out honestly.</h1>
      <p className={lede}>
        Most first-time buyers in Canada are told the same thing: save for years, then hope. Squarely exists because there’s a better path most people never hear about: buy a
        home with a second unit, rent it out, and let the tenant help you qualify and pay the mortgage.
      </p>

      <h2 className={h2}>What it does</h2>
      <div className={prose}>
        <p>
          Squarely shows what a bank would lend you, on your own and with a tenant, under your province’s real rules; the government money you can claim; and what any home would
          cost you to live in each month. It finds homes for sale every morning in {LISTING_CITIES.length} cities and runs each one through your numbers. When you’re ready, it
          walks you through every step to closing day.
        </p>
        <p>
          For people who already own rentals, it does the investor’s math (cash flow, the lender’s DSCR test, a stress test and a 10-year outlook) and gives small landlords one
          place for listings, applications, viewings, rent, repairs and tax-time expenses.
        </p>
      </div>

      <h2 className={h2}>What we believe</h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map(([Icon, t, b]) => (
          <li key={t} className="rounded-xl border border-hairline bg-(--panel) p-5">
            <Icon className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <p className="mt-3 font-semibold text-zinc-950 dark:text-white">{t}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
          </li>
        ))}
      </ul>

      <h2 className={h2}>How Squarely makes money</h2>
      <div className={prose}>
        <p>
          <Home className="mr-1.5 inline size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
          Everything for buyers and renters is free, and always will be: the calculators, the listings, searching, applying and booking viewings.
        </p>
        <p>
          <KeyRound className="mr-1.5 inline size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
          Landlords pay only when the rent tracker is earning its keep: their first tenanted unit is free, and each further one costs 2% of the rent tracked, at most $30 a
          month. That’s about a quarter of what a property manager charges.
        </p>
        <p>
          If you ask to talk to a mortgage broker, the broker may pay Squarely a referral fee. It never changes your rate or costs you anything, and we only pass on your
          details when you ask us to.
        </p>
      </div>

      <h2 className={h2}>What Squarely isn’t</h2>
      <div className={prose}>
        <p>
          It isn’t a brokerage, a lender or an adviser, and its numbers are estimates. A mortgage broker confirms what you can borrow, and a lawyer (a notary in Québec) handles
          the purchase. Read the <a className={a} href="/terms/">terms</a> and the <a className={a} href="/privacy/">privacy policy</a>.
        </p>
        <p>
          Questions, corrections or ideas: <a className={a} href="/contact/">get in touch</a>. If a rule or number is out of date, we want to know.
        </p>
      </div>
    </PageShell>
  );
}
