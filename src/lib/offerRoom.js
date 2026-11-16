// Making an offer on one home: what to offer, how strong that offer is,
// and the dates that follow. Built only from what's real: this listing's
// own history (days listed, price cuts), similar homes asking now, homes
// like it that came off the market (sold or withdrawn: their last asking
// price and days listed), and any sold prices the buyer's agent sent them.
// Sold prices belong to the real estate boards, so without the agent's,
// the range is a read of how much room the seller has, not a valuation.

import { daysListed, unitsOf } from './market.js';

/** Homes count as alike with the same number of units (buildings of five or more together). */
export const sizeOf = (units) => Math.min(Math.max(Math.round(Number(units) || 1), 1), 5);

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
const round = (x, to = 1000) => Math.round(x / to) * to;
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** The listing's price cuts: how many, and how far below its first price it now asks. */
export function cutsOf(l) {
  const h = (Array.isArray(l.priceHistory) ? l.priceHistory : []).map((x) => Number(x.price)).filter((x) => x > 0);
  const count = h.filter((p, i) => i > 0 && p < h[i - 1]).length;
  const first = h[0] ?? Number(l.price);
  return { count, pct: first > 0 ? Math.max(first - Number(l.price), 0) / first : 0 };
}

/**
 * What the market says about this home: days listed against similar homes
 * listed now, its price cuts, its asking price against similar homes', how
 * fast similar homes have been leaving the market, and sold prices the
 * buyer entered. Each with a plain sentence. `leverage` adds up who has the
 * upper hand: above 0 the buyer, below 0 the seller.
 */
export function marketSignals({ listing: l, listings = [], offMarket = [], sold = [], today = new Date().toISOString().slice(0, 10) }) {
  const kind = sizeOf(unitsOf(l));
  const same = listings.filter((x) => x.id !== l.id && (x.status ?? 'active') === 'active' && Number(x.price) > 0 && sizeOf(unitsOf(x)) === kind);
  const days = daysListed(l, today);
  const typicalDays = median(same.map((x) => daysListed(x, today)));
  const cuts = cutsOf(l);
  const askMid = median(same.map((x) => Number(x.price)));
  const nearPrice = (p) => Math.abs(p - l.price) / l.price <= 0.25;
  const gone = offMarket.filter((r) => sizeOf(r.units) === kind && Number(r.price) > 0 && nearPrice(Number(r.price)));
  const goneDays = median(gone.map((r) => r.days).filter((d) => d != null));
  const soldSame = sold.filter((x) => Number(x.price) > 0);
  const soldMid = median(soldSame.map((x) => Number(x.price)));

  const out = [];
  let leverage = 0;
  if (days != null && typicalDays) {
    if (days >= typicalDays * 1.5 && days >= 21) {
      leverage += 1;
      out.push({ key: 'days', tone: 'buyer', text: `Listed ${days} days, longer than most like it (${Math.round(typicalDays)}): the seller may take less.` });
    } else if (days <= Math.max(typicalDays * 0.5, 7)) {
      leverage -= 1;
      out.push({ key: 'days', tone: 'seller', text: `New: listed ${days} day${days === 1 ? '' : 's'}. Sellers rarely cut in the first weeks, and others may offer too.` });
    } else out.push({ key: 'days', tone: 'even', text: `Listed ${days} days, about usual for homes like it (${Math.round(typicalDays)}).` });
  }
  if (cuts.count > 0) {
    leverage += 1;
    out.push({ key: 'cuts', tone: 'buyer', text: `Cut ${cuts.count} time${cuts.count === 1 ? '' : 's'}, ${Math.round(cuts.pct * 100)}% below where it started: the seller is already moving.` });
  }
  if (askMid && same.length >= 4) {
    const vs = (l.price - askMid) / askMid;
    if (vs >= 0.08) {
      leverage += 1;
      out.push({ key: 'ask', tone: 'buyer', text: `Asks ${Math.round(vs * 100)}% more than the middle of ${same.length} similar homes for sale: room to offer less if it isn’t better than them.` });
    } else if (vs <= -0.08) {
      leverage -= 1;
      out.push({ key: 'ask', tone: 'seller', text: `Asks ${Math.round(-vs * 100)}% less than the middle of ${same.length} similar homes for sale: priced to sell, so expect competition.` });
    } else out.push({ key: 'ask', tone: 'even', text: `Priced close to ${same.length} similar homes for sale now.` });
  }
  if (gone.length >= 2 && goneDays != null) {
    if (goneDays <= 14) leverage -= 1;
    out.push({
      key: 'gone',
      tone: goneDays <= 14 ? 'seller' : 'even',
      text: `${gone.length} similar homes left the market lately (sold or withdrawn) after about ${Math.round(goneDays)} days${goneDays <= 14 ? ': good homes are going fast' : ''}.`,
    });
  }
  if (soldMid) out.push({ key: 'sold', tone: soldMid < l.price ? 'buyer' : 'seller', text: `Sold prices you added: middle ${Math.round(soldMid).toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })} from ${soldSame.length}.` });
  return { signals: out, leverage: clamp(leverage, -2, 3), days, typicalDays, cuts, askMid, gone, soldMid, soldCount: soldSame.length };
}

/**
 * A range to offer in: with sold prices from the buyer's agent, around
 * their middle; without, a share of the asking price set by who has the
 * upper hand. Always { low, open, high }, rounded to $1,000.
 */
export function offerRange(listing, m) {
  const ask = Number(listing.price);
  if (m.soldMid && m.soldCount >= 2) {
    const mid = clamp(m.soldMid, ask * 0.88, ask * 1.05);
    return { low: round(mid * 0.97), open: round(mid * 0.98), high: round(Math.min(mid * 1.01, ask * 1.05)), basis: 'sold' };
  }
  const band = { 3: [0.9, 0.93, 0.96], 2: [0.92, 0.94, 0.97], 1: [0.95, 0.96, 0.98], 0: [0.97, 0.98, 1], [-1]: [0.99, 1, 1.02], [-2]: [1, 1.01, 1.04] }[m.leverage] ?? [0.97, 0.98, 1];
  return { low: round(ask * band[0]), open: round(ask * band[1]), high: round(ask * band[2]), basis: 'listing' };
}

export const LEVELS = [
  { min: 72, key: 'strong', label: 'Strong', text: 'Likely to be taken seriously, and may win outright.' },
  { min: 52, key: 'good', label: 'Good', text: 'A real chance, especially if no one else offers.' },
  { min: 34, key: 'fair', label: 'Fair', text: 'Expect a counter-offer, or to lose to a stronger one.' },
  { min: 0, key: 'long', label: 'Long shot', text: 'Likely turned down unless the seller is under pressure.' },
];

/**
 * How strong an offer is, as a level and the reasons: its price against
 * the range, who has the upper hand, its conditions, deposit and closing
 * date. A read for comparing your own choices, not a prediction.
 * terms: { financing, inspection (conditions, true = included), depositPct, closingDays, flexible }
 */
export function offerStrength(price, range, m, terms = {}) {
  const reasons = [];
  // 50 at the opening offer, 80 at the top of the range, 20 at the bottom.
  const span = Math.max(range.high - range.low, 1);
  let score = 50 + ((price - range.open) / span) * 60;
  if (price >= range.high) reasons.push({ good: true, text: 'At or above the top of the range.' });
  else if (price < range.low) reasons.push({ good: false, text: 'Below the range: expect it to be turned down or countered hard.' });
  else reasons.push({ good: price >= range.open, text: price >= range.open ? 'Within the range, above the opening offer.' : 'Low in the range.' });
  score += m.leverage * 5;
  if (terms.financing) score -= 5;
  if (terms.inspection) score -= 5;
  if (!terms.financing && !terms.inspection) {
    score += 8;
    reasons.push({ good: true, text: 'No conditions (firm): stronger, but you lose your way out. Only with financing approved and an inspection done.' });
  } else reasons.push({ good: false, text: `Conditional on ${[terms.financing && 'financing', terms.inspection && 'an inspection'].filter(Boolean).join(' and ')}: protects you, and a seller weighs it.` });
  const dep = Number(terms.depositPct) || 0;
  if (dep >= 5) score += 5;
  else if (dep < 2) score -= 5;
  reasons.push({ good: dep >= 5, text: dep >= 5 ? `A ${dep}% deposit shows you’re serious.` : `A ${dep}% deposit is on the light side; 5% is common.` });
  if (terms.flexible) {
    score += 4;
    reasons.push({ good: true, text: 'A closing date that suits the seller helps.' });
  }
  score = Math.round(clamp(score, 3, 97));
  return { score, ...LEVELS.find((x) => score >= x.min), reasons };
}

/**
 * The dates that follow an offer made `today`: when it expires, the
 * deposit, each condition, and closing. Typical in most provinces; your
 * agent sets the real ones in the offer.
 */
export function offerTimeline(today, terms = {}) {
  const accepted = addDays(today, 1);
  const steps = [
    { key: 'offer', date: today, title: 'Your offer goes in', text: 'Your agent sends it with a time it expires, often the next evening.' },
    { key: 'deposit', date: addDays(accepted, 1), title: 'Deposit', text: 'Within a day of acceptance, by bank draft or transfer, held in trust (not lost unless you walk away without a condition).' },
  ];
  if (terms.inspection) steps.push({ key: 'inspection', date: addDays(accepted, 5), title: 'Inspection condition ends', text: 'Book the inspector the day it’s accepted. If it finds something big, renegotiate or walk away before this date.' });
  if (terms.financing) steps.push({ key: 'financing', date: addDays(accepted, Number(terms.financingDays) || 7), title: 'Financing condition ends', text: 'Your lender appraises the home and gives final approval. Waive the condition only once you have it in writing.' });
  const closing = Number(terms.closingDays) || 60;
  steps.push(
    { key: 'insurance', date: addDays(accepted, Math.max(closing - 10, 3)), title: 'Home insurance in place', text: 'Your lender needs proof before closing.' },
    { key: 'lawyer', date: addDays(accepted, Math.max(closing - 7, 4)), title: 'Sign with your lawyer, send the rest of your cash', text: 'The down payment (less the deposit), land transfer tax and closing costs.' },
    { key: 'closing', date: addDays(accepted, closing), title: 'Closing: you get the keys', text: 'Usually around midday, once the money has moved.' },
  );
  return steps;
}
