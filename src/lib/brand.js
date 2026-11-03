// The Squarely mark: two corner brackets framing a home square, on a 48-unit
// square. Brackets are lines of width STROKE with round ends; their outer
// corners are rounded (the centre line turns on a CORNER radius, so the
// outside curve is CORNER + STROKE/2 and the inside stays crisp). The square
// has soft corners. Logo.jsx, the PDFs, public/favicon.svg and the app icons
// (scripts/brand-icons.cjs) all draw this geometry, in COLOR.
export const MARK = {
  color: '#00E198',
  stroke: 8,
  corner: 2.4,
  brackets: [
    [[25.5, 5.2], [4.1, 5.2], [4.1, 27]],
    [[22.9, 43], [43.9, 43], [43.9, 22.7]],
  ],
  square: { x: 15.4, y: 15.8, size: 17.5, r: 3.5 },
};

const toward = ([x, y], [tx, ty], d) => {
  const len = Math.hypot(tx - x, ty - y) || 1;
  return [x + ((tx - x) * d) / len, y + ((ty - y) * d) / len];
};
const fmt = (n) => Math.round(n * 100) / 100;

/** A bracket as an SVG path, its corner rounded: "M25.5 5.2 L6.5 5.2 Q4.1 5.2 4.1 7.6 L4.1 27". */
export function bracketPath([a, c, b], r = MARK.corner) {
  const p1 = toward(c, a, r);
  const p2 = toward(c, b, r);
  return `M${fmt(a[0])} ${fmt(a[1])} L${fmt(p1[0])} ${fmt(p1[1])} Q${fmt(c[0])} ${fmt(c[1])} ${fmt(p2[0])} ${fmt(p2[1])} L${fmt(b[0])} ${fmt(b[1])}`;
}

/** The same bracket as points, its rounded corner sampled, for drawing with straight lines (PDFs). */
export function bracketPoints([a, c, b], r = MARK.corner, steps = 8) {
  const p1 = toward(c, a, r);
  const p2 = toward(c, b, r);
  const curve = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [u * u * p1[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * c[1] + t * t * p2[1]];
  });
  return [a, ...curve, b];
}

/** The whole mark as SVG elements (inside a 0 0 48 48 viewBox), in one colour. */
export function markSvg(fill = MARK.color) {
  const { stroke, brackets, square: q } = MARK;
  return `${brackets.map((pts) => `<path d="${bracketPath(pts)}" fill="none" stroke="${fill}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}<rect x="${q.x}" y="${q.y}" width="${q.size}" height="${q.size}" rx="${q.r}" fill="${fill}"/>`;
}
