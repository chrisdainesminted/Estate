// The Squarely mark: two overlapping rounded squares, drawn as outlines on a
// 48-unit square. The back square sits up and to the left at BACK_OPACITY of
// the green; the front square, down and to the right, is drawn over it in
// full. Logo.jsx, the PDFs, public/favicon.svg, the 404 page and the app
// icons (scripts/brand-icons.cjs) all draw this geometry, in COLOR.
export const MARK = {
  color: '#73FF6A',
  backOpacity: 0.8,
  stroke: 4.7,
  // Each square's outline is centred on these edges: x, y, size, corner radius.
  squares: [
    { x: 2.35, y: 2.35, size: 31, r: 2.6 },
    { x: 14.65, y: 14.65, size: 31, r: 2.6 },
  ],
};

/** The whole mark as SVG elements (inside a 0 0 48 48 viewBox). */
export function markSvg(color = MARK.color) {
  const { stroke, squares, backOpacity } = MARK;
  return squares
    .map(
      (q, i) =>
        `<rect x="${q.x}" y="${q.y}" width="${q.size}" height="${q.size}" rx="${q.r}" fill="none" stroke="${color}" stroke-width="${stroke}"${i === 0 ? ` stroke-opacity="${backOpacity}"` : ''}/>`,
    )
    .join('');
}

/** "#73FF6A" as [115, 255, 106]. */
export const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * Draw the mark in a jsPDF document at (x, y), `size` points wide, on a
 * background of `bg` (the back square's lighter green is blended with it,
 * since PDFs here are drawn without transparency).
 */
export function drawMarkPdf(doc, x, y, size, bg = [255, 255, 255]) {
  const { stroke, squares, backOpacity } = MARK;
  const k = size / 48;
  const front = hexRgb(MARK.color);
  const back = front.map((c, i) => Math.round(c * backOpacity + bg[i] * (1 - backOpacity)));
  doc.setLineWidth(stroke * k);
  squares.forEach((q, i) => {
    doc.setDrawColor(...(i === 0 ? back : front));
    doc.roundedRect(x + q.x * k, y + q.y * k, q.size * k, q.size * k, q.r * k, q.r * k, 'S');
  });
}
