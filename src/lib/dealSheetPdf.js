// A clean one-page deal sheet to print or send: what the property costs
// each month, the cash it takes, what's left for you, ten years of cash
// flow, and the most you should pay. Plain words, no lender jargon. jsPDF
// is loaded on demand so it never weighs down the app.

import { MARK } from './brand.js';
import { feesLabel } from './condo.js';
import { analyzeDeal, maxOffer, paybackYears, projectDeal, saleAnalysis } from './finance.js';
import { money, percent } from './format.js';
import { placeLabel } from './place.js';
import { UNIT_TYPES } from './presets.js';

const PAGE = { w: 612, h: 792, m: 42 };
const INK = [24, 24, 27];
const SOFT = [82, 82, 91];
const MUTED = [120, 120, 130];
const RULE = [222, 222, 226];
const BRAND = [4, 120, 87];
const RED = [185, 28, 28];
const TINT = [236, 248, 243];

// Helvetica in a PDF covers WinAnsi only: swap the typographic characters the app uses.
const clean = (s) =>
  String(s ?? '')
    .replace(/⁠/g, '')
    .replace(/−/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/–|—/g, '-');

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** The sentence at the top: does it make money, and how much. */
export function headline(a) {
  if (a.netCashFlow >= 0) return `Leaves about ${money(a.netCashFlow)} a month for you after the mortgage and every cost.`;
  return `Costs you about ${money(-a.netCashFlow)} a month on top of the rent, after the mortgage and every cost.`;
}

/** "Most you should pay" in words. */
export function offerLine(offer) {
  if (!offer || offer.price == null) return null;
  if (!offer.feasible) return { value: 'No price works', note: 'Even at a much lower price it misses your targets.' };
  if (!Number.isFinite(offer.price)) return { value: 'No limit', note: 'It meets your targets at any price.' };
  const lim = offer.limits?.find((l) => l.key === offer.binding);
  const vs = offer.vsAsking >= 0 ? `${money(offer.vsAsking)} above asking` : `${money(-offer.vsAsking)} below asking`;
  return { value: money(offer.price), note: `${vs}${lim ? `. Above this it misses your ${lim.label.toLowerCase()} target` : ''}.` };
}

/**
 * The deal as the sheet shows it: self-managed, so no property management
 * fee, with everything (monthly, ten years, the most to pay) worked out
 * that way so the page adds up.
 */
export function sheetItem(deal, targets) {
  const d = { ...deal, mgmtPct: 0 };
  const rows = projectDeal(d, 10);
  return { deal: d, a: analyzeDeal(d), rows, sale: saleAnalysis(d, rows), offer: maxOffer(d, targets) };
}

export async function buildDealSheetPdf({ deal, a, rows, sale, offer }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { m } = PAGE;
  const W = PAGE.w - m * 2;

  const text = (s, x, y, { size = 9.5, bold = false, color = INK, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(clean(s), x, y, { align });
  };
  const rule = (x1, y, x2, color = RULE, width = 0.7) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y, x2, y);
  };
  const wrap = (s, x, y, width, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 9.5);
    const lines = doc.splitTextToSize(clean(s), width);
    doc.setTextColor(...(opts.color ?? INK));
    doc.text(lines, x, y, { lineHeightFactor: 1.35 });
    return y + lines.length * (opts.size ?? 9.5) * 1.35;
  };

  // ---- Header: the mark, the name, where it is.
  doc.setFillColor(...BRAND);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(MARK.stroke / 3);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  MARK.brackets.forEach((pts) => {
    const [[x0, y0], ...rest] = pts.map(([x, y]) => [m + x / 3, m + y / 3]);
    doc.lines(rest.map(([x, y], i) => [x - (i ? rest[i - 1][0] : x0), y - (i ? rest[i - 1][1] : y0)]), x0, y0, [1, 1], 'S');
  });
  const q = MARK.square;
  doc.roundedRect(m + q.x / 3, m + q.y / 3, q.size / 3, q.size / 3, q.r / 3, q.r / 3, 'F');
  doc.setLineCap('butt');
  doc.setLineJoin('miter');
  text('Squarely', m + 22, m + 11.5, { size: 10, bold: true });
  text(new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }), m + W, m + 11.5, { size: 8.5, color: MUTED, align: 'right' });

  let y = m + 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  text(doc.splitTextToSize(clean(deal.name || 'Property'), W)[0], m, y, { size: 21, bold: true });
  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const what = [
    type?.key === 'multiplex' ? `${a.units}-unit building` : type?.label,
    // The address, unless the name already says it (then the city line below covers the rest).
    deal.address && !String(deal.address).startsWith(String(deal.name)) ? deal.address : null,
    deal.country === 'ca' ? placeLabel(deal) : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  y += 15;
  text(what, m, y, { size: 9.5, color: SOFT });

  // ---- The answer, in a tinted band.
  y += 14;
  const good = a.netCashFlow >= 0;
  doc.setFillColor(...(good ? TINT : [253, 236, 236]));
  doc.roundedRect(m, y, W, 30, 6, 6, 'F');
  text(headline(a), m + 12, y + 19, { size: 10.5, bold: true, color: good ? BRAND : RED });
  y += 30;

  // ---- Four numbers that matter most.
  y += 12;
  const off = offerLine(offer);
  const payback = paybackYears(a);
  const boxes = [
    ['Left for you', `${money(a.netCashFlow, { signed: true })}/mo`, `${money(a.annualCashFlow, { signed: true })} a year`, good ? BRAND : RED],
    ['Cash you put in', money(a.cashInvested), `${num(deal.downPct)}% down plus closing`, INK],
    ['Return on your cash', percent(a.coc, 1), payback ? `Paid back in ${payback.toFixed(1)} years` : 'Never pays back at this rent', a.coc >= 0 ? BRAND : RED],
    ['Most you should pay', off ? off.value : money(a.price), off ? `Asking ${money(a.price)}` : 'Asking price', INK],
  ];
  const gap = 10;
  const bw = (W - gap * 3) / 4;
  boxes.forEach(([label, value, sub, color], i) => {
    const x = m + i * (bw + gap);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.9);
    doc.roundedRect(x, y, bw, 56, 6, 6, 'S');
    text(label.toUpperCase(), x + 10, y + 15, { size: 7, color: MUTED, bold: true });
    text(value, x + 10, y + 35, { size: 15, bold: true, color });
    text(sub, x + 10, y + 48, { size: 7.5, color: MUTED });
  });
  y += 56;

  // ---- Two columns: each month, and your cash.
  const colW = (W - 28) / 2;
  const section = (x, top, title, items) => {
    text(title, x, top, { size: 11, bold: true });
    rule(x, top + 5, x + colW, INK, 1.1);
    let yy = top + 20;
    items.forEach(([label, value, kind]) => {
      if (kind === 'total') rule(x, yy - 10, x + colW, INK, 0.9);
      const strong = kind === 'total';
      const color = kind === 'neg' ? SOFT : INK;
      text(label, x, yy, { size: 9.5, bold: strong, color: strong ? INK : SOFT });
      text(value, x + colW, yy, { size: 9.5, bold: strong, align: 'right', color: kind === 'pos' ? BRAND : color });
      yy += strong ? 18 : 15;
    });
    return yy;
  };
  const neg = (v) => (v > 0 ? `-${money(v)}` : money(0));
  const opex = a.opex ?? {};
  y += 26;
  const monthly = [
    [`Rent${a.units > 1 ? `, ${a.units} units` : ''}`, money(a.grossRent)],
    [a.interestOnly ? 'Mortgage payment (interest only)' : 'Mortgage payment', neg(a.pi), 'neg'],
    ['Property tax', neg(a.taxes), 'neg'],
    ['Insurance', neg(a.insurance), 'neg'],
    ...(a.hoa > 0 ? [[feesLabel(deal), neg(a.hoa), 'neg']] : []),
    // Self-managed: a management fee shows only if the deal still carries one.
    ...(opex.management > 0 ? [[`Property management (${num(deal.mgmtPct)}%)`, neg(opex.management), 'neg']] : []),
    [`Repairs & upkeep (${num(deal.maintPct)}%)`, neg(opex.maintenance), 'neg'],
    [`Vacancy rate (${num(deal.vacancyPct)}%)`, neg(opex.vacancy), 'neg'],
    [`Big repairs saved for (${num(deal.capexPct)}%)`, neg(opex.capex), 'neg'],
    ['Left for you each month', money(a.netCashFlow, { signed: true }), 'total'],
  ];
  const leftEnd = section(m, y, 'Each month', monthly);
  const cash = [
    [`Down payment (${num(deal.downPct)}%)`, money(a.downPayment)],
    [a.landTransferTax ? 'Closing costs and land transfer tax' : 'Closing costs', money(a.closingCosts)],
    ...(a.rehab > 0 ? [['Repairs before renting', money(a.rehab)]] : []),
    ['Cash you put in', money(a.cashInvested), 'total'],
    ['Mortgage', money(a.loanAmount)],
    ['Rate and length', `${num(deal.rate)}% over ${num(deal.termYears)} years`],
    ...(a.reserves > 0 ? [['Kept in the bank for surprises', money(a.reserves)]] : []),
  ];
  const rightEnd = section(m + colW + 28, y, 'Your cash', cash);

  // The most you should pay, under the cash column.
  let ry = rightEnd + 4;
  if (off) {
    text('Most you should pay', m + colW + 28, ry + 10, { size: 11, bold: true });
    rule(m + colW + 28, ry + 15, m + W, INK, 1.1);
    text(off.value, m + colW + 28, ry + 34, { size: 15, bold: true, color: BRAND });
    ry = wrap(off.note, m + colW + 28, ry + 48, colW, { size: 8.5, color: SOFT });
  }

  // ---- Ten years of cash flow: a bar per year and a table.
  y = Math.max(leftEnd, ry) + 14;
  const years = (rows ?? []).slice(0, 10);
  text('Cash flow over 10 years', m, y, { size: 11, bold: true });
  const total10 = years.reduce((s, r) => s + num(r.cashFlow), 0);
  text(`${money(total10, { signed: true })} in all`, m + W, y, { size: 9.5, bold: true, align: 'right', color: total10 >= 0 ? BRAND : RED });
  rule(m, y + 5, m + W, INK, 1.1);
  y += 14;

  // Bars.
  const chartH = 64;
  const maxAbs = Math.max(1, ...years.map((r) => Math.abs(num(r.cashFlow))));
  const hasNeg = years.some((r) => num(r.cashFlow) < 0);
  const base = hasNeg ? y + chartH / 2 : y + chartH;
  const scale = (hasNeg ? chartH / 2 : chartH) / maxAbs;
  const slot = W / Math.max(years.length, 1);
  rule(m, base, m + W, RULE, 0.7);
  years.forEach((r, i) => {
    const v = num(r.cashFlow);
    const h = Math.max(Math.abs(v) * scale, 0.8);
    doc.setFillColor(...(v >= 0 ? BRAND : RED));
    doc.rect(m + i * slot + slot * 0.22, v >= 0 ? base - h : base, slot * 0.56, h, 'F');
  });
  y += chartH + 14;

  // Table under the bars, one column per year.
  const tableRows = [
    ['Year', (r) => String(r.year)],
    ['Cash flow', (r) => money(r.cashFlow, { signed: true })],
    ['Total so far', (r) => money(r.cumCashFlow, { signed: true })],
    ['Worth', (r) => money(r.value)],
    ['Owed', (r) => money(r.balance)],
    ['Yours (equity)', (r) => money(r.equity)],
  ];
  const labelW = 70;
  const cellW = (W - labelW) / Math.max(years.length, 1);
  tableRows.forEach(([label, f], ri) => {
    const head = ri === 0;
    text(label, m, y, { size: 7.5, bold: head || label.startsWith('Yours'), color: head ? MUTED : SOFT });
    years.forEach((r, i) => text(f(r), m + labelW + cellW * (i + 1) - 3, y, { size: 7.2, bold: head || label.startsWith('Yours'), color: head ? MUTED : INK, align: 'right' }));
    if (!head) rule(m, y + 4, m + W, RULE, 0.5);
    y += 12.5;
  });

  // ---- If you sold after ten years.
  if (sale) {
    y += 10;
    const line = `If you sold in year ${sale.year}: about ${money(sale.salePrice)}, ${money(sale.netProceeds)} to you after selling costs and paying off the mortgage. With ${sale.year} years of cash flow, that's ${money(sale.profit, { signed: true })} more than the ${money(a.cashInvested)} you put in.`;
    y = wrap(line, m, y, W, { size: 9.5, bold: false, color: INK });
  }

  // ---- What it assumes.
  y = Math.max(y + 10, PAGE.h - m - 30);
  rule(m, y - 10, m + W);
  const note = `Assumes the home's value grows ${num(deal.appreciationPct)}% a year, rent ${num(deal.rentGrowthPct)}% and tax and insurance ${num(deal.expenseGrowthPct)}%. Self-managed: no property management fee. Repairs, vacancy and big repairs are shares of the rent${deal.city === 'thunder-bay' ? '; vacancy is Thunder Bay\'s average (CMHC, October 2025)' : ''}. Estimates for your own planning, not lending, tax or investment advice. Confirm the tax bill, rent and insurance before you buy.`;
  wrap(note, m, y, W, { size: 7.5, color: MUTED });

  doc.setProperties({ title: sheetTitle(deal), creator: 'Squarely' });
  return doc.output('blob');
}

const sheetTitle = (deal) => {
  const name = clean(deal.name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 80);
  return `${name || 'Property'} - Squarely deal sheet`;
};

export const dealSheetFilename = (deal) => `${sheetTitle(deal)}.pdf`;
