// The North Key Realty mark: a brown rounded square holding a cream key
// that points north (its bow below, its shaft up to an arrowhead), on a
// 48-unit square. Logo.jsx, the PDFs,
// public/favicon.svg and the app icons all draw this geometry, in COLOR.
// (This file replaces src/lib/brand.js on the North Key Realty copy of the site;
// see scripts/rebrand.mjs.)
export const MARK = {
  color: '#7A5A3C',
  outer: { x: 2, y: 2, size: 44, r: 12 },
  ink: '#FAF6EF',
  stroke: 3.6,
  // The key, in the square: its round bow, the shaft, and the arrowhead pointing north.
  bow: { cx: 24, cy: 32.5, r: 5 },
  shaft: [24, 27.5, 24, 12.5],
  head: [
    [17.5, 19],
    [24, 12.5],
    [30.5, 19],
  ],
};

/** The whole mark as SVG elements (inside a 0 0 48 48 viewBox). */
export function markSvg(color = MARK.color) {
  const o = MARK.outer;
  const { bow, shaft, head, ink, stroke } = MARK;
  const line = `fill="none" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
  return (
    `<rect x="${o.x}" y="${o.y}" width="${o.size}" height="${o.size}" rx="${o.r}" fill="${color}"/>` +
    `<circle cx="${bow.cx}" cy="${bow.cy}" r="${bow.r}" ${line}/>` +
    `<path d="M${shaft[0]} ${shaft[1]}V${shaft[3]}M${head.map((p) => p.join(' ')).join('L')}" ${line}/>`
  );
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
  const { bow, shaft, head } = MARK;
  doc.setDrawColor(...hexRgb(MARK.ink));
  doc.setLineWidth(MARK.stroke * k);
  doc.circle(x + bow.cx * k, y + bow.cy * k, bow.r * k, 'S');
  doc.line(x + shaft[0] * k, y + shaft[1] * k, x + shaft[2] * k, y + shaft[3] * k);
  for (let i = 1; i < head.length; i++) doc.line(x + head[i - 1][0] * k, y + head[i - 1][1] * k, x + head[i][0] * k, y + head[i][1] * k);
}
