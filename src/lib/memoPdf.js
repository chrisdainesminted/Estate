// One-page deal memo as a real PDF (vector text, Letter size). jsPDF is
// loaded on demand so it never weighs down the app itself.

import { verdict } from './dscr.js';
import { money, percent, ratio } from './format.js';
import { UNIT_TYPES } from './presets.js';
import { STRATA, STRATA_HEIGHT } from './brand.js';

const PAGE = { w: 612, h: 792, m: 40 };
const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const RULE = [212, 212, 216];
const BRAND = [4, 120, 87];

// The PDF's built-in Helvetica covers WinAnsi only: swap the few
// typographic characters the app uses for ones it can draw, and drop the
// invisible word joiner money() puts after a sign.
const clean = (s) =>
  String(s)
    .replace(/\u2060/g, '')
    .replace(/−/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...');

export async function buildMemoPdf({ deal, a, rows, sale, refi, offer }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { m } = PAGE;
  const W = PAGE.w - m * 2;

  const text = (s, x, y, { size = 9, bold = false, color = INK, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(clean(s), x, y, { align });
  };
  const rule = (x1, y, x2, color = RULE, width = 0.6) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y, x2, y);
  };

  // Header: brand mark, deal name, terms, verdict.
  // The strata mark (src/lib/brand.js), its 48-unit square drawn 16 pt wide.
  doc.setFillColor(...BRAND);
  STRATA.forEach((s) => doc.rect(m + s.x / 3, m + s.y / 3, s.w / 3, STRATA_HEIGHT / 3, 'F'));
  text('Bedrock  ·  Deal memo', m + 22, m + 11.5, { size: 9, bold: true });
  text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), m + W, m + 11.5, { size: 8, color: MUTED, align: 'right' });

  let y = m + 44;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const name = doc.splitTextToSize(clean(deal.name), W - 150)[0];
  text(name, m, y, { size: 22, bold: true });

  const v = verdict(a);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const vw = doc.getTextWidth(clean(v.label)) + 18;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.roundedRect(m + W - vw, y - 13, vw, 18, 9, 9, 'S');
  text(v.label, m + W - vw / 2, y - 1, { size: 8.5, bold: true, align: 'center' });

  const type = UNIT_TYPES.find((u) => u.key === deal.unitType);
  const terms = [
    money(a.price),
    type?.key === 'multiplex' ? `${a.units}-unit multiplex` : type?.label,
    `${Number(deal.downPct)}% down`,
    `${Number(deal.rate)}% ${deal.termYears}-yr${a.interestOnly ? `, ${a.ioYears}-yr interest-only` : ''}`,
    `${money(a.grossRent)}/mo rent`,
  ].join('  ·  ');
  y += 16;
  text(terms, m, y, { size: 9, color: MUTED });
  if (deal.address) {
    y += 12;
    text(deal.address, m, y, { size: 9, color: MUTED });
  }
  y += 12;
  rule(m, y, m + W, INK, 1.4);

  // KPI boxes.
  y += 14;
  const boxes = [
    ['Lender DSCR', ratio(a.dscr), a.status.label],
    ['Net cash flow', `${money(a.netCashFlow, { signed: true })}/mo`, `${money(a.annualCashFlow, { signed: true })}/yr`],
    ['Cash-on-cash', percent(a.coc), `on ${money(a.cashInvested)}`],
    [
      `IRR, sold yr ${sale.year}`,
      Number.isFinite(sale.irr) ? percent(sale.irr, 1) : '—',
      `${Number.isFinite(sale.equityMultiple) ? sale.equityMultiple.toFixed(2) : '-'}× equity multiple`,
    ],
  ];
  const gap = 10;
  const bw = (W - gap * 3) / 4;
  boxes.forEach(([label, value, sub], i) => {
    const x = m + i * (bw + gap);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, bw, 58, 6, 6, 'S');
    text(label.toUpperCase(), x + 10, y + 15, { size: 6.8, color: MUTED });
    text(value, x + 10, y + 36, { size: 16, bold: true });
    text(sub, x + 10, y + 49, { size: 7.5, color: MUTED });
  });
  y += 58;

  if (offer && offer.price != null) {
    y += 16;
    const lim = offer.limits.find((l) => l.key === offer.binding);
    const line = !offer.feasible
      ? 'Max offer at your targets: no price works.'
      : Number.isFinite(offer.price)
        ? `Max offer at your targets: ${money(offer.price)} (${offer.vsAsking >= 0 ? `${money(offer.vsAsking)} above` : `${money(-offer.vsAsking)} below`} asking; set by ${lim.label}).`
        : 'Max offer at your targets: no limit.';
    text(line, m, y, { size: 9, bold: true, color: BRAND });
  }

  if (a.lenderApprovedButNegative) {
    y += 12;
    const msg = `Lender-approved but cash-flow negative: a ${ratio(a.dscr)} DSCR qualifies, yet the deal loses ${money(-a.netCashFlow)}/month after operating expenses. Break-even rent is ${money(a.breakevenRent / a.units)}/unit.`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(clean(msg), W - 20);
    const h = lines.length * 11 + 12;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.8);
    doc.roundedRect(m, y, W, h, 6, 6, 'S');
    doc.setTextColor(...INK);
    doc.text(lines, m + 10, y + 15);
    y += h;
  }

  // Two columns of labelled rows.
  const colW = (W - 30) / 2;
  const section = (x, top, title, items) => {
    text(title.toUpperCase(), x, top, { size: 7.5, bold: true });
    rule(x, top + 4, x + colW, INK, 1);
    let yy = top + 17;
    items.forEach(([label, value, strong]) => {
      if (strong) {
        rule(x, yy - 9, x + colW);
      }
      text(label, x, yy, { size: 9, bold: !!strong, color: strong ? INK : [82, 82, 91] });
      text(value, x + colW, yy, { size: 9, bold: !!strong, align: 'right' });
      yy += strong ? 16 : 14;
    });
    return yy;
  };

  y += 24;
  const leftA = section(m, y, 'What the lender sees', [
    ['Gross rent', money(a.grossRent)],
    [a.interestOnly ? 'Interest only' : 'Principal & interest', money(a.pi)],
    ['Taxes', money(a.taxes)],
    ['Insurance', money(a.insurance)],
    ['HOA', money(a.hoa)],
    ['PITIA', money(a.pitia), true],
    ['DSCR (rent ÷ PITIA)', ratio(a.dscr)],
  ]);
  const rightA = section(m + colW + 30, y, 'What hits your account', [
    ['Gross rent', money(a.grossRent)],
    ['PITIA', `-${money(a.pitia)}`],
    ['Management', `-${money(a.opex.management)}`],
    ['Maintenance', `-${money(a.opex.maintenance)}`],
    ['Vacancy', `-${money(a.opex.vacancy)}`],
    ['CapEx', `-${money(a.opex.capex)}`],
    ['Net cash flow', money(a.netCashFlow, { signed: true }), true],
  ]);

  y = Math.max(leftA, rightA) + 14;
  const leftB = section(m, y, 'Cash required', [
    ['Down payment', money(a.downPayment)],
    [a.landTransferTax ? 'Closing incl. land transfer tax' : 'Closing costs', money(a.closingCosts)],
    ['Rehab', money(a.rehab)],
    ['Cash invested', money(a.cashInvested), true],
    [`Reserves (${Number(deal.reserveMonths) || 0} mo PITIA)`, money(a.reserves)],
    ['Cash needed', money(a.cashNeeded), true],
    ...(refi
      ? [
          [`Cash back at refinance (yr ${refi.year})`, money(refi.cashOut, { signed: true })],
          ['Cash left in deal', money(refi.cashLeft), true],
        ]
      : []),
  ]);
  const rightB = section(m + colW + 30, y, `If sold in year ${sale.year}`, [
    ['Sale price', money(sale.salePrice)],
    [`Selling costs (${Number(deal.sellingCostPct) || 0}%)`, `-${money(sale.sellingCosts)}`],
    ['Loan payoff', `-${money(sale.loanPayoff)}`],
    ...(sale.prepayPenalty > 0 ? [['Prepayment penalty', `-${money(sale.prepayPenalty)}`]] : []),
    ['Net proceeds', money(sale.netProceeds), true],
    [`${sale.year} years of cash flow`, money(sale.totalCashFlow, { signed: true })],
    ...(sale.cashOut ? [['Cash from refinance', money(sale.cashOut, { signed: true })]] : []),
    ['Profit after cash invested', money(sale.profit, { signed: true }), true],
  ]);

  // Projection table.
  y = Math.max(leftB, rightB) + 14;
  text('PROJECTION', m, y, { size: 7.5, bold: true });
  rule(m, y + 4, m + W, INK, 1);
  const cols = ['Year', 'Cash flow', 'Principal paid', 'Value', 'Loan balance', 'Equity', 'Profit if sold'];
  const cw = W / cols.length;
  y += 17;
  cols.forEach((c, i) => text(c, i ? m + cw * (i + 1) : m, y, { size: 7.5, color: MUTED, align: i ? 'right' : 'left' }));
  [1, 3, 5, 7, 10]
    .map((yr) => rows[yr - 1])
    .filter(Boolean)
    .forEach((r) => {
      rule(m, y + 5, m + W);
      y += 16;
      const cells = [String(r.year), money(r.cashFlow, { signed: true }), money(r.cumPrincipal), money(r.value), money(r.balance), money(r.equity), money(r.profitIfSold, { signed: true })];
      cells.forEach((c, i) => text(c, i ? m + cw * (i + 1) : m, y, { size: 8.5, align: i ? 'right' : 'left' }));
    });

  // Assumptions footer.
  y += 22;
  rule(m, y - 10, m + W);
  const note = `Assumptions: OpEx ${Number(deal.mgmtPct)}% management, ${Number(deal.maintPct)}% maintenance, ${Number(deal.vacancyPct)}% vacancy, ${Number(deal.capexPct)}% CapEx; ${Number(deal.appreciationPct)}%/yr appreciation, ${Number(deal.rentGrowthPct)}%/yr rent growth, ${Number(deal.expenseGrowthPct)}%/yr tax and insurance growth. Estimates for personal analysis, not lending or investment advice. Generated by Bedrock.`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(clean(note), W), m, y);

  doc.setProperties({ title: memoTitle(deal), creator: 'Bedrock' });
  return doc.output('blob');
}

/** "230 Brodie Street N - Bedrock deal memo": the PDF's title and, so a re-save from the PDF viewer matches, its file name. */
const memoTitle = (deal) => {
  // Characters Windows and macOS won't take in a file name become spaces.
  const name = clean(deal.name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 80);
  return `${name || 'Deal'} - Bedrock deal memo`;
};

export const memoFilename = (deal) => `${memoTitle(deal)}.pdf`;
