import { describe, expect, it } from 'vitest';
import { equitySummary, everyoneMailto, initials, landlordAlerts, telLink, tenantMessages, tenantsOf } from './profile.js';
import { analyzeDeal } from './finance.js';
import { DEFAULT_DEAL } from './presets.js';

const data = {
  units: [
    { id: 'u1', label: 'Upper', rent: 1500, dueDay: 1, tenantName: 'Ana Lee', tenantEmail: 'ana@x.ca', tenantPhone: '807-555-0100', leaseEnd: '2026-12-31' },
    { id: 'u2', label: 'Lower', rent: 1200, dueDay: 1, tenantName: 'Ben Roy', tenantEmail: 'ben@x.ca' },
    { id: 'u3', label: 'Garden', rent: 1000, dueDay: 1, tenantName: '' },
  ],
  payments: [{ unitId: 'u2', month: '2026-11', amount: 1200 }],
  maintenance: [
    { id: 'm1', unitId: 'u2', title: 'Leaky tap', status: 'reported', urgency: 'urgent' },
    { id: 'm2', unitId: 'u1', title: 'Old fix', status: 'fixed' },
  ],
  claims: [{ unitId: 'u1', month: '2026-11', amount: 1500, status: 'pending' }],
  applications: [{ id: 'a1', read: false }, { id: 'a2', read: true }],
  messages: [{ applicationId: 'a1', from: 'applicant', read: false }],
};

describe('tenantsOf', () => {
  it('lists rented units, urgent repairs first, with rent status', () => {
    const { rows, vacant } = tenantsOf(data, '2026-11-03');
    expect(vacant).toBe(1);
    expect(rows.map((r) => r.unit.id)).toEqual(['u2', 'u1']);
    expect(rows[0].status.state).toBe('paid');
    expect(rows[0].repairs).toHaveLength(1);
    expect(rows[1].status.state).toBe('late');
    expect(rows[1].claim).toBeTruthy();
    expect(rows[1].leaseDays).toBe(58);
  });
  it('copes with an empty workspace', () => {
    expect(tenantsOf(null)).toEqual({ rows: [], vacant: 0 });
  });
});

describe('landlordAlerts', () => {
  it('counts what needs you', () => {
    const a = landlordAlerts(data, '2026-11-03');
    expect(a).toMatchObject({ tenants: 2, vacant: 1, late: 1, owing: 1500, collected: 1200, rentRoll: 2700, repairs: 1, urgent: 1, claims: 1, leasesEnding: 1, newApplications: 1, unreadMessages: 1 });
  });
});

describe('tenantMessages', () => {
  it('fills in rent, repair, entry and lease messages', () => {
    const { rows } = tenantsOf(data, '2026-11-03');
    const late = tenantMessages({ ...rows[1], settings: { signature: 'Chris' }, entryRule: '24 hours’ written notice.' });
    expect(late.map((m) => m.key)).toEqual(['rent', 'entry', 'lease', 'note']);
    expect(late[0].body).toContain('Hi Ana');
    expect(late[0].body).toContain('Chris');
    expect(late[1].body).toContain('24 hours’ written notice.');
    const paid = tenantMessages({ ...rows[0], settings: {} });
    expect(paid.map((m) => m.key)).toEqual(['thanks', 'repair-m1', 'entry', 'note']);
    expect(paid[1].body).toContain('Leaky tap');
  });
});

describe('everyoneMailto and telLink', () => {
  it('puts every tenant in Bcc', () => {
    const { rows } = tenantsOf(data, '2026-11-03');
    const url = everyoneMailto(rows, { subject: 'Water off', body: 'Tuesday' });
    expect(url).toMatch(/^mailto:\?bcc=/);
    expect(decodeURIComponent(url)).toContain('ben@x.ca,ana@x.ca');
    expect(everyoneMailto([])).toBeNull();
  });
  it('makes call links only from real numbers', () => {
    expect(telLink('807-555-0100')).toBe('tel:8075550100');
    expect(telLink('n/a')).toBeNull();
  });
});

describe('equitySummary', () => {
  it('adds up owned properties, largest equity first', () => {
    const deals = [
      { ...DEFAULT_DEAL, id: 'd1', name: 'A', price: 300000, downPct: 20, yearsOwned: 2 },
      { ...DEFAULT_DEAL, id: 'd2', name: 'B', price: 500000, downPct: 50, yearsOwned: 0 },
    ];
    const { totals, rows } = equitySummary(deals.map((deal) => ({ deal, a: analyzeDeal(deal) })));
    expect(rows[0].id).toBe('d2');
    expect(totals.equity).toBeCloseTo(rows[0].equity + rows[1].equity, 0);
    expect(rows[1].equityPct).toBeGreaterThan(0.2);
  });
  it('is empty with nothing owned', () => {
    expect(equitySummary([]).rows).toEqual([]);
  });
});

describe('initials', () => {
  it('reads an email or a name', () => {
    expect(initials('chris.daines@x.ca')).toBe('CD');
    expect(initials('')).toBe('S');
  });
});
