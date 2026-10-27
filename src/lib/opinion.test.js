import { describe, expect, it } from 'vitest';
import { analyzeDeal, maxOffer, projectDeal, refiAnalysis, saleAnalysis, DEFAULT_TARGETS } from './finance.js';
import { buildOpinionPrompt, opinionFacts, parseOpinion } from './opinion.js';
import { PRESET_DEALS } from './presets.js';

const item = (deal) => {
  const rows = projectDeal(deal, 10);
  return { deal, a: analyzeDeal(deal), rows, sale: saleAnalysis(deal, rows), refi: refiAnalysis(deal), offer: maxOffer(deal, DEFAULT_TARGETS) };
};

describe('opinion prompt', () => {
  it('carries the inputs and the computed results', () => {
    const facts = opinionFacts(item(PRESET_DEALS[0]), DEFAULT_TARGETS);
    expect(facts.purchasePrice).toBe(250000);
    expect(facts.results.lenderDscr).toBeCloseTo(1.29, 2);
    expect(facts.results.netCashFlowMonthly).toBe(-5);
    expect(facts.results.maxOfferAtTargets).toBeGreaterThan(0);
    expect(facts.investorTargets.minDscr).toBe(1.25);
  });

  it('asks for the fixed format and embeds the JSON', () => {
    const p = buildOpinionPrompt(item(PRESET_DEALS[1]), DEFAULT_TARGETS);
    expect(p).toContain('### Verdict');
    expect(p).toContain('"purchasePrice": 500000');
    expect(p.length).toBeLessThan(8000);
  });
});

describe('parseOpinion', () => {
  it('splits headings, bullets and paragraphs, with bold spans', () => {
    const blocks = parseOpinion('### Verdict\nNegotiate: **$20k** too high.\n- Thin rent cushion\n* Insurance looks low\n1. One fix');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'para', 'bullet', 'bullet', 'bullet']);
    expect(blocks[1].spans).toEqual([
      { text: 'Negotiate: ', bold: false },
      { text: '$20k', bold: true },
      { text: ' too high.', bold: false },
    ]);
  });

  it('keeps markup as text', () => {
    const blocks = parseOpinion('<img src=x onerror=alert(1)>');
    expect(blocks[0]).toEqual({ type: 'para', spans: [{ text: '<img src=x onerror=alert(1)>', bold: false }] });
  });
});
