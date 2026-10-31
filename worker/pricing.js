// What Squarely charges a landlord for the rent tracker: a small share of the
// rent on each unit with a tenant, capped per unit, with one unit free.
// Renters and buyers never pay, and vacant units cost nothing. Squarely is
// software the landlord uses; it doesn't collect rent or manage tenancies.

export const PLAN = {
  rate: 0.02, // 2% of the monthly rent
  capPerUnit: 30, // $ a month, per unit
  freeUnits: 1, // the unit with the highest fee is free
  currency: 'cad',
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** A unit counts once it has a tenant and a rent. */
export const isTenanted = (u) => Boolean(u && String(u.tenantName || '').trim() && num(u.rent) > 0);

/** One unit's fee before the free unit comes off, in dollars (to the cent). */
export const unitFee = (u) => (isTenanted(u) ? Math.min(Math.round(num(u.rent) * PLAN.rate * 100) / 100, PLAN.capPerUnit) : 0);

/**
 * This month's charge for a set of units: each tenanted unit's fee, the
 * largest `freeUnits` of them waived. Returns the lines and the total.
 */
export function monthlyBill(units) {
  const lines = (units || []).map((u) => ({ unitId: u.id, label: u.label || 'Unit', rent: num(u.rent), tenanted: isTenanted(u), fee: unitFee(u), free: false }));
  const charged = lines.filter((l) => l.fee > 0).sort((a, b) => b.fee - a.fee);
  for (const l of charged.slice(0, PLAN.freeUnits)) l.free = true;
  const total = Math.round(lines.reduce((s, l) => s + (l.free ? 0 : l.fee), 0) * 100) / 100;
  return { lines, total, cents: Math.round(total * 100), tenanted: charged.length };
}

/** What a manager would take at 8% on the same rent, for comparison. */
export const managerWouldCharge = (units) => Math.round((units || []).filter(isTenanted).reduce((s, u) => s + num(u.rent) * 0.08, 0));
