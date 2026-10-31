// The landlord's year-end tax pack as a real PDF: rental income and expenses
// laid out by the lines of the CRA's form T776, rent received by unit and
// month, and every expense, ready for the landlord or their accountant.
// jsPDF loads only when someone asks for the pack.

import { T776, yearSummary } from './landlord.js';
import { money } from './format.js';

const PAGE = { w: 612, h: 792, m: 48 };
const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const ACCENT = [4, 120, 87];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clean = (s) => String(s ?? '').replace(/⁠/g, '').replace(/−/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
const cad = (v) => clean(money(v, { cents: true }));

export async function buildTaxPdf({ year, payments, expenses, units, settings }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { m } = PAGE;
  const W = PAGE.w - m * 2;
  let y = m;
  const text = (s, x, yy, { size = 9.5, bold = false, color = INK, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(clean(s), x, yy, { align });
  };
  const rule = (yy, strong = false) => {
    doc.setDrawColor(...(strong ? INK : [212, 212, 216]));
    doc.setLineWidth(strong ? 1 : 0.5);
    doc.line(m, yy, m + W, yy);
  };
  const room = (h) => {
    if (y + h > PAGE.h - m) {
      doc.addPage();
      y = m;
    }
  };
  const unitName = (id) => units.find((u) => u.id === id)?.label || 'Whole property';
  const s = yearSummary(payments, expenses, year);
  const yr = String(year);

  text('Bedrock · Rental income and expenses', m, y, { size: 9, bold: true, color: ACCENT });
  text(`Prepared ${new Date().toLocaleDateString('en-CA')}`, m + W, y, { size: 8.5, color: MUTED, align: 'right' });
  y += 26;
  text(`Tax year ${yr}`, m, y, { size: 22, bold: true });
  y += 18;
  const who = [settings.name, units.map((u) => [u.label, u.address].filter(Boolean).join(', ')).filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
  if (who) doc.splitTextToSize(clean(who), W).forEach((l) => (text(l, m, y, { color: MUTED }), (y += 12)));
  y += 10;

  // The T776 summary.
  rule(y, true);
  y += 16;
  text('Form T776 summary', m, y, { size: 11, bold: true });
  y += 16;
  const line = (code, label, amount, bold = false) => {
    room(16);
    text(code, m, y, { color: MUTED });
    text(label, m + 50, y, { bold });
    text(cad(amount), m + W, y, { align: 'right', bold });
    y += 15;
  };
  line('8141', 'Gross rents', s.gross, true);
  y += 4;
  s.lines.filter((l) => l.amount).forEach((l) => line(l.line, l.label, l.amount));
  if (!s.lines.some((l) => l.amount)) line('', 'No expenses logged', 0);
  rule(y - 8);
  y += 6;
  line('', 'Total expenses', s.total, true);
  line('9369', 'Net income (loss) before capital cost allowance', s.net, true);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const note =
    'Capital cost allowance (depreciation on the building and big improvements), the personal-use share of any expenses, and co-owner splits are not included: work these out with the T776 guide or your accountant. Keep receipts for six years.';
  doc.splitTextToSize(note, W).forEach((l) => (doc.text(l, m, y), (y += 10)));
  y += 14;

  // Rent by unit and month.
  room(60);
  rule(y, true);
  y += 16;
  text('Rent received', m, y, { size: 11, bold: true });
  y += 16;
  const rentRows = payments.filter((p) => String(p.month).startsWith(yr)).sort((a, b) => (a.month < b.month ? -1 : 1));
  const byUnit = new Map();
  rentRows.forEach((p) => byUnit.set(p.unitId, (byUnit.get(p.unitId) ?? 0) + num(p.amount)));
  [...byUnit].forEach(([id, total]) => {
    room(15);
    text(unitName(id), m, y);
    text(cad(total), m + W, y, { align: 'right' });
    y += 14;
  });
  y += 6;
  text('Month', m, y, { size: 8, color: MUTED });
  text('Unit', m + 90, y, { size: 8, color: MUTED });
  text('Received', m + 300, y, { size: 8, color: MUTED });
  text('Amount', m + W, y, { size: 8, color: MUTED, align: 'right' });
  y += 12;
  rentRows.forEach((p) => {
    room(13);
    text(p.month, m, y, { size: 8.5 });
    text(unitName(p.unitId), m + 90, y, { size: 8.5 });
    text(p.paidOn || '', m + 300, y, { size: 8.5 });
    text(cad(p.amount), m + W, y, { size: 8.5, align: 'right' });
    y += 12;
  });
  y += 14;

  // Every expense.
  room(60);
  rule(y, true);
  y += 16;
  text('Expenses', m, y, { size: 11, bold: true });
  y += 16;
  text('Date', m, y, { size: 8, color: MUTED });
  text('Line', m + 70, y, { size: 8, color: MUTED });
  text('Paid to / note', m + 110, y, { size: 8, color: MUTED });
  text('Amount', m + W, y, { size: 8, color: MUTED, align: 'right' });
  y += 12;
  expenses
    .filter((e) => String(e.date).startsWith(yr))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((e) => {
      room(13);
      text(e.date, m, y, { size: 8.5 });
      text(T776.find((c) => c.key === e.category)?.line || '', m + 70, y, { size: 8.5 });
      text(doc.splitTextToSize(clean([e.vendor, e.note, e.unitId ? unitName(e.unitId) : ''].filter(Boolean).join(' · ') || T776.find((c) => c.key === e.category)?.label || ''), W - 200)[0] || '', m + 110, y, { size: 8.5 });
      text(cad(e.amount), m + W, y, { size: 8.5, align: 'right' });
      y += 12;
    });

  doc.setProperties({ title: `Rental income and expenses ${yr} - Bedrock`, creator: 'Bedrock' });
  return doc.output('blob');
}
