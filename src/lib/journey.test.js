import { describe, expect, it } from 'vitest';
import { BUY_STEPS, fitFor, monthKey, myPlan, nextStep, readyReminder, stepsFor } from './journey.js';
import { homeFor, maxPrice, normalizeProfile } from './firstHome.js';

const me = { city: 'thunder-bay', income: 85000, savings: 60000, debts: 250, rentNow: 1400, monthlySave: 600, targetPrice: 390000, targetUnits: 2, entered: true };
const now = new Date(2026, 10, 2);

describe('myPlan', () => {
  it('answers what you could buy, alone and with a rental unit, and the cash it takes', () => {
    const plan = myPlan({ profile: me, ratePct: 5.12, now });
    expect(plan.duplex.price).toBeGreaterThan(plan.solo.price);
    expect(plan.best.price).toBe(plan.duplex.price);
    expect(plan.cashToClose).toBeGreaterThan(0);
    expect(plan.cashToClose).toBeLessThanOrEqual(me.savings);
  });

  it('gives the gap to the home you want and the month you’d be ready', () => {
    const plan = myPlan({ profile: { ...me, targetPrice: 750000 }, ratePct: 5.12, now });
    expect(plan.goal.short).toBeGreaterThan(0);
    expect(plan.goal.months).toBeGreaterThan(0);
    expect(plan.goal.readyBy).toBe(monthKey(plan.goal.months, now));
    expect(plan.shortcuts.map((s) => s.key)).toEqual(expect.arrayContaining(['fhsa', 'hbp', 'gift']));
    const gift = plan.shortcuts.find((s) => s.key === 'gift');
    expect(gift.value).toBe(Math.round(plan.goal.short));
  });

  it('counts a family gift as savings', () => {
    const without = myPlan({ profile: { ...me, targetPrice: 750000 }, ratePct: 5.12, now });
    const withIt = myPlan({ profile: { ...me, targetPrice: 750000, gift: without.goal.short + 10 }, ratePct: 5.12, now });
    expect(withIt.goal.short).toBe(0);
    expect(withIt.goal.months).toBe(0);
    expect(withIt.gift).toBeCloseTo(without.goal.short + 10);
  });

  it('says what income the goal needs when yours won’t qualify', () => {
    const plan = myPlan({ profile: { ...me, income: 40000, targetPrice: 700000 }, ratePct: 5.12, now });
    expect(plan.goal.qualifies).toBe(false);
    expect(plan.goal.incomeShort).toBeGreaterThan(0);
  });
});

describe('fitFor', () => {
  const deal = (price) => ({ price, units: 2, rentPerUnit: 1500, taxesAnnual: price * 0.012, insuranceAnnual: 1800, maintPct: 5, capexPct: 5, vacancyPct: 4, hoaMonthly: 0, city: 'thunder-bay' });
  it('labels a home you can buy today as fitting', () => {
    const top = maxPrice({ profile: me, units: 2, ratePct: 5.12, taxPct: 1.2, rentPerOtherUnit: 1500 }).price;
    expect(fitFor(homeFor(deal(top * 0.8), me, 5.12), me).key).toBe('fits');
  });
  it('labels a home a few months of saving away as a stretch', () => {
    const p = { ...me, savings: 15000, monthlySave: 1500 };
    const f = fitFor(homeFor(deal(320000), p, 5.12), p);
    expect(f.key).toBe('stretch');
    expect(f.months).toBeGreaterThan(0);
    expect(f.months).toBeLessThanOrEqual(12);
  });
  it('labels a far-off home as not yet, with the reason', () => {
    const f = fitFor(homeFor(deal(1200000), me, 5.12), me);
    expect(f.key).toBe('notYet');
    expect(f.reason).toMatch(/income|short/);
  });
});

describe('nextStep', () => {
  it('starts with the questions', () => {
    expect(nextStep({ profile: {}, ready: {} }).id).toBe('start');
  });
  it('puts saving before paperwork while the cash is months away', () => {
    const p = { ...me, targetPrice: 750000 };
    const plan = myPlan({ profile: p, ratePct: 5.12, now });
    expect(nextStep({ profile: p, ready: { credit: true, fhsa: true }, plan }).id).toBe('save');
    expect(nextStep({ profile: p, ready: {}, plan }).id).toBe('credit');
  });
  it('walks the checklist once the cash is there', () => {
    const plan = myPlan({ profile: me, ratePct: 5.12, now });
    expect(plan.goal.short).toBe(0);
    const n = nextStep({ profile: me, ready: { credit: true, fhsa: true, docs: true }, plan });
    expect(n.id).toBe('preapproval');
    expect(n.anchor).toBe('step-preapproval');
    const all = Object.fromEntries(BUY_STEPS.map((s) => [s.id, true]));
    expect(nextStep({ profile: me, ready: all, plan }).id).toBe('done');
  });
  it('skips the FHSA for someone who has owned before', () => {
    expect(stepsFor({ ...me, firstTime: false }).some((s) => s.id === 'fhsa')).toBe(false);
  });
});

describe('profile', () => {
  it('keeps a gift, a ready month and the reminder choice', () => {
    const p = normalizeProfile({ gift: 5000, readyBy: '2027-08', remindReady: true });
    expect(p).toMatchObject({ gift: 5000, readyBy: '2027-08', remindReady: true });
    expect(normalizeProfile({ readyBy: '2027-13' }).readyBy).toBeNull();
  });
});

describe('readyReminder', () => {
  const p = { ...me, targetPrice: 750000, remindReady: true, readyBy: '2027-08' };
  it('waits for the planned month', () => {
    expect(readyReminder({ profile: p, ratePct: 5.12, today: '2027-07-31', origin: 'https://x' })).toBeNull();
  });
  it('sends once in that month, with the next steps', () => {
    const r = readyReminder({ profile: p, ratePct: 5.12, today: '2027-08-01', origin: 'https://x' });
    expect(r.subject).toMatch(/August 2027/);
    expect(r.body).toMatch(/Get pre-approved/);
    expect(r.body).toMatch(/https:\/\/x\/app\/\?view=home/);
    expect(readyReminder({ profile: p, ratePct: 5.12, today: '2027-09-01', origin: 'https://x', sent: '2027-08' })).toBeNull();
  });
  it('stays quiet unless asked for', () => {
    expect(readyReminder({ profile: { ...p, remindReady: false }, ratePct: 5.12, today: '2027-09-01', origin: 'https://x' })).toBeNull();
  });
});

describe('a goal years away', () => {
  it('offers a price within two years instead', () => {
    const plan = myPlan({ profile: { ...me, savings: 30000, targetPrice: 1563000 }, ratePct: 5.12, now });
    expect(plan.goal.far).toBe(true);
    expect(plan.goal.within2).toBeGreaterThan(100000);
    expect(plan.goal.within2).toBeLessThan(1563000);
    expect(plan.shortcuts.some((s) => s.key === 'save')).toBe(false);
    const closer = myPlan({ profile: { ...me, savings: 30000, targetPrice: plan.goal.within2 }, ratePct: 5.12, now });
    expect(closer.goal.qualifies).toBe(true);
    expect(closer.goal.months).toBeLessThanOrEqual(24);
  });
});
