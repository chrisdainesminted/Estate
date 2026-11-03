// Condos: a unit in a building pays monthly condo fees; a house doesn't.

// "Apartment" isn't enough: a 6-unit apartment building is a rental property, not a condo.
const CONDO = /\b(condo(minium)?|strata)\b/i;
const APARTMENT = /\b(apartment|apt)\b/i;

/** How many units a listing or deal holds, from what it states. */
const unitCount = (l) => Math.max(Math.round(Number(l?.units) || 0), Array.isArray(l?.beds) ? l.beds.length : 0, Array.isArray(l?.rents) ? l.rents.length : 0, 1);

/**
 * A unit in a building: an address like "303-235 Leland Avenue", or a
 * single-unit listing that says condo (or apartment). A building of two or
 * more units is never a condo.
 */
export const isCondo = (l) => {
  if (unitCount(l) >= 2) return false;
  if (/^\s*(unit\s*|suite\s*|#\s*)?\d+[a-z]?\s*-\s*\d+/i.test(String(l?.address ?? ''))) return true;
  const text = `${l?.highlights ?? ''} ${l?.type ?? ''}`;
  return CONDO.test(text) || (APARTMENT.test(text) && !/\b(building|units|plex)\b/i.test(text));
};

/** Whether a deal is a condo: what it was saved as, else what its address or notes say. Never with two or more units. */
export const isCondoDeal = (deal) => (unitCount(deal) >= 2 ? false : typeof deal?.condo === 'boolean' ? deal.condo : isCondo({ address: deal?.address || deal?.name, highlights: deal?.notes }));

/** What the monthly fixed-cost line is called for this deal. */
export function feesLabel(deal) {
  const ca = deal?.country === 'ca';
  if (isCondoDeal(deal)) return ca ? 'Condo fees & utilities' : 'HOA fees';
  return 'Utilities you pay';
}
