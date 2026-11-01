import { describe, expect, it } from 'vitest';
import { applicationReplies, increaseNotice, leaseSheet, nextIncrease, ownerSplit, ownersOf, receiptMessage, rentReference, rentReminder, rentStatus, sharesTotal, splitCents, yearCsv, yearSummary } from './landlord.js';
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

describe('e-Transfer, increases and leases', () => {
  const unit = { id: 'u1', label: 'Upper', address: '12 Main St', rent: 2000, dueDay: 1, tenantName: 'Alex Lee', leaseStart: '2026-01-01', deposit: 2000 };
  const settings = { name: 'Sam', email: 'sam@x.ca', etransferEmail: 'rent@x.ca' };

  it('builds an e-Transfer message from the unit and month', () => {
    expect(rentReference(unit, '2026-11')).toBe('UPPER-2026-11');
    expect(rentReference({ label: 'Basement suite #2' }, '2026-12')).toBe('BASEMENT-SUITE-2-2026-12');
    expect(rentReference({}, '2026-12')).toBe('RENT-2026-12');
  });

  it('writes a receipt and an increase notice that names the form', () => {
    expect(receiptMessage({ unit, payment: { month: '2026-11', amount: 2000, paidOn: '2026-11-01', method: 'e-Transfer' }, settings }).body).toMatch(/received \$2,000 on .* for rent for November 2026/);
    const n = increaseNotice({ unit, settings, province: 'ON', newRent: 2042, effective: '2027-01-01' });
    expect(n.body).toMatch(/from \$2,000 to \$2,042/);
    expect(n.body).toMatch(/Ontario’s guideline of 2.1%/);
    expect(n.body).toMatch(/official notice form/);
  });

  it('lays out the lease details with the province’s form and deposit rule', () => {
    const l = leaseSheet({ unit, settings, province: 'ON' });
    expect(l.form).toMatch(/Standard Lease/);
    expect(l.text).toMatch(/Rent: \$2,000 a month, due on day 1/);
    expect(l.text).toMatch(/Interac e-Transfer to rent@x.ca/);
  });
});

describe('co-owners', () => {
  const pays = [
    { unitId: 'u1', month: '2026-01', amount: 1500 },
    { unitId: 'u1', month: '2026-02', amount: 1500 },
  ];
  const exp = [
    { date: '2026-03-01', category: 'propertyTax', amount: 3200 },
    { date: '2026-04-10', category: 'repairs', amount: 100.01 },
    { date: '2026-05-01', category: 'interest', amount: 900, paidBy: 'Ben' }, // Ben's own loan for his share
  ];
  const owners = ownersOf({ owners: [{ name: 'Ana', share: 50 }, { name: 'Ben', share: 50 }] });

  it('needs two or more named owners with a share', () => {
    expect(ownersOf({})).toEqual([]);
    expect(ownersOf({ owners: [{ name: 'Ana', share: 100 }] })).toEqual([]);
    expect(ownersOf({ owners: [{ name: 'Ana', share: 60 }, { name: '', share: 40 }] })).toEqual([]);
    expect(owners.map((o) => o.name)).toEqual(['Ana', 'Ben']);
    expect(sharesTotal([{ share: 33.33 }, { share: 33.33 }, { share: 33.34 }])).toBe(100);
  });

  it('splits to the cent, with the parts adding back to the whole', () => {
    expect(splitCents(100.01, [50, 50])).toEqual([50.01, 50]);
    expect(splitCents(100, [33.33, 33.33, 33.34]).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(splitCents(-200, [60, 40])).toEqual([-120, -80]);
    expect(splitCents(10, [0, 0])).toEqual([0, 0]);
  });

  it('keeps an expense one owner paid alone out of the shared lines', () => {
    const s = yearSummary(pays, exp, 2026, owners);
    expect(s.total).toBeCloseTo(3300.01);
    expect(s.personal.Ben.total).toBe(900);
    expect(s.personal.Ana.total).toBe(0);
    // Without co-owners set, it's an ordinary shared expense.
    expect(yearSummary(pays, exp, 2026).total).toBeCloseTo(4200.01);
  });

  it('gives each owner their share of 9369, less what only they paid', () => {
    const s = yearSummary(pays, exp, 2026, owners);
    const [ana, ben] = ownerSplit(s, owners);
    expect(ana.gross).toBe(1500);
    expect(ana.total + ben.total).toBeCloseTo(s.total, 10);
    expect(ana.net + ben.net).toBeCloseTo(s.net, 10);
    expect(ana.after).toBe(ana.net);
    expect(ben.after).toBeCloseTo(ben.net - 900, 10);
    expect(ben.personalLines.map((l) => l.line)).toEqual(['8710']);
  });

  it('adds each owner to the spreadsheet and marks who paid', () => {
    const s = yearSummary(pays, exp, 2026, owners);
    const csv = yearCsv(s, pays, exp, [], owners);
    expect(csv).toContain('Each co-owner');
    expect(csv).toContain('Ben,50%');
    expect(csv).toMatch(/2026-05-01,8710,900\.00,,Ben/);
  });
});

describe('a co-owner’s share of line 9369', () => {
  it('is the whole property’s net times their share, to the cent', () => {
    const owners = [{ name: 'A', share: 50 }, { name: 'B', share: 50 }];
    const s = yearSummary([{ month: '2026-01', amount: 27500 }], [{ date: '2026-02-10', category: 'insurance', amount: 1820.55 }, { date: '2026-06-12', category: 'repairs', amount: 640.25 }, { date: '2026-03-01', category: 'propertyTax', amount: 4950 }], 2026, owners);
    const [a, b] = ownerSplit(s, owners);
    expect(a.net).toBe(10044.6);
    expect(b.net).toBe(10044.6);
    expect(a.gross - a.total).toBeCloseTo(a.net, 10);
  });
});
