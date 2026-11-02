// A plain report as a PDF: a title, a subtitle, then sections of label and
// value rows, with notes. Used for the materials list and the seller's
// pricing report. jsPDF loads on demand.

const PAGE = { w: 612, h: 792, m: 48 };
const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const RULE = [212, 212, 216];
const BRAND = [4, 120, 87];

const clean = (s) =>
  String(s ?? '')
    .replace(/⁠/g, '')
    .replace(/[−–]/g, '-')
    .replace(/×/g, 'x')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...');

/**
 * sections: [{ title, rows: [{ label, value, note }], text }]
 * Returns the PDF as a Blob.
 */
export async function buildReportPdf({ title, subtitle, sections, footer }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { m } = PAGE;
  const W = PAGE.w - m * 2;
  let y = m;

  const font = (size, bold = false, color = INK) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const room = (h) => {
    if (y + h > PAGE.h - m) {
      doc.addPage();
      y = m;
    }
  };
  const wrap = (s, width, size) => {
    font(size);
    return doc.splitTextToSize(clean(s), width);
  };

  font(9, true, BRAND);
  doc.text('SQUARELY', m, y);
  y += 22;
  font(18, true);
  for (const line of wrap(title, W, 18)) {
    doc.setFont('helvetica', 'bold');
    doc.text(line, m, y);
    y += 22;
  }
  if (subtitle) {
    const lines = wrap(subtitle, W, 10);
    font(10, false, MUTED);
    doc.text(lines, m, y);
    y += lines.length * 13 + 6;
  }

  for (const s of sections) {
    room(40);
    y += 10;
    font(11, true);
    doc.text(clean(s.title), m, y);
    y += 6;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.line(m, y, m + W, y);
    y += 14;
    if (s.text) {
      const lines = wrap(s.text, W, 9);
      room(lines.length * 12);
      font(9, false, MUTED);
      doc.text(lines, m, y);
      y += lines.length * 12 + 4;
    }
    for (const r of s.rows ?? []) {
      const labelLines = wrap(r.label, W * 0.68, 10);
      const noteLines = r.note ? wrap(r.note, W * 0.68, 8) : [];
      room(labelLines.length * 13 + noteLines.length * 10 + 6);
      font(10, Boolean(r.strong));
      doc.text(labelLines, m, y);
      font(10, true);
      doc.text(clean(r.value), m + W, y, { align: 'right' });
      y += labelLines.length * 13;
      if (noteLines.length) {
        font(8, false, MUTED);
        doc.text(noteLines, m, y - 2);
        y += noteLines.length * 10;
      }
      y += 4;
    }
  }

  if (footer) {
    const lines = wrap(footer, W, 8);
    room(lines.length * 10 + 16);
    y += 12;
    font(8, false, MUTED);
    doc.text(lines, m, y);
  }
  return doc.output('blob');
}
