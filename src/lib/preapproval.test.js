import { describe, expect, it } from 'vitest';
import { docsFor, lenderSummary, summaryText } from './preapproval.js';

const keys = (a) => docsFor(a).flatMap((g) => g.items.map((i) => i.key));

describe('pre-approval documents', () => {
  it('asks a salaried buyer saving on their own for the short list', () => {
    expect(keys({ incomeType: 'salary', sources: ['savings'] })).toEqual(['id', 'job-letter', 'stubs', 't4', 'bank']);
  });
  it('asks the self-employed for two years of returns, not pay stubs', () => {
    const k = keys({ incomeType: 'self', sources: ['savings'] });
    expect(k).toContain('t1');
    expect(k).toContain('noa');
    expect(k).not.toContain('stubs');
  });
  it('adds what each down payment source needs, a co-buyer, a home owned and status for newcomers', () => {
    const k = keys({ incomeType: 'salary', sources: ['savings', 'fhsa', 'rrsp', 'gift', 'sale'], coBuyer: true, ownsHome: true, newToCanada: true });
    for (const x of ['fhsa', 'rrsp', 'gift', 'sale', 'co', 'owned', 'status']) expect(k).toContain(x);
  });
});

describe('lender summary', () => {
  it('lists the numbers a lender reads, in words', () => {
    const rows = lenderSummary({
      profile: { income: 90000, debts: 300, savings: 40000, credit: '680', rentNow: 1500, targetPrice: 450000, targetUnits: 2 },
      plan: { best: { price: 486000 }, cashToClose: 42000 },
      answers: { incomeType: 'salary', years: 3, coBuyer: false, sources: ['savings', 'fhsa'] },
      place: { name: 'Toronto' },
    });
    const text = summaryText(rows);
    expect(text).toContain('Household income, before tax: $90,000 a year (salary, 3 years in this work)');
    expect(text).toContain('Down payment from: Savings or TFSA, FHSA');
    expect(text).toContain('Credit score: 680 or higher');
    expect(text).toContain('Up to $486,000');
  });
});
