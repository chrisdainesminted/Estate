import { describe, expect, it } from 'vitest';
import { buildDealSheetPdf, dealSheetFilename, headline, offerLine } from './dealSheetPdf.js';
import { DEFAULT_TARGETS, analyzeDeal, maxOffer, projectDeal, saleAnalysis } from './finance.js';
import { DEFAULT_DEAL } from './presets.js';

describe('deal sheet', () => {
  const deal = { ...DEFAULT_DEAL, name: '12 Main St', country: 'ca', city: 'thunder-bay' };
  it('says plainly whether it makes money', () => {
    expect(headline({ netCashFlow: 250 })).toMatch(/Leaves about \$250 a month/);
    expect(headline({ netCashFlow: -120 })).toMatch(/Costs you about \$120 a month/);
  });
  it('puts the most to pay in words', () => {
    expect(offerLine({ price: 310000, feasible: true, vsAsking: 10000, binding: 'coc', limits: [{ key: 'coc', label: '8% cash-on-cash' }] })).toEqual({
      value: '$310,000',
      note: '$10,000 above asking. Above this it misses your 8% cash-on-cash target.',
    });
    expect(offerLine({ price: 0, feasible: false }).value).toBe('No price works');
    expect(offerLine(null)).toBeNull();
  });
  it('makes a one-page PDF named for the deal', async () => {
    const rows = projectDeal(deal, 10);
    const blob = await buildDealSheetPdf({ deal, a: analyzeDeal(deal), rows, sale: saleAnalysis(deal, rows), offer: maxOffer(deal, DEFAULT_TARGETS) });
    const head = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 8));
    expect(head.startsWith('%PDF')).toBe(true);
    expect(dealSheetFilename(deal)).toBe('12 Main St - Squarely deal sheet.pdf');
  });
});
