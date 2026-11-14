import { describe, expect, it } from 'vitest';
import { dealGrade } from './grade.js';

describe('dealGrade', () => {
  it('gives an S to a deal that pays well on every count', () => {
    expect(dealGrade({ price: 300000, units: 1, netCashFlow: 600, dscr: 1.8, coc: 0.15 })).toMatchObject({ rank: 'S', score: 100 });
  });
  it('gives an F to a deal that loses money', () => {
    expect(dealGrade({ price: 300000, units: 1, netCashFlow: -900, dscr: 0.7, coc: -0.1 })).toMatchObject({ rank: 'F', score: 0 });
  });
  it('scores cash flow per door, not for the whole building', () => {
    const one = dealGrade({ price: 1, units: 1, netCashFlow: 200, dscr: 1.15, coc: 0.04 });
    const four = dealGrade({ price: 1, units: 4, netCashFlow: 200, dscr: 1.15, coc: 0.04 });
    expect(one.score).toBeGreaterThan(four.score);
  });
  it('lands a break-even deal in the middle', () => {
    expect(dealGrade({ price: 1, units: 1, netCashFlow: 0, dscr: 1.15, coc: 0.04 })).toMatchObject({ rank: 'C', score: 50 });
  });
  it('has nothing to grade without a price', () => {
    expect(dealGrade({ price: 0 })).toBeNull();
  });
});
