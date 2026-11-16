// Becoming a real estate agent (salesperson) in Ontario, step by step, and
// the deadlines along the way. From RECO's and the education providers'
// own pages (SOURCES), checked AGENT_RULES_CHECKED. Fees and rules change:
// the guide always sends people to the official pages to confirm.

export const AGENT_RULES_CHECKED = '2026-11-16';

export const SOURCES = {
  reco: ['RECO: becoming a real estate agent', 'https://reco.on.ca/learners/becoming-a-real-estate-agent'],
  recoProgram: ['RECO: the Real Estate Salesperson Program and approved providers', 'https://reco.on.ca/education/real-estate-salesperson-program'],
  humber: ['Humber Polytechnic: become a salesperson', 'https://humber.ca/realestate/become-a-salesperson.html'],
  humberPath: ['Humber Polytechnic: the learning path', 'https://humber.ca/realestate/become-a-salesperson/learning-path.html'],
  algonquin: ['Algonquin College: Real Estate Salesperson Program', 'https://realestate.algonquincollege.com/'],
};

// What Humber Polytechnic listed for its program when checked; other providers' fees can differ.
export const FEES = { preRegistration: 4110, postRegistration: 655 };

/**
 * The tracker's steps, in order. `items`: the boxes to tick inside a step.
 * `date`: the date the step asks for, which starts a deadline.
 */
export const AGENT_STEPS = [
  {
    id: 'check',
    title: 'Check that it fits you',
    short: 'Courses need a Canadian high school diploma or GED (or a pass on the provider’s admission exam), and English. Registering with RECO later needs you to be 18 or older.',
    items: [
      ['age', '18 or older by the time I register'],
      ['school', 'High school diploma or GED, or I’ll take the admission exam'],
      ['money', 'Can cover the course fees, plus registration, insurance and brokerage fees later'],
    ],
  },
  {
    id: 'enrol',
    title: 'Enrol with a RECO-approved provider',
    short: 'Pick one of the providers on RECO’s list and open a RECO learner account. Use your full legal name; it must match on both.',
    date: ['started', 'Date you started your first course'],
    items: [
      ['provider', 'Chose a provider from RECO’s list'],
      ['account', 'Opened my RECO learner account'],
    ],
  },
  {
    id: 'pre',
    title: 'Finish the pre-registration phase',
    short: 'Five courses, four exams and two simulation sessions, done within 24 months of starting the first course.',
    date: ['preDone', 'Date you passed the last pre-registration requirement'],
    items: [
      ['c1', 'Course 1'],
      ['c2', 'Course 2'],
      ['c3', 'Course 3'],
      ['c4', 'Course 4'],
      ['c5', 'Course 5'],
      ['e1', 'Exam 1'],
      ['e2', 'Exam 2'],
      ['e3', 'Exam 3'],
      ['e4', 'Exam 4'],
      ['s1', 'Simulation session 1'],
      ['s2', 'Simulation session 2'],
    ],
  },
  {
    id: 'brokerage',
    title: 'Find a brokerage to work for',
    short: 'You can’t trade in real estate on your own: a registered brokerage must take you on before RECO registers you. Start talking to brokerages before you finish your courses.',
    items: [
      ['shortlist', 'Made a shortlist of three or more brokerages'],
      ['interviews', 'Interviewed at least two'],
      ['offer', 'Have a brokerage ready to sponsor my registration'],
    ],
  },
  {
    id: 'register',
    title: 'Register with RECO',
    short: 'Apply within 12 months of finishing the pre-registration phase, with your brokerage, a Criminal Record and Judicial Matters Check (CRJMC), and RECO’s insurance.',
    date: ['registered', 'Date RECO registered you'],
    items: [
      ['crjmc', 'Got my Criminal Record and Judicial Matters Check'],
      ['applied', 'Applied to RECO with my brokerage'],
      ['insurance', 'Joined RECO’s professional liability insurance'],
    ],
  },
  {
    id: 'post',
    title: 'Finish the post-registration phase',
    short: 'More courses in your first two years as an agent. You can’t renew your registration until they’re done.',
    items: [['postDone', 'Finished the post-registration phase']],
  },
];

// The questions worth asking every brokerage before you sign.
export const BROKERAGE_QUESTIONS = [
  'What is the commission split, and does it change as I sell more?',
  'What do I pay each month: desk fees, franchise fees, technology, marketing?',
  'What training and mentoring do new agents get, and from whom?',
  'Do you give new agents leads, and what do they cost?',
  'Who reviews my first offers and agreements?',
  'How many new agents joined last year, and how many are still here?',
];

const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  // The same day of the month, or the month's last day when it has fewer days.
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
};
const validDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const daysUntil = (iso, today) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);

/**
 * The deadlines the dates entered so far set, soonest first:
 * pre-registration within 24 months of starting, RECO registration within
 * 12 months of finishing it, post-registration within 24 months of
 * registering. Each: { id, label, date, days, done }.
 */
export function agentDeadlines(dates = {}, ticks = {}, today = new Date().toISOString().slice(0, 10)) {
  const out = [];
  if (validDate(dates.started)) out.push({ id: 'pre', label: 'Finish the pre-registration phase', date: addMonths(dates.started, 24), done: validDate(dates.preDone) });
  if (validDate(dates.preDone)) out.push({ id: 'register', label: 'Apply to register with RECO', date: addMonths(dates.preDone, 12), done: validDate(dates.registered) });
  if (validDate(dates.registered)) out.push({ id: 'post', label: 'Finish the post-registration phase', date: addMonths(dates.registered, 24), done: Boolean(ticks.postDone) });
  return out.map((d) => ({ ...d, days: daysUntil(d.date, today) })).sort((a, b) => a.done - b.done || a.date.localeCompare(b.date));
}

/** How far along: ticked boxes over all boxes, and the first step not finished. */
export function agentProgress(ticks = {}) {
  const all = AGENT_STEPS.flatMap((s) => s.items.map(([k]) => k));
  const done = all.filter((k) => ticks[k]).length;
  const next = AGENT_STEPS.find((s) => s.items.some(([k]) => !ticks[k])) ?? null;
  return { done, total: all.length, next };
}
