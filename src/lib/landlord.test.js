import { describe, expect, it } from 'vitest';
import { applicationReplies, nextIncrease, rentReminder, rentStatus, yearCsv, yearSummary } from './landlord.js';
import { TENANCY, rulesFor } from './tenancyRules.js';
import { PROVINCES } from './canada.js';

const unit = { id: 'u1', label: 'Upper', rent: 1800, dueDay: 1, tenantName: 'Sam Lee' };

describe('rent status', () => {
  it('is due on or before the due day, late after it, and paid once it’s in', () => {
    expect(rentStatus(unit, [], '2026-11-01').state).toBe('due');
    expect(rentStatus(unit, [], '2026-11-03').state).toBe('late');
    const part = [{ unitId: 'u1', month: '2026-11', amount: 1000 }];
    expect(rentStatus(unit, part, '2026-11-03')).toMatchObject({ state: 'partial', owing: 800 });
    expect(rentStatus(unit, [...part, { unitId: 'u1', month: '2026-11', amount: 800 }], '2026-11-03').state).toBe('paid');
    expect(rentStatus({ ...unit, rent: 0 }, [], '2026-11-03').state).toBe('none');
  });

  it('writes a reminder that says what’s owing', () => {
    const r = rentReminder({ unit, status: rentStatus(unit, [], '2026-11-05'), settings: { name: 'Chris' } });
    expect(r.body).toMatch(/Hi Sam/);
    expect(r.body).toMatch(/\$1,800 was due on the 1st/);
  });
});

describe('year summary', () => {
  it('adds rent and expenses by T776 line for the year only', () => {
    const pays = [
      { unitId: 'u1', month: '2026-01', amount: 1800 },
      { unitId: 'u1', month: '2025-12', amount: 1800 },
    ];
    const exp = [
      { date: '2026-03-02', amount: 250, category: 'repairs' },
      { date: '2026-04-01', amount: 1200, category: 'insurance' },
      { date: '2025-04-01', amount: 999, category: 'insurance' },
    ];
    const y = yearSummary(pays, exp, 2026);
    expect(y.gross).toBe(1800);
    expect(y.total).toBe(1450);
    expect(y.net).toBe(350);
    expect(y.lines.find((l) => l.key === 'repairs').line).toBe('8960');
    const csv = yearCsv(y, pays, exp, [unit]);
    expect(csv).toMatch(/8141,Gross rents,1800.00/);
    expect(csv).toMatch(/8960,Repairs and maintenance,250.00/);
  });
});

describe('rent increases', () => {
  it('waits 12 months from the last increase and gives the notice the province asks', () => {
    const n = nextIncrease({ ...unit, lastIncrease: '2026-03-01' }, 'ON', '2026-11-02');
    expect(n.date).toBe('2027-03-01');
    expect(n.noticeBy).toBe('2026-12-01');
    expect(n.newRent).toBe(Math.floor(1800 * 1.021));
    const soon = nextIncrease({ ...unit, lastIncrease: '2025-01-01' }, 'BC', '2026-11-02');
    expect(soon.date).toBe('2027-02-02'); // the notice period sets it
    expect(nextIncrease(unit, 'AB', '2026-11-02').newRent).toBeNull(); // no cap
  });

  it('has rules for every province and territory', () => {
    for (const p of PROVINCES) expect(TENANCY[p.code]?.noticeNote).toBeTruthy();
    expect(rulesFor('XX')).toBe(TENANCY.ON);
  });
});

describe('replies', () => {
  it('fills in the applicant, the listing and the time', () => {
    const r = applicationReplies({
      app: { name: 'Ana Silva' },
      listing: { title: 'Upper 2-bed', address: '12 Main St', rent: 1800 },
      slot: { start: '2026-11-04T22:00:00.000Z' },
      settings: { name: 'Chris' },
      statusLink: 'https://x/rent/#w=1&s=2',
    });
    expect(r.map((x) => x.key)).toEqual(['confirm', 'times', 'approve', 'decline']);
    expect(r[0].body).toMatch(/Hi Ana/);
    expect(r[0].body).toMatch(/12 Main St/);
    expect(r[0].body).toMatch(/https:\/\/x\/rent/);
    expect(r[2].body).toMatch(/\$1,800 a month/);
    expect(r[0].note).not.toMatch(/\.\.$/);
  });
});
