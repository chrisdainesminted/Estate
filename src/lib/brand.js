// The Squarely mark: two rounded corner brackets framing a home square, on a
// 48-unit square. Brackets are lines of width STROKE with round ends and
// joins; the square has soft corners. Logo.jsx, the PDF memo,
// public/favicon.svg and the app icons (scripts/brand-icons.cjs) all draw
// this geometry.
export const MARK = {
  stroke: 6,
  brackets: [
    [[27, 3], [3, 3], [3, 27]],
    [[21, 45], [45, 45], [45, 21]],
  ],
  square: { x: 15, y: 15, size: 18, r: 4 },
};

/** A bracket as an SVG path: "M27 3 L3 3 L3 27". */
export const bracketPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
