// Selling a home: what it's likely worth from similar homes listed for sale
// now, what you'd walk away with after commission, tax on it, the mortgage
// payout and the rest, and the steps from deciding to sell to closing day.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pos = (v) => Math.max(num(v), 0);

// GST/HST charged on a realtor's commission, by province (QC: GST plus QST).
export const COMMISSION_TAX = { ON: 0.13, NB: 0.15, NL: 0.15, PE: 0.15, NS: 0.14, QC: 0.14975 };
export const commissionTax = (province) => COMMISSION_TAX[province] ?? 0.05;

export const DEFAULT_SELL = {
  city: null, // a listing city key; null = where your plan is
  units: 1,
  beds: 3,
  price: null, // what you'd list at; null = the estimate
  mortgage: 0, // left owing
  ratePct: 5,
  fixed: true,
  penalty: null, // from your lender's payout statement; null = estimate
  privateSale: false,
  commissionPct: 5, // total, both agents; it's negotiable
  legal: 1500,
  moving: 2000,
  repairs: 0,
  other: 0,
  done: {},
};

export function normalizeSell(s) {
  const out = { ...DEFAULT_SELL };
  if (typeof s?.city === 'string' && /^[a-z-]{2,30}$/.test(s.city)) out.city = s.city;
  if ([1, 2, 3, 4, 5].includes(Number(s?.units))) out.units = Number(s.units);
  for (const k of ['beds', 'mortgage', 'ratePct', 'commissionPct', 'legal', 'moving', 'repairs', 'other']) if (s && Number.isFinite(Number(s[k]))) out[k] = Math.max(Number(s[k]), 0);
  for (const k of ['price', 'penalty']) out[k] = s?.[k] != null && Number.isFinite(Number(s[k])) ? Math.max(Number(s[k]), 0) : null;
  for (const k of ['fixed', 'privateSale']) if (typeof s?.[k] === 'boolean') out[k] = s[k];
  out.done = Object.fromEntries(Object.entries(s?.done && typeof s.done === 'object' ? s.done : {}).filter(([, v]) => v === true));
  return out;
}

/** Bedrooms in a listing, all units together ("2+1" counts 3), or null when it doesn't say. */
export function totalBeds(listing) {
  const beds = Array.isArray(listing?.beds) ? listing.beds : listing?.beds != null ? [listing.beds] : [];
  let total = 0;
  let known = false;
  for (const b of beds) {
    const parts = String(b ?? '').match(/\d+/g);
    if (!parts) continue;
    known = true;
    total += parts.map(Number).reduce((x, y) => x + y, 0);
  }
  return known ? total : null;
}

const unitsOf = (l) => Math.max(Math.round(num(l?.units)) || 1, 1);
const quantile = (sorted, q) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/**
 * What a home is likely worth, from similar homes for sale now in the same
 * city: the same number of units (5+ counted together), and within a
 * bedroom of yours where listings say. Needs at least three. Asking prices,
 * not sale prices: the answer says so.
 */
export function homeWorth({ units = 1, beds, listings = [] }) {
  const want = Math.min(Math.max(Math.round(num(units)) || 1, 1), 5);
  const active = listings.filter((l) => (l.status ?? 'active') === 'active' && num(l.price) > 0);
  const sameKind = active.filter((l) => Math.min(unitsOf(l), 5) === want);
  const b = num(beds);
  const close = b > 0 ? sameKind.filter((l) => totalBeds(l) != null && Math.abs(totalBeds(l) - b) <= 1) : [];
  const comps = close.length >= 3 ? close : sameKind;
  if (comps.length < 3) return null;
  const prices = comps.map((l) => num(l.price)).sort((x, y) => x - y);
  const score = (l) => (b > 0 && totalBeds(l) != null ? Math.abs(totalBeds(l) - b) : 2);
  const round = (v) => Math.round(v / 5000) * 5000;
  return {
    estimate: round(quantile(prices, 0.5)),
    low: round(quantile(prices, 0.25)),
    high: round(quantile(prices, 0.75)),
    count: comps.length,
    byBeds: comps === close,
    comps: [...comps].sort((x, y) => score(x) - score(y) || Math.abs(num(x.price) - quantile(prices, 0.5)) - Math.abs(num(y.price) - quantile(prices, 0.5))).slice(0, 8),
  };
}

/**
 * What you walk away with: the price less commission and the tax on it,
 * the mortgage left and its prepayment penalty, legal fees, moving, repairs
 * and anything else. The penalty, if you don't have your lender's figure,
 * is estimated as three months' interest (what a variable rate charges;
 * a fixed rate's can be much more).
 */
export function netProceeds({ price, province = 'ON', privateSale = false, commissionPct = 5, mortgage = 0, ratePct = 5, fixed = true, penalty = null, legal = 1500, moving = 2000, repairs = 0, other = 0 }) {
  const p = pos(price);
  const commission = privateSale ? 0 : (p * pos(commissionPct)) / 100;
  const tax = commission * commissionTax(province);
  const threeMonths = (pos(mortgage) * pos(ratePct)) / 100 / 4;
  const pen = penalty != null ? pos(penalty) : threeMonths;
  const lines = [
    { key: 'commission', label: privateSale ? 'Commission (selling privately)' : `Commission, ${num(commissionPct)}%`, amount: commission },
    { key: 'tax', label: `${province === 'QC' ? 'GST and QST' : COMMISSION_TAX[province] ? 'HST' : 'GST'} on the commission`, amount: tax },
    { key: 'mortgage', label: 'Mortgage paid off', amount: pos(mortgage) },
    { key: 'penalty', label: penalty != null ? 'Prepayment penalty' : `Prepayment penalty (estimate${fixed ? ', could be more' : ''})`, amount: pos(mortgage) > 0 ? pen : 0 },
    { key: 'legal', label: 'Lawyer or notary', amount: pos(legal) },
    { key: 'repairs', label: 'Repairs and staging', amount: pos(repairs) },
    { key: 'moving', label: 'Moving', amount: pos(moving) },
    { key: 'other', label: 'Other costs', amount: pos(other) },
  ].filter((l) => l.amount > 0 || ['commission', 'mortgage'].includes(l.key));
  const costs = lines.reduce((s, l) => s + l.amount, 0);
  return { price: p, lines, costs, net: p - costs, penaltyEstimated: penalty == null && pos(mortgage) > 0, fixed };
}

/** The steps from deciding to sell to handing over the keys. */
export const SELL_STEPS = [
  { id: 'worth', title: 'Find out what it’s worth', short: 'Look at similar homes for sale now, and ask two or three agents for their price.' },
  { id: 'payout', title: 'Ask your lender for a payout statement', short: 'The mortgage left and the exact penalty to break it early. Ask about porting it to your next home.' },
  { id: 'agent', title: 'Choose an agent, or sell it yourself', short: 'Interview two or three; commission is negotiable. Selling privately saves it, but you do the showings and paperwork.' },
  { id: 'fix', title: 'Fix what buyers will notice', short: 'Leaks, broken fixtures, peeling paint. Fresh paint and a deep clean pay back; big renovations rarely do.' },
  { id: 'stage', title: 'Declutter and stage it', short: 'Clear surfaces, take down personal photos, brighten every room. Good photos sell the showing.' },
  { id: 'list', title: 'List it', short: 'Price it near what similar homes sell for. Overpriced homes sit, and sitting homes sell for less.' },
  { id: 'showings', title: 'Showings and open houses', short: 'Keep it show-ready; be out while buyers look.' },
  { id: 'offers', title: 'Review offers and conditions', short: 'Price matters, but so do conditions (financing, inspection), the deposit and the closing date.' },
  { id: 'lawyer', title: 'Hire a lawyer or notary', short: 'They pay off your mortgage, transfer the title and send you what’s left.' },
  { id: 'close', title: 'Closing day', short: 'Move out, leave keys and manuals, cancel utilities and insurance from that day.' },
];

/** The next selling step: the first one not ticked. */
export function sellNextStep(sell) {
  const i = SELL_STEPS.findIndex((s) => !sell.done?.[s.id]);
  if (i < 0) return { id: 'sold', title: 'Every step done', text: 'Congratulations on the sale.', view: 'sellready', action: 'See your checklist' };
  const s = SELL_STEPS[i];
  return { id: s.id, index: i, count: SELL_STEPS.length, title: s.title, text: s.short, view: s.id === 'worth' ? 'sell' : s.id === 'list' ? 'selllist' : 'sellready', anchor: s.id === 'worth' || s.id === 'list' ? undefined : `sell-${s.id}`, action: s.id === 'worth' ? 'See what it’s worth' : s.id === 'list' ? 'List it' : 'How to do it' };
}

