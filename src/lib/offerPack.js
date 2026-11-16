// The Offer Pack: everything to bring to an agent or lender about one home
// for sale, on one page. The most to pay and why, the cash it takes to
// buy, what it costs each month, similar homes for sale now, the price
// history, and the questions to ask. Every figure comes from the listing,
// the market assumptions the app shows, and the same engine as the rest
// of the app; nothing is guessed (a missing tax bill stays missing).

import { drawMarkPdf } from './brand.js';
import { analyzeDeal } from './finance.js';
import { money } from './format.js';
import { daysListed, typeOf, unitsOf } from './market.js';
import { offerLine } from './dealSheetPdf.js';
import { propertyRisks } from './risks.js';
import { isCondo } from './condo.js';

const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

/**
 * Similar homes for sale now: the same kind (house, 2–4 units, 5+),
 * still listed, nearest in price first.
 */
export function similarHomes(listing, listings, n = 6) {
  const kind = typeOf(unitsOf(listing));
  const price = Number(listing.price) || 0;
  return (listings ?? [])
    .filter((l) => l.id !== listing.id && (l.status ?? 'active') === 'active' && Number(l.price) > 0 && typeOf(unitsOf(l)) === kind)
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, n);
}

/**
 * What the pack says, as plain data: `s` is the listing scored by the
 * listings engine (scoreListing), `at` the offer the person is running
 * ({ price, downPct, rate }), `listings` the city's feed, `province` for
 * the questions to ask.
 */
export function offerPackData({ s, at = {}, listings = [], province = 'ON', today = new Date() }) {
  const l = s.listing;
  const deal = { ...s.deal, price: at.price ?? s.deal.price, downPct: at.downPct ?? s.deal.downPct, rate: at.rate ?? s.deal.rate, refiRate: at.rate ?? s.deal.rate };
  const a = analyzeDeal(deal);
  const comps = similarHomes(l, listings);
  const doors = (x) => unitsOf(x);
  return {
    address: l.address,
    asking: Number(l.price),
    offerPrice: a.price,
    mls: l.mls || '',
    url: l.url || '',
    units: unitsOf(l),
    yearBuilt: l.yearBuilt ?? null,
    daysListed: daysListed(l, today.toLocaleDateString('en-CA')),
    max: offerLine(s.offer),
    needsTax: s.needsTax,
    rentSource: s.rentSource,
    cash: {
      down: a.downPayment,
      downPct: Number(deal.downPct),
      transferTax: a.landTransferTax,
      closing: Math.max(a.closingCosts - a.landTransferTax, 0),
      total: a.cashInvested,
    },
    monthly: {
      mortgage: a.pi,
      rate: Number(deal.rate),
      taxes: s.needsTax ? null : a.taxes,
      insurance: a.insurance,
      utilities: a.hoa,
      rent: a.grossRent,
      upkeep: a.opex.total,
      left: s.needsTax ? null : a.netCashFlow,
    },
    comps: comps.map((c) => ({ address: c.address, price: Number(c.price), units: doors(c), perDoor: Number(c.price) / doors(c), days: daysListed(c, today.toLocaleDateString('en-CA')) })),
    compMedian: median(comps.map((c) => Number(c.price))),
    history: (Array.isArray(l.priceHistory) ? l.priceHistory : []).filter((h) => h && Number(h.price) > 0).map((h) => ({ date: h.date, price: Number(h.price) })),
    questions: propertyRisks({
      units: unitsOf(l),
      condo: isCondo(l),
      yearBuilt: l.yearBuilt,
      province,
      rentStated: Number(l.grossRent) > 0 || (Array.isArray(l.rents) && l.rents.some((r) => Number(r) > 0)),
      text: l.highlights ?? '',
    }),
  };
}

const PAGE = { w: 612, h: 792, m: 42 };
const INK = [24, 24, 27];
const SOFT = [82, 82, 91];
const MUTED = [120, 120, 130];
const RULE = [222, 222, 226];
const BRAND = [39, 129, 34];
const RED = [185, 28, 28];
const TINT = [236, 248, 243];
const clean = (t) =>
  String(t ?? '')
    .replace(/⁠/g, '')
    .replace(/−/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/–|—/g, '-')
    .replace(/×/g, 'x');

/** The pack as a one-page PDF, saved to the person's device. */
export async function downloadOfferPack(p, place) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { m } = PAGE;
  const W = PAGE.w - m * 2;
  const text = (t, x, y, { size = 9.5, bold = false, color = INK, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(clean(t), x, y, { align });
  };
  const wrap = (t, x, y, width, { size = 9, color = SOFT, bold = false } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(t), width);
    doc.text(lines, x, y, { lineHeightFactor: 1.35 });
    return y + lines.length * size * 1.35;
  };
  const rule = (y) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.7);
    doc.line(m, y, m + W, y);
  };
  const row = (label, value, y, x = m, w = W, color = INK) => {
    text(label, x, y, { color: SOFT });
    text(value, x + w, y, { bold: true, align: 'right', color });
  };
  const heading = (t, y, x = m) => {
    text(t.toUpperCase(), x, y, { size: 7.5, bold: true, color: MUTED });
    return y + 14;
  };

  // Header.
  drawMarkPdf(doc, m, m - 1, 17);
  text('Squarely  ·  Offer Pack', m + 22, m + 11.5, { size: 10, bold: true });
  text(new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }), m + W, m + 11.5, { size: 8.5, color: MUTED, align: 'right' });
  let y = m + 44;
  text(doc.splitTextToSize(clean(p.address), W)[0], m, y, { size: 19, bold: true });
  y += 15;
  const what = [place?.name, p.units === 1 ? 'house' : `${p.units} units`, p.yearBuilt ? `built ${p.yearBuilt}` : null, p.mls ? `MLS ${p.mls}` : null, p.daysListed != null ? `${p.daysListed} days listed` : null].filter(Boolean).join('  ·  ');
  text(what, m, y, { color: SOFT });

  // The most to pay.
  y += 14;
  doc.setFillColor(...TINT);
  doc.roundedRect(m, y, W, 46, 6, 6, 'F');
  text('MOST YOU SHOULD PAY', m + 12, y + 15, { size: 7, bold: true, color: MUTED });
  text(p.max ? p.max.value : 'Needs the tax bill', m + 12, y + 35, { size: 17, bold: true, color: BRAND });
  text(`Asking ${money(p.asking)}${p.offerPrice !== p.asking ? `  ·  your offer ${money(p.offerPrice)}` : ''}`, m + W - 12, y + 20, { align: 'right', color: SOFT });
  if (p.max?.note) text(p.max.note, m + W - 12, y + 34, { size: 8, align: 'right', color: MUTED });
  y += 64;

  // Two columns: cash to buy, and each month.
  const colW = (W - 28) / 2;
  const x2 = m + colW + 28;
  let yl = heading(`Cash to buy at ${money(p.offerPrice)}`, y);
  row(`Down payment (${p.cash.downPct}%)`, money(p.cash.down), yl, m, colW);
  row('Land transfer tax', money(p.cash.transferTax), (yl += 14), m, colW);
  row('Legal, title and inspection', money(p.cash.closing), (yl += 14), m, colW);
  doc.setDrawColor(...RULE);
  doc.line(m, (yl += 7), m + colW, yl);
  row('Total cash to buy', money(p.cash.total), (yl += 13), m, colW);
  let yr = heading('Each month', y, x2);
  doc.setFont('helvetica', 'normal');
  const mo = p.monthly;
  row(`Mortgage at ${mo.rate}%`, money(mo.mortgage), yr, x2, colW);
  row('Property tax', mo.taxes == null ? 'Not listed' : money(mo.taxes), (yr += 14), x2, colW);
  row('Insurance', money(mo.insurance), (yr += 14), x2, colW);
  if (mo.utilities > 0) row('Owner-paid utilities', money(mo.utilities), (yr += 14), x2, colW);
  row(`Rent${p.rentSource === 'stated' ? '' : ' (estimated)'}`, money(mo.rent), (yr += 14), x2, colW);
  row('Vacancy, repairs, management', money(mo.upkeep), (yr += 14), x2, colW);
  doc.setDrawColor(...RULE);
  doc.line(x2, (yr += 7), x2 + colW, yr);
  row('Left each month', mo.left == null ? 'Needs the tax bill' : money(mo.left, { signed: true }), (yr += 13), x2, colW, mo.left == null ? MUTED : mo.left >= 0 ? BRAND : RED);
  y = Math.max(yl, yr) + 24;

  // Similar homes.
  rule(y - 10);
  y = heading(`Similar homes for sale now${p.compMedian ? `  ·  middle price ${money(p.compMedian)}` : ''}`, y + 4);
  if (!p.comps.length) y = wrap('No similar homes listed in this city right now.', m, y, W) + 4;
  for (const c of p.comps) {
    text(doc.splitTextToSize(clean(c.address), W * 0.55)[0], m, y, { color: INK });
    text(c.units === 1 ? 'house' : `${c.units} units`, m + W * 0.6, y, { color: SOFT });
    text(c.days != null ? `${c.days} days` : '', m + W * 0.75, y, { color: SOFT });
    text(money(c.price), m + W, y, { bold: true, align: 'right' });
    y += 13;
  }

  // Price history.
  if (p.history.length > 1) {
    y += 8;
    rule(y - 10);
    y = heading('Price history', y + 4);
    text(p.history.map((h) => `${h.date}: ${money(h.price)}`).join('   ->   '), m, y, { color: SOFT, size: 8.5 });
    y += 14;
  }

  // Questions to ask.
  if (p.questions.length) {
    y += 8;
    rule(y - 10);
    y = heading('Ask before you offer', y + 4);
    for (const q of p.questions) {
      text(q.title, m, y, { bold: true, size: 9 });
      y = wrap(q.text, m, y + 12, W, { size: 8.5 }) + 4;
      if (y > PAGE.h - 80) break;
    }
  }

  // Footer.
  wrap(
    `Estimates from the listing${p.url ? ` (${p.url})` : ''}, today's posted rates and average asking rents, not an appraisal or financial advice. A lender, lawyer and home inspector confirm the real numbers. Made with Squarely.`,
    m,
    PAGE.h - 46,
    W,
    { size: 7, color: MUTED },
  );
  const name = `offer-pack-${String(p.address).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'home'}.pdf`;
  doc.save(name);
  return name;
}

