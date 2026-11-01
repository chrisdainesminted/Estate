import { useState } from 'react';
import { ArrowRight, Building2, Calculator, ExternalLink, Handshake, Landmark, MapPin, ShieldCheck, Users } from 'lucide-react';
import PageShell, { a, h1, h2, lede, prose } from './PageShell.jsx';
import CitySelect from '../components/CitySelect.jsx';
import BrokerForm from '../components/BrokerForm.jsx';
import { cityByKey, guessCity, provinceName } from '../lib/canada.js';
import { RULES } from '../lib/firstHome.js';

/**
 * Who checks that a mortgage broker is licensed, by province: the official
 * public register where there is one, otherwise the regulator's own site.
 * Banks and credit unions don't need a broker licence.
 */
const REGISTERS = {
  BC: ['BC Financial Services Authority (BCFSA)', 'https://www.bcfsa.ca/public-resources/mortgage-brokers/find-mortgage-broker'],
  AB: ['Real Estate Council of Alberta (RECA)', 'https://www.reca.ca/'],
  SK: ['Financial and Consumer Affairs Authority (FCAA)', 'https://fcaa.gov.sk.ca/regulated-businesses-persons/businesses/mortgage-brokerages/list-of-licensed-mortgage-brokerages-administrators-brokers-and-associates'],
  MB: ['Manitoba Securities Commission', 'https://mbsecurities.ca/'],
  ON: ['Financial Services Regulatory Authority of Ontario (FSRA)', 'https://www.fsrao.ca/licensed-mortgage-brokerages-administrators-mortgage-agents-and-mortgage-brokers'],
  QC: ['Autorité des marchés financiers (AMF)', 'https://lautorite.qc.ca/en/professionals'],
  NB: ['Financial and Consumer Services Commission (FCNB)', 'https://fcnb.ca/en/check-licence-and-registration/mortgages'],
  NS: ['Nova Scotia’s public register', 'https://www.novascotia.ca/licensed-mortgage-brokers-and-associate-mortgage-brokers'],
  NL: ['Digital Government and Service NL', 'https://www.gov.nl.ca/dgsnl/'],
};

const WHO = [
  [
    Handshake,
    'A mortgage broker',
    'Sends your application to many lenders at once, including ones you can’t walk into. On a regular mortgage the lender usually pays them, so it costs you nothing. The easiest first call if you’re new, self-employed, or buying a home with a rental unit.',
  ],
  [Landmark, 'Your bank', 'Simple if you already bank there, but it can only offer its own mortgages. Ask for its best rate, not the posted one.'],
  [Users, 'A credit union', 'Local and member-owned, and sometimes more flexible about unusual income. It also offers only its own mortgages.'],
];

const DOCUMENTS = [
  'Government photo ID',
  'Recent pay stubs and a letter from your employer with your job title, pay and start date',
  'Your last two Notices of Assessment from the CRA (self-employed: your last two tax returns too)',
  '90 days of statements for the account holding your down payment, so the lender can see where it came from',
  'A signed gift letter if family is giving you part of the down payment',
  'A list of your debts: car loans, student loans, credit cards and lines of credit',
  'Buying a home with a rental unit: its current lease or rent, if it has a tenant',
];

const QUESTIONS = [
  'What’s the rate, for how long (the term), and is it fixed or variable?',
  'How long will you hold this rate for me?',
  'How much extra can I pay each year without a penalty?',
  'If I break the mortgage early, how is the penalty worked out?',
  'Can I take the mortgage with me if I move?',
  'Are there any fees, and who pays you?',
  'Which lender is the mortgage actually with?',
];

const RED_FLAGS = [
  'A broker or agent who isn’t on your province’s licence register.',
  'Being asked to stretch your income, or to say you’ll live in a home you plan to rent out.',
  'A fee before you’re approved, or any fee that isn’t written down before you sign.',
  'Pressure to sign today, or an ad promising “guaranteed approval.”',
  'Contact details that don’t match the register: reach them through the details the register gives.',
];

const card = 'rounded-xl border border-hairline bg-(--panel) p-5';
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400';
const button = 'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500';

function Ext({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${a} inline-flex items-center gap-1`}>
      {children} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const mapsSearch = (what, where) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${what} near ${where}`)}`;

/** Where to look near you: the licence register for your province, then brokers and credit unions on the map. */
function NearYou({ city, onCity }) {
  const place = cityByKey(city);
  const province = provinceName(place.province);
  const where = place.name.startsWith('Elsewhere in ') ? province : `${place.name}, ${place.province}`;
  const register = REGISTERS[place.province];
  return (
    <div className="mt-5 space-y-4">
      <div className="max-w-sm">
        <CitySelect id="lender-city" label="Where you’re buying" value={city} onChange={onCity} />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className={card}>
          <ShieldCheck className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
          <p className="mt-3 font-semibold text-zinc-950 dark:text-white">Check a broker’s licence</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Every mortgage broker and agent in {province} must be licensed. Look them up before you send any documents.
          </p>
          <p className="mt-3 text-sm">
            {register ? <Ext href={register[1]}>{register[0]}</Ext> : <span className="text-zinc-700 dark:text-zinc-300">Ask for their licence number and confirm it with {province}’s government.</span>}
          </p>
        </li>
        <li className={card}>
          <MapPin className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
          <p className="mt-3 font-semibold text-zinc-950 dark:text-white">Find one on the map</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Read the reviews, call two or three, and ask the questions above.</p>
          <p className="mt-3 flex flex-col gap-1.5 text-sm">
            <Ext href={mapsSearch('mortgage broker', where)}>Mortgage brokers near {where}</Ext>
            <Ext href={mapsSearch('credit union', where)}>Credit unions near {where}</Ext>
          </p>
        </li>
      </ul>
    </div>
  );
}

export default function Lenders() {
  const [city, setCity] = useState(() => guessCity());
  return (
    <PageShell>
      <p className={eyebrow}>Find a lender</p>
      <h1 className={`${h1} mt-3`}>Get a mortgage, even if you’ve never done this before.</h1>
      <p className={lede}>
        Who lends, what to bring, what to ask, and how to find someone licensed near you. Most people start with a free pre-approval, and a mortgage broker is the easiest first
        call.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <a href="#intro" className={`${button} bg-(--accent) font-semibold text-(--accent-ink) hover:brightness-110`}>
          Introduce me to a broker <ArrowRight className="size-4" aria-hidden />
        </a>
        <a href="#near" className={`${button} font-medium text-zinc-800 ring-1 ring-(--line-strong) ring-inset hover:bg-well dark:text-zinc-100`}>
          Find one near me
        </a>
      </div>

      <h2 className={h2}>Who can lend you the money</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {WHO.map(([Icon, t, b]) => (
          <li key={t} className={card}>
            <Icon className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <p className="mt-3 font-semibold text-zinc-950 dark:text-white">{t}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <Building2 className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
        <span>
          Buying a building with five or more units? In Canada that’s a commercial mortgage, with different lenders and rules. Ask for a broker who arranges multi-unit or
          commercial mortgages.
        </span>
      </p>

      <h2 className={h2}>Step by step</h2>
      <ol className="mt-5 space-y-5">
        {[
          [
            'Know your numbers',
            <>
              See roughly what a lender would approve before you talk to one.{' '}
              <a href="/app/?view=home" className={a}>
                See what you could buy
              </a>
              .
            </>,
          ],
          ['Gather your documents', 'The list is below. Having it ready makes a pre-approval quick.'],
          [
            'Get pre-approved',
            `It’s free. The lender checks your credit and income and usually holds a rate for 90 to 120 days. To qualify, every lender tests you at the higher of your rate plus ${RULES.stressAdd} points or ${RULES.minQualifyingRate}%, so you could still pay if rates rise.`,
          ],
          ['Compare at least three offers', 'Ask each one the questions below. A broker does much of this comparing for you.'],
          ['Make your offer with a financing condition', 'Your offer can depend on your mortgage being approved for a few business days, so you can walk away if it isn’t.'],
          ['Final approval and closing', 'The lender approves the home itself, then your lawyer (a notary in Québec) handles the money and the title on closing day.'],
        ].map(([t, b], i) => (
          <li key={t} className="flex gap-4">
            <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-sm font-semibold text-emerald-800 dark:text-emerald-300" aria-hidden>
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-zinc-950 dark:text-white">{t}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className={h2}>What to bring</h2>
      <ul className={`${prose} list-disc pl-5`}>
        {DOCUMENTS.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>

      <h2 className={h2}>Questions to ask every lender</h2>
      <ul className={`${prose} list-disc pl-5`}>
        {QUESTIONS.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>

      <h2 id="near" className={`${h2} scroll-mt-6`}>
        Find a lender near you
      </h2>
      <NearYou city={city} onCity={setCity} />
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Banks and credit unions don’t need a broker licence: they’re regulated as lenders.</p>

      <h2 id="intro" className={`${h2} scroll-mt-6`}>
        Or let us introduce you
      </h2>
      <div className="mt-5 overflow-hidden rounded-xl border border-hairline bg-(--panel)">
        <BrokerForm p={{ city, entered: false }} guide />
      </div>

      <h2 className={h2}>Watch out for</h2>
      <ul className={`${prose} list-disc pl-5`}>
        {RED_FLAGS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <p className="mt-12 flex gap-2 border-t border-hairline pt-6 text-sm text-zinc-600 dark:text-zinc-400">
        <Calculator className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Squarely isn’t a lender or a broker, and only a lender can approve a mortgage. If you ask for an introduction, the broker may pay Squarely a referral fee; it never
          changes your rate or costs you anything.{' '}
          <a href="/about/" className={a}>
            How Squarely makes money
          </a>
        </span>
      </p>
    </PageShell>
  );
}
