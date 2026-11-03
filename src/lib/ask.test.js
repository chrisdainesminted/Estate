import { describe, expect, it } from 'vitest';
import { askContext, askPrompt } from './ask.js';
import { myPlan } from './journey.js';

const profile = { city: 'thunder-bay', income: 85000, savings: 60000, debts: 250, rentNow: 1400, monthlySave: 600, targetPrice: 390000, targetUnits: 2, entered: true, firstTime: true };

describe('Ask Squarely', () => {
  it('gives Claude the person’s own numbers as plain facts', () => {
    const plan = myPlan({ profile, ratePct: 5.12 });
    const c = askContext({ mode: 'Buy', view: 'My plan', profile, plan });
    expect(c).toMatch(/Buy mode, the My plan tab/);
    expect(c).toMatch(/Household income: \$85,000\/yr/);
    expect(c).toMatch(/Most with a rental unit: \$\d/);
    expect(c).not.toMatch(/deal they have open/);
  });
  it('adds the open deal in Invest, with unknown tax said plainly', () => {
    const c = askContext({ mode: 'Invest', view: 'Analyze', profile: { entered: false }, deal: { name: '12 Main', price: 300000, units: 2, rentPerUnit: 1400, taxesAnnual: 0, downPct: 20, rate: 5.12 }, analysis: { netCashFlow: -120, dscr: 1.1, coc: 0.02, cashInvested: 70000 } });
    expect(c).toMatch(/Property tax: not known/);
    expect(c).toMatch(/DSCR: 1.10/);
    expect(c).not.toMatch(/buying plan/);
  });
  it('puts the conversation and question in one prompt', () => {
    const p = askPrompt('- Saved: $1', [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }], 'What next?');
    expect(p).toMatch(/Them: Hi\n\nYou: Hello/);
    expect(p.endsWith('Their question: What next?')).toBe(true);
  });
});
