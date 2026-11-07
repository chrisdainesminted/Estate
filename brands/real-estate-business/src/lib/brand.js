// The Homeward mark: a filled rounded square in the brand brown, on a
// 48-unit square. Logo.jsx, the PDFs,
// public/favicon.svg and the app icons all draw this geometry, in COLOR.
// (This file replaces src/lib/brand.js on the Homeward copy of the site;
// see scripts/rebrand.mjs.)
export const MARK = {
  color: '#7A5A3C',
  outer: { x: 2, y: 2, size: 44, r: 12 },
};

/** The whole mark as SVG elements (inside a 0 0 48 48 viewBox). */
export function markSvg(color = MARK.color) {
  const o = MARK.outer;
  return `<rect x="${o.x}" y="${o.y}" width="${o.size}" height="${o.size}" rx="${o.r}" fill="${color}"/>`;
}

/** "#7A5A3C" as [122, 90, 60]. */
export const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Draw the mark in a jsPDF document at (x, y), `size` points wide, on a background of `bg`. */
export function drawMarkPdf(doc, x, y, size, bg = [255, 255, 255]) {
  const o = MARK.outer;
  const k = size / 48;
  void bg;
  doc.setFillColor(...hexRgb(MARK.color));
  doc.roundedRect(x + o.x * k, y + o.y * k, o.size * k, o.size * k, o.r * k, o.r * k, 'F');
}
