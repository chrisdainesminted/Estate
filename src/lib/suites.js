// Adding a home to a lot anywhere in Canada: a basement suite or an
// addition in the main house, or a backyard home. What's allowed, the permit
// steps, and whether the rent pays the build back. The steps are the same
// almost everywhere; the rules differ by province and city, so the guide
// gives the national and provincial picture, and the city's own pages and
// grants where Bedrock has checked them (Thunder Bay so far).
// SUITE_RULES_CHECKED says when.

import { monthlyPI } from './finance.js';
import { cityByKey } from './canada.js';

export const SUITE_RULES_CHECKED = '2026-10-30';

const TB = {
  guide: 'https://www.thunderbay.ca/en/business/resources/BUILDTHUNDERBAY_ADU_HowTo_v1.pdf',
  permits: 'https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/apply-for-a-building-permit/',
  zoning: 'https://getinvolvedthunderbay.ca/changes-to-the-zoning-by-law',
  fees: 'https://www.thunderbay.ca/en/city-services/resources/Documents/Home-and-Property/Building--Renovating-a-Property/Building-Permit-Fee-Schedule.pdf',
  inspections: 'https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/request-a-building-inspection/',
  grants: 'https://www.thunderbay.ca/en/business/financial-incentives-and-grants.aspx',
};
const SUITE_REFI = 'https://www.canada.ca/en/department-finance/news/2024/12/2024-fall-economic-statement-making-it-easier-for-homeowners-to-build-secondary-suites.html';

export const SUITE_KINDS = [
  { key: 'inside', label: 'Suite in the house', words: 'a basement or in-house suite' },
  { key: 'backyard', label: 'Backyard home', words: 'a backyard home' },
];

const PROVINCE_RULES = {
  ON: [{ text: 'Ontario law requires cities to allow up to three homes on most serviced residential lots without rezoning: the house, a suite inside it, and a backyard home.', url: 'https://ero.ontario.ca/notice/019-6197' }],
  BC: [{ text: 'BC’s small-scale multi-unit housing law has most towns over 5,000 people allow three or four homes on a house lot, and up to six near frequent transit.' }],
};

const CITY_RULES = {
  'thunder-bay': [
    { text: 'In Thunder Bay’s urban low-rise (UL) zone, most house lots can hold the main home plus additional units: a suite inside the house, a backyard home, or both.', url: TB.zoning },
    { text: 'A backyard home has to sit at least 1.5 m from the side and rear lot lines, and its size and height are capped by the zoning by-law.', url: TB.zoning },
    { text: 'Plan one parking space for each home on the lot, and check the by-law’s table for your lot’s frontage and area.', url: TB.zoning },
    { text: 'If your lot misses a rule by a little (frontage, setbacks), the Committee of Adjustment can grant a minor variance; neighbours get notice and a hearing.', url: 'https://www.thunderbay.ca/en/news/notice-of-committee-hearing-december-18-2025.aspx' },
  ],
};

/** What's allowed where you are, in short lines: the province's law, then the city's by-law where Bedrock has it. */
export function allowedFor(city) {
  const c = cityByKey(city);
  const general = { text: 'Most Canadian cities now allow a second unit on a house lot, a basement suite or a backyard home, and many allow three or four. Your city’s zoning by-law has the size, setback and parking rules.' };
  return [...(PROVINCE_RULES[c.province] ?? [general]), ...(CITY_RULES[c.key] ?? [])];
}

/** The permit steps, in order: the same almost everywhere, with the city's pages where Bedrock has them. */
export function stepsFor(city) {
  const c = cityByKey(city);
  const tb = c.key === 'thunder-bay';
  const on = c.province === 'ON';
  return [
    {
      key: 'zoning',
      title: 'Check your lot’s zoning',
      body: 'Look up your address’s zone on the city’s map or zoning by-law and confirm another unit is allowed, and what size, setbacks and parking apply. A call to the city’s building or planning office settles any doubt for free.',
      url: tb ? TB.guide : undefined,
    },
    {
      key: 'design',
      title: 'Get drawings from a qualified designer',
      body: `Floor plans, a site plan (show any overhead power lines), and for a suite in the house: the fire separation, smoke and carbon monoxide alarms, exits and windows the building code requires.${on ? ' In Ontario the designer signs Schedule 1 with their BCIN number, unless you’re the owner drawing your own.' : ' Many cities accept drawings from the owner for a house; others want a qualified designer.'}`,
      url: tb ? TB.permits : undefined,
    },
    {
      key: 'apply',
      title: 'Apply for the building permit',
      body: `Submit the application, the drawings, and any forms the city lists, with the owner’s authorization if someone else applies.${tb ? ' Thunder Bay aims to review one and two unit homes within 10 business days.' : ' Ask how long reviews take; many cities fast-track one and two unit homes.'}`,
      url: tb ? TB.permits : undefined,
    },
    {
      key: 'fees',
      title: 'Pay the permit fee',
      body: `Usually charged by floor area, with inspections included.${tb ? ' Look for a city fee grant first: it has covered up to $10,000 of planning and permit fees.' : ' Ask whether the city waives or rebates fees for new units; many do.'}`,
      url: tb ? TB.fees : undefined,
    },
    {
      key: 'build',
      title: 'Build, with inspections at each stage',
      body: `Book inspections before you cover anything up: footings and framing, plumbing, insulation, fire separation, and final. Electrical work needs its own permit and inspection${on ? ' from the Electrical Safety Authority' : ''}.`,
      url: tb ? TB.inspections : undefined,
    },
    {
      key: 'final',
      title: 'Final inspection, then rent it out',
      body: 'Once it passes, the unit is legal: you can rent it, insure it as a rental, and a lender can count its rent.',
      url: tb ? TB.inspections : undefined,
    },
  ];
}

/** The steps' keys, for saving progress (the same everywhere). */
export const STEPS = stepsFor('on-other');

/** Money toward building: national, plus the city's grants where Bedrock has checked them. */
export function moneyFor(city) {
  const local =
    cityByKey(city).key === 'thunder-bay'
      ? [
          { text: 'City Additional Dwelling Unit grant: up to $20,000 a unit (plus up to $10,000 for servicing). Fully subscribed for now; watch for the next intake.', url: TB.grants },
          { text: 'City planning and permit fees grant: up to $10,000 toward permit fees, when open.', url: TB.grants },
        ]
      : [{ text: 'Many cities have grants or fee waivers for new suites and backyard homes, some of them funded by the federal Housing Accelerator Fund. Ask your city before you apply.' }];
  return [
    ...local,
    { text: 'Insured refinance: borrow up to 90% of your home’s value, including what the new suite adds, over up to 30 years, to pay for building it.', url: SUITE_REFI },
    { text: 'The federal Secondary Suite Loan Program announced in 2024 was cancelled before it opened, so ignore offers that rely on it.', url: SUITE_REFI },
  ];
}

/** Your suite plan: which kind, the steps ticked off, and the payback inputs. */
export const DEFAULT_SUITE = { kind: 'inside', done: [], buildCost: 90000, rent: 1300, borrowPct: 0 };

export function normalizeSuite(s) {
  const keys = new Set(STEPS.map((x) => x.key));
  const n = (v, d) => (Number.isFinite(Number(v)) ? Math.max(Number(v), 0) : d);
  return {
    kind: SUITE_KINDS.some((k) => k.key === s?.kind) ? s.kind : DEFAULT_SUITE.kind,
    done: Array.isArray(s?.done) ? [...new Set(s.done.filter((k) => keys.has(k)))] : [],
    buildCost: n(s?.buildCost, DEFAULT_SUITE.buildCost),
    rent: n(s?.rent, DEFAULT_SUITE.rent),
    borrowPct: Math.min(n(s?.borrowPct, 0), 100),
  };
}

/**
 * Whether a suite pays for itself: the monthly rent after empty months and
 * upkeep, less the payment on what you borrow to build it, and how many
 * years the rent takes to repay the cash you put in.
 */
export function suitePayback({ buildCost, rent, borrowPct = 0, ratePct = 5, years = 25, vacancyPct = 4, upkeepPct = 8 }) {
  const cost = Math.max(Number(buildCost) || 0, 0);
  const borrowed = cost * Math.min(Math.max(Number(borrowPct) || 0, 0), 100) / 100;
  const cashIn = cost - borrowed;
  const r = Math.max(Number(rent) || 0, 0);
  const netRent = r * (1 - (Number(vacancyPct) + Number(upkeepPct)) / 100);
  const payment = monthlyPI(borrowed, ratePct, years);
  const monthly = netRent - payment;
  return { cost, borrowed, cashIn, netRent, payment, monthly, paybackYears: monthly > 0 ? cashIn / (monthly * 12) : null };
}
