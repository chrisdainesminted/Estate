import { describe, expect, it } from 'vitest';
import { taxReminder, assetCca, ccaYear, firstYearFactor, applicationReplies, increaseNotice, leaseSheet, nextIncrease, ownerSplit, ownersOf, receiptMessage, rentReference, rentReminder, rentStatus, sharesTotal, splitCents, yearCsv, yearSummary } from './landlord.js';
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

describe('capital cost allowance', () => {
  it('uses the first-year rule for when the asset went into use', () => {
    expect(firstYearFactor('2017-06-01')).toBe(0.5);
    expect(firstYearFactor('2021-03-01')).toBe(1.5);
    expect(firstYearFactor('2025-03-01')).toBe(1);
    expect(firstYearFactor('2028-03-01')).toBe(0.5);
  });

  it('declines from the cost each year at the class rate', () => {
    const building = { ccaClass: '1', cost: 300000, available: '2025-05-01' };
    expect(assetCca(building, 2024).max).toBe(0);
    expect(assetCca(building, 2025)).toEqual({ rate: 0.04, uccStart: 300000, max: 12000, uccEnd: 288000 });
    expect(assetCca(building, 2026)).toEqual({ rate: 0.04, uccStart: 288000, max: 11520, uccEnd: 276480 });
    // Old rules: half the rate in the first year.
    expect(assetCca({ ccaClass: '8', cost: 2000, available: '2016-01-10' }, 2016).max).toBe(200);
  });

  it('carries on from a UCC taken from a return when less was claimed', () => {
    const a = { ccaClass: '1', cost: 300000, available: '2025-05-01', uccYear: 2026, ucc: 300000 };
    expect(assetCca(a, 2026)).toEqual({ rate: 0.04, uccStart: 300000, max: 12000, uccEnd: 288000 });
    expect(assetCca(a, 2025).max).toBe(12000); // the year before still counts from the cost
  });

  it('never lets CCA create or increase a rental loss', () => {
    const assets = [{ ccaClass: '1', cost: 300000, available: '2025-05-01' }];
    const profit = ccaYear(assets, 2026, { net: 20000 });
    expect(profit).toMatchObject({ max: 11520, claim: 11520, net: 8480, limited: false });
    const thin = ccaYear(assets, 2026, { net: 5000 });
    expect(thin).toMatchObject({ claim: 5000, net: 0, limited: true });
    expect(ccaYear(assets, 2026, { net: -800 })).toMatchObject({ claim: 0, net: -800 });
  });

  it('gives each co-owner CCA on their share, limited by their own net', () => {
    const owners = [{ name: 'A', share: 50 }, { name: 'B', share: 50 }];
    const summary = yearSummary([{ month: '2026-01', amount: 20000 }], [{ date: '2026-02-01', category: 'interest', amount: 8000, paidBy: 'B' }], 2026, owners);
    const c = ccaYear([{ ccaClass: '1', cost: 300000, available: '2025-05-01' }], 2026, summary, owners);
    expect(c.owners[0]).toMatchObject({ max: 5760, claim: 5760, net: 4240 });
    expect(c.owners[1]).toMatchObject({ max: 5760, claim: 2000, net: 0, limited: true }); // 10,000 share less 8,000 paid alone
  });
});

describe('spreadsheet safety', () => {
  it('never lets a cell start a formula, but keeps negative numbers', () => {
    const csv = yearCsv(yearSummary([], [{ date: '2026-01-05', category: 'repairs', amount: 10, vendor: '=HYPERLINK("http://x")' }], 2026), [], [{ date: '2026-01-05', category: 'repairs', amount: 10, vendor: '=HYPERLINK("http://x")' }], []);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain('-10.00');
  });
});

describe('the February tax reminder', () => {
  it('sums up the year and lists what needs attention', () => {
    const r = taxReminder({
      settings: {},
      payments: [{ month: '2026-01', amount: 2000 }],
      expenses: [
        { date: '2026-03-01', amount: 500, category: 'repairs', vendor: 'Plumber' },
        { date: '2026-04-01', amount: 100, category: 'repairs', receiptId: 'r' },
      ],
      assets: [{ ccaClass: '8', cost: 1000, available: '2026-01-10' }],
      year: 2026,
      origin: 'https://x.dev',
    });
    expect(r.subject).toBe('Squarely: your 2026 rental tax pack is ready');
    expect(r.text).toContain('Net income before CCA (line 9369): $1,400.00');
    expect(r.text).toContain('Capital cost allowance (line 9936): up to $200.00');
    expect(r.text).toContain('1 expense from 2026 still has no receipt photo');
    expect(r.text).toContain('Plumber');
    expect(r.text).toContain('https://x.dev/app/?view=landlord');
  });
});
