import { describe, expect, it } from 'vitest';
import { valueEstimate } from './valuation.js';

const today = new Date('2026-11-14T12:00:00');
const comps = { estimate: 640000, low: 560000, high: 720000, count: 12, byBeds: true };

describe('valueEstimate', () => {
  it('leads with a recent city assessment, high confidence, with the asking-price range', () => {
    const v = valueEstimate({ assessment: { value: 729000, valuedAt: '2025-07-01', source: 'city' }, comps, province: 'AB', today });
    expect(v).toMatchObject({ estimate: 729000, low: 560000, high: 720000, confidence: 'high' });
    expect(v.basis[0]).toContain('July 1, 2025');
  });
  it('is less sure of an assessment you typed, or an old one', () => {
    expect(valueEstimate({ assessment: { value: 500000, valuedAt: '2025-07-01', source: 'you' }, comps, province: 'BC', today }).confidence).toBe('medium');
    const old = valueEstimate({ assessment: { value: 500000, valuedAt: '2022-07-01', source: 'city' }, comps, province: 'AB', today });
    expect(old.confidence).toBe('low');
    expect(old.notes[0]).toContain('4 years old');
  });
  it('never uses Ontario’s 2016 assessments as today’s value', () => {
    const v = valueEstimate({ assessment: { value: 300000, valuedAt: '2016-01-01', source: 'you' }, comps, province: 'ON', today });
    expect(v.estimate).toBe(640000);
    expect(v.notes[0]).toContain('2016');
  });
  it('falls back to asking prices, and says how rough that is', () => {
    expect(valueEstimate({ comps, province: 'ON', today })).toMatchObject({ estimate: 640000, confidence: 'medium' });
    expect(valueEstimate({ comps: { ...comps, count: 4 }, province: 'ON', today }).confidence).toBe('low');
    expect(valueEstimate({ comps: { ...comps, byBeds: false }, province: 'ON', today }).confidence).toBe('low');
  });
  it('has nothing to say with no data', () => {
    expect(valueEstimate({ province: 'ON', today })).toBeNull();
  });
});
