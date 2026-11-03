// Condos: a unit in a building pays monthly condo fees; a house doesn't.

const CONDO = /\b(condo(minium)?|apartment|strata)\b/i;

/** A unit in a building: an address like "303-235 Leland Avenue", or a listing that says condo. */
export const isCondo = (l) => /^\s*(unit\s*|suite\s*|#\s*)?\d+[a-z]?\s*-\s*\d+/i.test(String(l?.address ?? '')) || CONDO.test(`${l?.highlights ?? ''} ${l?.type ?? ''}`);

/** Whether a deal is a condo: what it was saved as, else what its address or notes say. */
export const isCondoDeal = (deal) => (typeof deal?.condo === 'boolean' ? deal.condo : isCondo({ address: deal?.address || deal?.name, highlights: deal?.notes }));

/** What the monthly fixed-cost line is called for this deal. */
export function feesLabel(deal) {
  const ca = deal?.country === 'ca';
  if (isCondoDeal(deal)) return ca ? 'Condo fees & utilities' : 'HOA fees';
  return 'Utilities you pay';
}
