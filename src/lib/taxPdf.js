// The landlord's year-end tax pack as a real PDF: rental income and expenses
// laid out by the lines of the CRA's form T776, rent received by unit and
// month, and every expense, ready for the landlord or their accountant.
// jsPDF loads only when someone asks for the pack.

import { T776, ownerSplit, yearSummary } from './landlord.js';
import { money } from './format.js';

const PAGE = { w: 612, h: 792, m: 48 };
const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const ACCENT = [4, 120, 87];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clean = (s) => String(s ?? '').replace(/⁠/g, '').replace(/−/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
const cad = (v) => clean(money(v, { cents: true }));

export async function buildTaxPdf({ year, payments, expenses, units, settings, owners = [], forOwner = '' }) {
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
  const s = yearSummary(payments, expenses, year, owners);
  const yr = String(year);
  const split = owners.length ? ownerSplit(s, owners) : [];
  const mine = split.find((o) => o.name === forOwner);
  const paidAlone = (e) => owners.some((o) => o.name === e.paidBy);

  text('Squarely · Rental income and expenses', m, y, { size: 9, bold: true, color: ACCENT });
  text(`Prepared ${new Date().toLocaleDateString('en-CA')}`, m + W, y, { size: 8.5, color: MUTED, align: 'right' });
  y += 26;
  text(`Tax year ${yr}`, m, y, { size: 22, bold: true });
  y += 18;
  if (mine) {
    text(`${mine.name}'s share: ${mine.share}% owner`, m, y, { size: 12, bold: true, color: ACCENT });
    y += 16;
  }
  const who = [settings.name, units.map((u) => [u.label, u.address].filter(Boolean).join(', ')).filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
  if (who) doc.splitTextToSize(clean(who), W).forEach((l) => (text(l, m, y, { color: MUTED }), (y += 12)));
  y += 10;

  const line = (code, label, amount, bold = false) => {
    room(16);
    text(code, m, y, { color: MUTED });
    text(label, m + 50, y, { bold });
    text(cad(amount), m + W, y, { align: 'right', bold });
    y += 15;
  };
  const small = (str) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.splitTextToSize(clean(str), W).forEach((l) => (room(10), doc.text(l, m, y), (y += 10)));
  };

  // The T776 summary for the whole property: what goes in Parts 3 and 4.
  const wholeProperty = () => {
    rule(y, true);
    y += 16;
    text(owners.length ? 'Form T776 summary: the whole property' : 'Form T776 summary', m, y, { size: 11, bold: true });
    y += 16;
    if (owners.length) {
      small('Co-owners enter the whole property\'s rent and expenses in Parts 3 and 4, then their own share of line 9369.');
      y += 6;
    }
    line('8141', 'Gross rents', s.gross, true);
    y += 4;
    s.lines.filter((l) => l.amount).forEach((l) => line(l.line, l.label, l.amount));
    if (!s.lines.some((l) => l.amount)) line('', 'No expenses logged', 0);
    rule(y - 8);
    y += 6;
    line('9949', 'Total expenses', s.total, true);
    line('9369', 'Net income (loss) before adjustments', s.net, true);
    y += 4;
    if (split.some((o) => o.personal)) small('Expenses one owner paid alone are not in these totals: each is on that owner\'s page.');
    small(
      owners.length
        ? 'Each owner claims their own capital cost allowance (depreciation on their share of the building and big improvements), and leaves out any personal-use share of expenses. Keep receipts for six years.'
        : 'Capital cost allowance (depreciation on the building and big improvements) and the personal-use share of any expenses are not included: work these out with the T776 guide or your accountant. Keep receipts for six years.',
    );
    y += 14;
  };

  // One co-owner's part: Part 1's ownership details, their share of line 9369, less what only they paid.
  const ownerPage = (o) => {
    rule(y, true);
    y += 16;
    text(`${o.name}: ${o.share}% owner`, m, y, { size: 11, bold: true });
    y += 15;
    const others = split.filter((x) => x.name !== o.name).map((x) => `${x.name} (${x.share}%)`).join(', ');
    small(`T776 Part 1: your percentage of ownership is ${o.share}%. Other co-owners: ${others}.`);
    y += 8;
    line('9369', 'Whole property: net income (loss) before adjustments', s.net);
    line('', `Your share of line 9369 (${o.share}%)`, o.net, true);
    if (o.personal) {
      line('', 'Minus: other expenses of the co-owner (you paid alone)', -o.personal);
      o.personalLines.forEach((l) => {
        room(13);
        text(l.line, m + 50, y, { size: 8.5, color: MUTED });
        text(l.label, m + 90, y, { size: 8.5, color: MUTED });
        text(cad(l.amount), m + W - 90, y, { size: 8.5, color: MUTED, align: 'right' });
        y += 12;
      });
    }
    rule(y - 8);
    y += 6;
    line('', 'Your net income (loss) before capital cost allowance', o.after, true);
    y += 6;
    small('Your share of each line, if your tax software asks for it:');
    y += 2;
    const ref = (code, label, amount) => {
      room(13);
      text(code, m, y, { size: 8.5, color: MUTED });
      text(label, m + 50, y, { size: 8.5 });
      text(cad(amount), m + W, y, { size: 8.5, align: 'right' });
      y += 12;
    };
    ref('8141', 'Gross rents', o.gross);
    o.lines.filter((l) => l.amount).forEach((l) => ref(l.line, l.label, l.amount));
    ref('9949', 'Total expenses', o.total);
    y += 14;
  };

  if (mine) {
    ownerPage(mine);
    wholeProperty();
  } else {
    wholeProperty();
    split.forEach((o) => {
      doc.addPage();
      y = m;
      text(`Tax year ${yr} · ${o.name}`, m, y, { size: 9, bold: true, color: ACCENT });
      y += 22;
      ownerPage(o);
    });
    if (split.length) {
      doc.addPage();
      y = m;
    }
  }

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
      text(doc.splitTextToSize(clean([e.vendor, e.note, e.unitId ? unitName(e.unitId) : '', paidAlone(e) ? `paid by ${e.paidBy} alone` : ''].filter(Boolean).join(' · ') || T776.find((c) => c.key === e.category)?.label || ''), W - 200)[0] || '', m + 110, y, { size: 8.5 });
      text(cad(e.amount), m + W, y, { size: 8.5, align: 'right' });
      y += 12;
    });

  doc.setProperties({ title: `Rental income and expenses ${yr} - Squarely`, creator: 'Squarely' });
  return doc.output('blob');
}
