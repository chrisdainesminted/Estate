// The first-time buyer's path, from "can I even buy?" to moving day: the
// instant answer, how far off the home you want is and the shortcuts that
// close the gap, whether a real listing fits you today, and the one thing to
// do next. Built on firstHome.js; nothing here is a guess the person can't see.

import { RULES, buyCheck, incomeToQualify, localFor, maxPrice, monthsToSave, normalizeProfile, withGift } from './firstHome.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** 'YYYY-MM' a number of months from `now`. */
export function monthKey(months, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "August 2027" for a 'YYYY-MM'. */
export const monthName = (key) => new Date(`${key}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

/**
 * The instant answer and the plan behind it. `profile` is the person's own
 * numbers (a family gift counts as savings); `ratePct` the mortgage rate.
 * Returns what they could buy today alone and with a rental unit, the cash
 * that takes, and for the home they're aiming at: the gap, the month they'd
 * be ready, and the shortcuts, each with what it's worth.
 */
export function myPlan({ profile, ratePct, now = new Date() }) {
  const raw = normalizeProfile(profile);
  const p = withGift(raw);
  const local = localFor(p);
  const { taxPct, rent } = local;
  const check = (price, units) => buyCheck({ profile: p, price, units, ratePct, taxesMonthly: (price * taxPct) / 1200, rentFromOthers: rent * (units - 1) });

  const solo = maxPrice({ profile: p, units: 1, ratePct, taxPct });
  const duplex = maxPrice({ profile: p, units: 2, ratePct, taxPct, rentPerOtherUnit: rent });
  const best = duplex.price >= solo.price ? { ...duplex, units: 2 } : { ...solo, units: 1 };
  const bestCheck = best.price > 0 ? check(best.price, best.units) : null;

  // The home they're aiming at: their own target, a typical home in their city to start.
  const goal = { price: p.targetPrice, units: p.targetUnits };
  const g = check(goal.price, goal.units);
  const months = monthsToSave({ profile: p, target: g.cashNeeded });
  const monthsNoFhsa = monthsToSave({ profile: { ...p, firstTime: false }, target: g.cashNeeded });
  const incomeNeeded = g.qualify.pass ? null : incomeToQualify({ price: goal.price, units: goal.units, ratePct, taxPct, rentPerOtherUnit: rent, debts: p.debts, firstTime: p.firstTime, city: p.city });
  const readyBy = months == null ? null : monthKey(months, now);

  const shortcuts = [];
  if (p.firstTime && g.shortCash > 0) {
    shortcuts.push({
      key: 'fhsa',
      title: 'Save in a First Home Savings Account',
      value: months != null && monthsNoFhsa != null ? Math.max(monthsNoFhsa - months, 0) : 0,
      unit: 'months',
      text:
        months != null && monthsNoFhsa != null && monthsNoFhsa > months
          ? `Each spring’s tax refund on your deposits gets you there ${monthsNoFhsa - months} month${monthsNoFhsa - months === 1 ? '' : 's'} sooner. Already counted in your date.`
          : 'Deposits come off your taxable income and come out tax-free to buy. Open one now: the room starts the year you open it.',
    });
  }
  if (p.firstTime && g.closing.refund > 0) {
    shortcuts.push({ key: 'ltt', title: 'First-time buyer land transfer tax rebate', value: Math.round(g.closing.refund), unit: 'dollars', text: 'Off your closing costs, claimed by your lawyer on closing day. Already counted in your cash to close.' });
  }
  if (p.firstTime) {
    shortcuts.push({ key: 'hbp', title: 'RRSP Home Buyers’ Plan', value: RULES.hbp, unit: 'dollars', text: `Money in an RRSP can go toward the down payment: up to ${dollars(RULES.hbp)} each, tax-free, paid back over 15 years. If you have some, count it in what you’ve saved.` });
  }
  if (g.shortCash > 0) {
    shortcuts.push({ key: 'gift', title: 'A gift from family', value: Math.round(g.shortCash), unit: 'dollars', text: `Lenders accept a gift from close family for the down payment with a signed letter saying it isn’t a loan. A gift of ${dollars(g.shortCash)} would make you ready now.` });
    const in12 = Math.ceil(g.shortCash / 12 / 50) * 50;
    // Only when it's a sum a household could actually put aside.
    if ((months == null || months > 12) && in12 <= p.income / 12 / 3) shortcuts.push({ key: 'save', title: 'Save more each month', value: in12, unit: 'monthly', text: `About ${dollars(in12)} a month gets you there within a year, before any FHSA refund.` });
  }

  // Years away: the dearest home of the same kind they'd qualify for and could save for within two years.
  const far = months == null || months > 60 || !g.qualify.pass;
  let within2 = null;
  if (far) {
    let lo = 0;
    let hi = Math.max(goal.price, 100000);
    const ok = (price) => {
      const c = check(price, goal.units);
      const m = monthsToSave({ profile: p, target: c.cashNeeded });
      return c.qualify.pass && m != null && m <= 24;
    };
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
    within2 = lo >= 50000 ? Math.floor(lo / 5000) * 5000 : null;
  }

  return {
    profile: p,
    local,
    gift: raw.gift,
    solo,
    duplex,
    best,
    cashToClose: bestCheck ? bestCheck.cashNeeded : 0,
    bestCheck,
    goal: { ...goal, check: g, short: g.shortCash, months, readyBy, far, within2, qualifies: g.qualify.pass, incomeNeeded, incomeShort: incomeNeeded == null ? 0 : Math.max(incomeNeeded - p.income, 0) },
    shortcuts,
  };
}

const dollars = (n) => `$${Math.round(num(n)).toLocaleString('en-US')}`;

export const FITS = {
  fits: { label: 'Fits you', tone: 'good' },
  stretch: { label: 'Stretch', tone: 'warn' },
  notYet: { label: 'Not yet', tone: 'muted' },
};

/**
 * Whether a home fits the person today. `home` is homeFor()'s answer for it.
 * Fits: they'd qualify and have the cash. Stretch: they'd qualify and could
 * save the rest within a year. Not yet: anything further off. With the reason in words.
 */
export function fitFor(home, profile) {
  if (!home) return null;
  const p = withGift(profile);
  if (home.canBuy) return { key: 'fits', reason: 'You’d qualify, and your savings cover the cash to close.' };
  const months = home.shortCash > 0 ? monthsToSave({ profile: p, target: home.cashNeeded }) : 0;
  if (home.qualifies && months != null && months <= 12) {
    return { key: 'stretch', months, reason: `You’d qualify. You’re ${dollars(home.shortCash)} short of the cash: about ${months} month${months === 1 ? '' : 's'} of saving.` };
  }
  const why = [!home.qualifies && 'your income wouldn’t qualify yet', home.shortCash > 0 && `you’re ${dollars(home.shortCash)} short of the cash`].filter(Boolean).join(', and ');
  return { key: 'notYet', months, reason: `Not yet: ${why}.` };
}

/**
 * Every step from saving to moving day, in order. `view` is where in the app
 * the step is done; `auto` steps tick themselves from the person's numbers.
 */
export const BUY_STEPS = [
  { id: 'credit', title: 'Check your credit report', short: 'Free from Equifax and TransUnion. Fix mistakes before a lender looks.' },
  { id: 'fhsa', title: 'Open a First Home Savings Account', short: 'Up to $8,000 a year off your taxable income, tax-free to buy.', firstTimeOnly: true },
  { id: 'save', title: 'Save the cash to close', short: 'Down payment plus closing costs.', auto: true, view: 'home' },
  { id: 'docs', title: 'Gather your documents', short: 'T4s or Notices of Assessment, pay stubs, a job letter, 90 days of bank statements.' },
  { id: 'preapproval', title: 'Get pre-approved', short: 'Holds a rate for 90 to 120 days and shows sellers you’re serious.' },
  { id: 'realtor', title: 'Choose a realtor', short: 'The seller usually pays their fee. Interview two or three.' },
  { id: 'search', title: 'Find a home that fits', short: 'Homes that fit your budget, from today’s listings.', view: 'homes' },
  { id: 'offer', title: 'Make an offer, with conditions', short: 'Conditional on financing and an inspection, so you can walk away.' },
  { id: 'inspection', title: 'Get it inspected', short: 'About $400 to $600, before your conditions run out.' },
  { id: 'insurance', title: 'Line up home insurance', short: 'Your lender needs proof before closing.' },
  { id: 'lawyer', title: 'Hire a lawyer and set aside closing costs', short: 'They check the title, move the money and register the home in your name.' },
  { id: 'moving', title: 'Moving day', short: 'Keys, utilities in your name, and a cushion for the first repairs.' },
];

/** The steps that apply to this person (the FHSA only for first-time buyers). */
export const stepsFor = (profile) => BUY_STEPS.filter((s) => !s.firstTimeOnly || normalizeProfile(profile).firstTime);

/**
 * The one thing to do next. Before any numbers: the questions. While the
 * cash is more than three months away, saving comes before the paperwork
 * (a pre-approval only lasts about four months). Then the first unticked step.
 */
export function nextStep({ profile, ready = {}, plan }) {
  const p = normalizeProfile(profile);
  if (!p.entered) return { id: 'start', title: 'Answer six quick questions', text: 'See what you could buy today, and what it would cost you each month.', view: 'home', action: 'Start' };
  const steps = stepsFor(p);
  const saved = plan ? plan.goal.short === 0 : false;
  const done = (s) => (s.id === 'save' ? saved : ready[s.id] === true);
  const far = plan && plan.goal.months != null && plan.goal.months > 3;
  const order = far ? steps.filter((s) => ['credit', 'fhsa', 'save'].includes(s.id)) : steps;
  const step = order.find((s) => !done(s));
  if (!step) {
    if (far) return null;
    return { id: 'done', title: 'You’ve done every step', text: 'Welcome home. Squarely’s landlord tools can help if you rent out a unit.', view: 'ready', action: 'See your checklist' };
  }
  const index = steps.indexOf(step);
  if (step.id === 'save' && plan) {
    const g = plan.goal;
    return {
      id: 'save',
      index,
      count: steps.length,
      title: `Save ${dollars(g.short)} more`,
      text: g.readyBy ? `At ${dollars(p.monthlySave)} a month you’re ready by ${monthName(g.readyBy)}. See the shortcuts that get you there sooner.` : 'Save a little each month, or look at the shortcuts.',
      view: 'home',
      anchor: 'plan-gap',
      action: 'See your plan',
    };
  }
  return { id: step.id, index, count: steps.length, title: step.title, text: step.short, view: step.view ?? 'ready', anchor: step.view ? undefined : `step-${step.id}`, action: step.view === 'homes' ? 'See homes that fit' : 'How to do it' };
}


/**
 * The email for the month a person's plan said they'd be ready, once per
 * planned month: null until that month comes, if they didn't ask for it, or
 * if it's already been sent (`sent` is the month last emailed).
 */
export function readyReminder({ profile, ratePct, today, origin, sent = '' }) {
  const p = normalizeProfile(profile);
  if (!p.entered || !p.remindReady || !p.readyBy || p.readyBy > String(today).slice(0, 7) || sent === p.readyBy) return null;
  const plan = myPlan({ profile: p, ratePct });
  const g = plan.goal;
  const kind = { 1: 'house', 2: 'duplex', 3: 'triplex', 4: 'fourplex' }[g.units];
  const steps = stepsFor(p).filter((s) => ['docs', 'preapproval', 'realtor'].includes(s.id));
  return {
    month: p.readyBy,
    subject: `It’s ${monthName(p.readyBy)}: are you ready to buy?`,
    body: [
      `Your Squarely plan said that by ${monthName(p.readyBy)} you’d have ${dollars(g.check.cashNeeded)} saved: the down payment and closing costs for a ${kind} at ${dollars(g.price)} in ${plan.local.city.name.replace(/^Elsewhere in /, '')}.`,
      '',
      'If you’re there, here’s what comes next:',
      ...steps.map((s, i) => `${i + 1}. ${s.title}. ${s.short}`),
      '',
      `Update what you’ve saved to see what you could buy today, and homes that fit you: ${origin}/app/?view=home`,
      '',
      'Not there yet? That’s fine: change the date in your plan, or turn this reminder off there.',
    ].join('\n'),
  };
}
