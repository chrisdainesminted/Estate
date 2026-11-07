import { describe, expect, it } from 'vitest';
import { growthPct, ownedDeal, rateFromPayment, yearsSince } from './ownedHome.js';
import { estimateToday, loanRate, monthlyPI } from './finance.js';

const today = new Date(2026, 10, 7); // November 2026

describe('rateFromPayment', () => {
  it('finds the rate a payment implies, Canadian compounding', () => {
    const pay = monthlyPI(400000, loanRate(4.79, { country: 'ca' }), 25);
    expect(rateFromPayment(400000, pay, 25)).toBeCloseTo(4.79, 2);
    expect(rateFromPayment(400000, 500, 25)).toBe(null); // can't pay it off
    expect(rateFromPayment(0, 2000, 25)).toBe(null);
  });
});

describe('yearsSince and growthPct', () => {
  it('counts years to the month', () => {
    expect(yearsSince('2021-11', today)).toBe(5);
    expect(yearsSince('2026-05', today)).toBe(0.5);
    expect(yearsSince('2030-01', today)).toBe(0);
    expect(yearsSince('', today)).toBe(0);
  });
  it('turns what it’s worth now into yearly growth', () => {
    expect(growthPct(400000, 500000, 5)).toBeCloseTo(4.6, 1);
    expect(growthPct(400000, 500000, 0.2)).toBe(null);
    expect(growthPct(400000, null, 5)).toBe(null);
  });
});

describe('ownedDeal', () => {
  const form = { address: '230 Brodie Street N, Thunder Bay, ON', units: 2, price: 400000, bought: '2021-11', down: 80000, payment: monthlyPI(320000, loanRate(2.89, { country: 'ca' }), 25), rent: 3600, worth: 500000 };

  it('works out the down %, rate, growth and place from what the owner knows', () => {
    const r = ownedDeal(form, {}, today);
    expect(r.deal).toMatchObject({ status: 'owned', city: 'thunder-bay', name: '230 Brodie Street N', units: 2, unitType: 'duplex', price: 400000, downPct: 20, yearsOwned: 5, rentPerUnit: 1800, termYears: 25 });
    expect(r.rate).toBeCloseTo(2.89, 2);
    expect(r.rateFrom).toBe('payment');
    expect(r.growthFrom).toBe('worth');
    expect(r.taxesFrom).toBe('typical');
    expect(r.deal.estimated).toBe(true);
  });

  it('owes less and is worth what they said, today', () => {
    const now = estimateToday(ownedDeal(form, {}, today).deal);
    expect(now.value).toBeGreaterThan(498000);
    expect(now.value).toBeLessThan(502000);
    expect(now.balance).toBeLessThan(320000);
    expect(now.balance).toBeGreaterThan(260000);
    expect(now.payment).toBeCloseTo(form.payment, 0);
  });

  it('uses a stated rate, then today’s, when there’s no payment', () => {
    expect(ownedDeal({ ...form, payment: null, rate: 5.5 }, {}, today)).toMatchObject({ rate: 5.5, rateFrom: 'you' });
    expect(ownedDeal({ ...form, payment: null }, { rate: 4.4 }, today)).toMatchObject({ rate: 4.4, rateFrom: 'today' });
    expect(ownedDeal({ ...form, taxes: 4200 }, {}, today).deal).toMatchObject({ taxesAnnual: 4200, estimated: false });
    expect(ownedDeal({ price: null }, {}, today)).toBe(null);
  });
});

describe('work put into the place', () => {
  const base = { address: '318 Dease St, Thunder Bay', price: 157000, bought: '2025-08', down: 40000, payment: 700, rent: 1800 };
  it('counts the money spent and adds it to the value', () => {
    const r = ownedDeal({ ...base, work: 25000, workNotes: 'New kitchen and roof' }, {}, today);
    expect(r.deal).toMatchObject({ rehabCost: 25000, arv: 182000, arvAuto: true, workNotes: 'New kitchen and roof' });
    const now = estimateToday(r.deal);
    expect(now.value).toBeGreaterThan(182000);
  });
  it('measures growth from price plus work when they say what it’s worth', () => {
    const r = ownedDeal({ ...base, bought: '2021-11', work: 50000, worth: 260000 }, {}, today);
    expect(r.appreciationPct).toBeCloseTo(4.7, 1);
    expect(estimateToday(r.deal).value).toBeGreaterThan(258000);
  });
  it('flags a payment that implies an unlikely rate', () => {
    expect(ownedDeal({ ...base, down: 40000, payment: 2000 }, {}, today).highRate).toBe(true);
    expect(ownedDeal(base, {}, today).highRate).toBe(false);
  });
});
