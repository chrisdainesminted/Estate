// Getting pre-approved, made quick: from a few answers, the documents a
// Canadian lender or broker will ask for (and only those), and a one-page
// summary of the buyer's numbers to send ahead, so the first call starts
// with everything on the table.

import { money } from './format.js';

export const INCOME_TYPES = [
  { key: 'salary', label: 'Salary' },
  { key: 'hourly', label: 'Hourly' },
  { key: 'commission', label: 'Commission or bonus' },
  { key: 'self', label: 'Self-employed' },
  { key: 'pension', label: 'Pension or retired' },
];

export const SOURCES = [
  { key: 'savings', label: 'Savings or TFSA' },
  { key: 'fhsa', label: 'FHSA' },
  { key: 'rrsp', label: 'RRSP (Home Buyers’ Plan)' },
  { key: 'gift', label: 'A gift from family' },
  { key: 'sale', label: 'Selling a home I own' },
];

export const DEFAULT_ANSWERS = { incomeType: 'salary', years: 2, coBuyer: false, sources: ['savings'], newToCanada: false, ownsHome: false };

/**
 * The documents to gather, grouped, from the answers:
 * [{ group, items: [{ key, text }] }]. Everyone needs ID and proof of the
 * down payment; the rest depends on how they earn and where the money
 * comes from.
 */
export function docsFor(a = DEFAULT_ANSWERS) {
  const income = {
    salary: [
      ['job-letter', 'A letter from your employer: your title, salary, hours, start date, and that you’re past probation'],
      ['stubs', 'Your two most recent pay stubs'],
      ['t4', 'Your latest T4'],
    ],
    hourly: [
      ['job-letter', 'A letter from your employer: your hourly rate, guaranteed hours and start date'],
      ['stubs', 'Your two most recent pay stubs'],
      ['t4s', 'Your T4s for the last two years'],
      ['noa', 'Your Notices of Assessment for the last two years (from CRA My Account)'],
    ],
    commission: [
      ['job-letter', 'A letter from your employer: your base pay, how commission or bonus is paid, and your start date'],
      ['t4s', 'Your T4s for the last two years: lenders average variable pay over two years'],
      ['noa', 'Your Notices of Assessment for the last two years'],
    ],
    self: [
      ['t1', 'Your full tax returns (T1 Generals) for the last two years'],
      ['noa', 'Your Notices of Assessment for the last two years, showing no tax owing'],
      ['business', 'Your business registration or articles of incorporation'],
      ['statements', 'Two years of business financial statements, if you’re incorporated'],
    ],
    pension: [
      ['pension', 'Your pension statement or T4A, and your latest Notice of Assessment'],
      ['cpp', 'CPP and OAS statements, if you receive them'],
    ],
  }[a.incomeType] ?? [];
  const down = [['bank', '90 days of statements for every account the down payment sits in, showing the balance build up']];
  const src = new Set(a.sources ?? []);
  if (src.has('fhsa')) down.push(['fhsa', 'Your FHSA statement; you’ll fill in form RC725 to take it out tax-free']);
  if (src.has('rrsp')) down.push(['rrsp', 'Your RRSP statement; form T1036 takes out up to $60,000 for the Home Buyers’ Plan (held 90 days first)']);
  if (src.has('gift')) down.push(['gift', 'A signed gift letter saying it isn’t a loan, and proof the money left the giver’s account and arrived in yours']);
  if (src.has('sale')) down.push(['sale', 'The signed agreement for the home you’re selling, and its mortgage statement']);
  const groups = [
    { group: 'You', items: [['id', 'Two pieces of ID, one with your photo'], ...(a.newToCanada ? [['status', 'Your PR card or work permit, and any foreign credit history you have']] : [])] },
    { group: 'Your income', items: income },
    { group: 'Your down payment', items: down },
  ];
  if (a.ownsHome) groups.push({ group: 'Homes you own now', items: [['owned', 'Its mortgage statement, property tax bill, and any leases if it’s rented']] });
  if (a.coBuyer) groups.push({ group: 'Your co-buyer', items: [['co', 'The same documents for them: ID, income and their share of the down payment']] });
  return groups.map((g) => ({ group: g.group, items: g.items.map(([key, text]) => ({ key, text })) }));
}

/**
 * The buyer's numbers as a lender reads them, line by line:
 * [[label, value]]. Only what they entered, plus what the app works out
 * (what they could buy at today's rules), labelled as such.
 */
export function lenderSummary({ profile: p, plan, answers: a = DEFAULT_ANSWERS, place }) {
  const type = INCOME_TYPES.find((t) => t.key === a.incomeType)?.label ?? '';
  const sources = SOURCES.filter((s) => (a.sources ?? []).includes(s.key)).map((s) => s.label);
  const credit = { 680: '680 or higher', 600: '600 to 679', under600: 'Under 600' }[p.credit] ?? 'Not checked yet';
  return [
    ['Buying in', place?.name ?? ''],
    ['Household income, before tax', `${money(p.income)} a year (${type.toLowerCase()}, ${a.years} year${a.years === 1 ? '' : 's'} in this work)`],
    ['Buying with', a.coBuyer ? 'A co-buyer' : 'On my own'],
    ['Monthly debt payments', money(p.debts || 0)],
    ['Saved for buying', money(p.savings)],
    ['Down payment from', sources.join(', ') || 'Savings'],
    ['Credit score', credit],
    ['Rent paid now', `${money(p.rentNow || 0)} a month`],
    ['Looking at', `${money(p.targetPrice)}${p.targetUnits > 1 ? `, ${p.targetUnits} units (renting the rest)` : ''}`],
    ['What Squarely works out I could buy', plan?.best?.price > 0 ? `Up to ${money(plan.best.price)}, with ${money(plan.cashToClose)} cash to close` : 'Not enough saved yet'],
  ];
}

/** The summary as plain text, to paste into an email or send with a broker request. */
export const summaryText = (rows) => rows.map(([k, v]) => `${k}: ${v}`).join('\n');
