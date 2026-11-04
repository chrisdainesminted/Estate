import { describe, expect, it } from 'vitest';
import { MARK, drawMarkPdf, hexRgb, markSvg } from './brand.js';

describe('the mark', () => {
  it('is two overlapping rounded squares, the back one lighter', () => {
    const svg = markSvg();
    expect(svg.match(/<rect/g)).toHaveLength(2);
    expect(svg).toContain('stroke-opacity="0.8"');
    expect(svg).toContain('#73FF6A');
    const [a, b] = MARK.squares;
    expect(b.x - a.x).toBeCloseTo(12.3);
    expect(b.x + b.size + MARK.stroke / 2).toBeCloseTo(48, 0);
  });
  it('draws in a PDF with the back square blended into the paper', () => {
    const calls = [];
    const doc = { setLineWidth: () => {}, setDrawColor: (...c) => calls.push(c), roundedRect: () => {} };
    drawMarkPdf(doc, 0, 0, 16);
    expect(calls[1]).toEqual(hexRgb('#73FF6A'));
    expect(calls[0]).toEqual([143, 255, 136]);
  });
});
