// Second opinion from Claude: the prompt Squarely sends, and a parser that
// turns the reply into plain blocks for rendering as text (never HTML).

import { provinceName } from './canada.js';
import { dealPlace } from './finance.js';

const r0 = (v) => (Number.isFinite(v) ? Math.round(v) : null);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const pct1 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 10 : null);

/** The facts Claude sees: inputs as entered and the numbers Squarely computed. */
export function opinionFacts({ deal, a, sale, refi, offer }, targets) {
  return {
    name: deal.name,
    location: deal.country === 'ca' ? `Canada (${dealPlace(deal).name}, ${provinceName(dealPlace(deal).province)}); mortgage compounded semi-annually` : 'United States',
    status: deal.status === 'owned' ? 'owned' : 'prospect',
    units: a.units,
    purchasePrice: r0(a.price),
    rentPerUnitMonthly: r0(Number(deal.rentPerUnit)),
    downPaymentPct: Number(deal.downPct),
    interestRatePct: Number(deal.rate),
    termYears: Number(deal.termYears),
    interestOnlyYears: a.ioYears,
    closingCostPct: Number(deal.closingPct),
    landTransferTax: a.landTransferTax ? r0(a.landTransferTax) : null,
    rehab: r0(a.rehab),
    afterRepairValue: Number(deal.arv) > 0 ? r0(Number(deal.arv)) : null,
    propertyTaxAnnual: r0(Number(deal.taxesAnnual)),
    insuranceAnnual: r0(Number(deal.insuranceAnnual)),
    hoaMonthly: r0(Number(deal.hoaMonthly)),
    managementPct: Number(deal.mgmtPct),
    maintenancePct: Number(deal.maintPct),
    vacancyPct: Number(deal.vacancyPct),
    capexPct: Number(deal.capexPct),
    appreciationPctPerYear: Number(deal.appreciationPct),
    rentGrowthPctPerYear: Number(deal.rentGrowthPct),
    lenderReserveMonths: Number(deal.reserveMonths),
    prepaymentPenalty: deal.prepay || 'none',
    results: {
      pitiaMonthly: r0(a.pitia),
      lenderDscr: r2(a.dscr),
      dscrBand: a.status.label,
      netCashFlowMonthly: r0(a.netCashFlow),
      cashOnCashPct: pct1(a.coc),
      capRatePct: pct1(a.capRate),
      cashInvested: r0(a.cashInvested),
      reservesToHold: r0(a.reserves),
      breakevenRentPerUnit: r0(a.breakevenRent / a.units),
      maxOfferAtTargets: offer && Number.isFinite(offer.price) ? r0(offer.price) : null,
      maxOfferLimitedBy: offer?.binding ?? null,
      irrIfSoldYear10Pct: pct1(sale.irr),
      profitIfSoldYear10: r0(sale.profit),
      refinance: refi
        ? { year: refi.year, cashOut: r0(refi.cashOut), cashLeftInDeal: r0(refi.cashLeft), dscrAfter: r2(refi.dscr), cashFlowAfterMonthly: r0(refi.netCashFlow) }
        : null,
    },
    investorTargets: {
      minDscr: targets.useDscr ? Number(targets.dscr) : null,
      minCashFlowPerDoor: targets.useCashFlow ? Number(targets.cashFlowPerDoor) : null,
      minCashOnCashPct: targets.useCoc ? Number(targets.coc) : null,
    },
  };
}

export function buildOpinionPrompt(item, targets) {
  const ca = item.deal.country === 'ca';
  const place = dealPlace(item.deal);
  const who = ca ? 'Canadian rental-property investor and mortgage underwriter' : 'US rental-property investor and DSCR loan underwriter';
  const where = ca ? `a rental in ${place.name.replace(/^Elsewhere in /, '')}, ${provinceName(place.province)}` : 'a typical US rental';
  return [
    `You are an experienced ${who} giving a second opinion to an investor growing past five properties.`,
    `Be direct and specific, and quote the numbers given. Use only the data below. If an input looks unusual for ${where} (for example vacancy, repairs, CapEx, insurance, taxes or appreciation), name it and say what is typical. Do not give legal or tax advice.`,
    '',
    'Write under 230 words in exactly this format, with no other headings and no preamble:',
    '### Verdict',
    'One sentence: buy, negotiate, or pass, and why.',
    '### Biggest risks',
    '- two or three bullets',
    '### Check these assumptions',
    '- two or three bullets, each naming the input and a typical range',
    '### Negotiation angle',
    '- one or two bullets using the max offer and cash flow',
    '### One way to improve it',
    '- one bullet',
    '',
    'Deal (JSON):',
    JSON.stringify(opinionFacts(item, targets), null, 1),
  ].join('\n');
}

/**
 * Split a reply into blocks: headings ("### "), bullets ("- " or "* "),
 * and paragraphs. Inline **bold** becomes { bold: true } spans. The result
 * is data only; the UI renders it as text.
 */
export function parseOpinion(text) {
  const blocks = [];
  String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (heading) blocks.push({ type: 'heading', spans: spans(heading[1]) });
      else if (bullet) blocks.push({ type: 'bullet', spans: spans(bullet[1]) });
      else blocks.push({ type: 'para', spans: spans(line) });
    });
  return blocks;
}

function spans(s) {
  return s
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part.replace(/\*\*/g, ''), bold: false }));
}
