import { describe, expect, it } from 'vitest';
import { freshness } from './freshness.js';

describe('freshness', () => {
  const dates = { rateChecked: '2026-11-03', rulesChecked: '2026-10-29' };
  it('says when the rate and rules were checked', () => {
    const f = freshness(new Date('2026-11-14T12:00:00'), dates);
    expect(f.text).toBe('Rates checked Nov 3, 2026 · lending rules Oct 29, 2026');
    expect(f.stale).toBe(false);
  });
  it('warns once the rate is over 45 days old, and the rules over 180', () => {
    expect(freshness(new Date('2026-12-31T12:00:00'), dates).warning).toBe('Rates may have changed since then: a lender or broker has today’s.');
    expect(freshness(new Date('2027-06-01T12:00:00'), dates).warning).toBe('Rates and lending rules may have changed since then: a lender or broker has today’s.');
  });
});
