// Adding a home to a lot in Thunder Bay: a basement suite or an addition in
// the main house, or a backyard home. What's allowed, the permit steps, and
// whether the rent pays the build back. Sourced from the City of Thunder Bay,
// Ontario's Planning Act changes (Bill 23) and the federal suite refinance;
// SUITE_RULES_CHECKED says when. Every step links to where it comes from.

import { monthlyPI } from './finance.js';

export const SUITE_RULES_CHECKED = '2026-10-29';

const CITY_ADU_GUIDE = 'https://www.thunderbay.ca/en/business/resources/BUILDTHUNDERBAY_ADU_HowTo_v1.pdf';
const CITY_PERMITS = 'https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/apply-for-a-building-permit/';
const CITY_ZONING = 'https://getinvolvedthunderbay.ca/changes-to-the-zoning-by-law';
const CITY_FEES = 'https://www.thunderbay.ca/en/city-services/resources/Documents/Home-and-Property/Building--Renovating-a-Property/Building-Permit-Fee-Schedule.pdf';
const CITY_INSPECTIONS = 'https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/request-a-building-inspection/';
const CITY_GRANTS = 'https://www.thunderbay.ca/en/business/financial-incentives-and-grants.aspx';
const SUITE_REFI = 'https://www.canada.ca/en/department-finance/news/2024/12/2024-fall-economic-statement-making-it-easier-for-homeowners-to-build-secondary-suites.html';

export const SUITE_KINDS = [
  { key: 'inside', label: 'Suite in the house', words: 'a basement or in-house suite' },
  { key: 'backyard', label: 'Backyard home', words: 'a backyard home' },
];

/** What's allowed, in short lines. */
export const ALLOWED = [
  {
    text: 'In Thunder Bay’s urban low-rise (UL) zone, most house lots can hold the main home plus additional units: a suite inside the house, a backyard home, or both.',
    url: CITY_ZONING,
  },
  { text: 'Ontario law requires cities to allow up to three homes on most serviced residential lots without rezoning.', url: 'https://ero.ontario.ca/notice/019-6197' },
  { text: 'A backyard home has to sit at least 1.5 m from the side and rear lot lines, and its size and height are capped by the zoning by-law.', url: CITY_ZONING },
  { text: 'Plan one parking space for each home on the lot, and check the by-law’s table for your lot’s frontage and area.', url: CITY_ZONING },
  { text: 'If your lot misses a rule by a little (frontage, setbacks), the Committee of Adjustment can grant a minor variance; neighbours get notice and a hearing.', url: 'https://www.thunderbay.ca/en/news/notice-of-committee-hearing-december-18-2025.aspx' },
];

/** The permit steps, in order. */
export const STEPS = [
  {
    key: 'zoning',
    title: 'Check your lot’s zoning',
    body: 'Look up your address’s zone on the city map and confirm a second or third unit is allowed, and what size and setbacks apply. A call to Building Services settles any doubt for free.',
    url: CITY_ADU_GUIDE,
  },
  {
    key: 'design',
    title: 'Get drawings from a qualified designer',
    body: 'Floor plans, a site plan (show any overhead power lines), and for a suite in the house: the fire separation, smoke and carbon monoxide alarms, exits and windows the Building Code requires. The designer signs Schedule 1 with their BCIN number, unless you’re the owner drawing your own.',
    url: CITY_PERMITS,
  },
  {
    key: 'apply',
    title: 'Apply for the building permit',
    body: 'Submit the application, Schedule 1 (designer information), the drawings, the applicable law checklist, and the owner’s authorization if someone else applies. The city aims to review one and two unit homes within 10 business days.',
    url: CITY_PERMITS,
  },
  {
    key: 'fees',
    title: 'Pay the permit fee',
    body: 'Charged by floor area. Inspections are included. Look for a city fee grant first: it has covered up to $10,000 of planning and permit fees.',
    url: CITY_FEES,
  },
  {
    key: 'build',
    title: 'Build, with inspections at each stage',
    body: 'Book inspections before you cover anything up: footings and framing, plumbing, insulation, fire separation, and final. Electrical work needs its own permit and inspection from the Electrical Safety Authority.',
    url: CITY_INSPECTIONS,
  },
  {
    key: 'final',
    title: 'Final inspection, then rent it out',
    body: 'Once it passes, the unit is legal: you can rent it, insure it as a rental, and a lender can count its rent.',
    url: CITY_INSPECTIONS,
  },
];

export const MONEY = [
  {
    text: 'City Additional Dwelling Unit grant: up to $20,000 a unit (plus up to $10,000 for servicing). Fully subscribed for now; watch for the next intake.',
    url: CITY_GRANTS,
  },
  { text: 'City planning and permit fees grant: up to $10,000 toward permit fees, when open.', url: CITY_GRANTS },
  {
    text: 'Insured refinance: borrow up to 90% of your home’s value, including what the new suite adds, over up to 30 years, to pay for building it.',
    url: SUITE_REFI,
  },
  { text: 'The federal Secondary Suite Loan Program announced in 2024 was cancelled before it opened, so ignore offers that rely on it.', url: SUITE_REFI },
];

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
