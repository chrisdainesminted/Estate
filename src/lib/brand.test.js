import { describe, expect, it } from 'vitest';
import { MARK, bracketPath, bracketPoints, markSvg } from './brand.js';

describe('the mark', () => {
  it('rounds each bracket’s corner', () => {
    expect(bracketPath(MARK.brackets[0])).toBe('M25.5 5.2 L6.5 5.2 Q4.1 5.2 4.1 7.6 L4.1 27');
    const pts = bracketPoints(MARK.brackets[0]);
    expect(pts[0]).toEqual([25.5, 5.2]);
    expect(pts.at(-1)).toEqual([4.1, 27]);
    expect(pts.length).toBe(11);
  });
  it('draws in the brand green', () => {
    expect(markSvg()).toContain('#00E198');
    expect(markSvg().match(/<path/g)).toHaveLength(2);
  });
});
