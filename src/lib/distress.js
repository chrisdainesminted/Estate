// Distressed properties: homes a lender, an estate, a court or a city is
// selling, often below what similar homes ask. Two kinds:
//  - listings that say so (power of sale, bank-owned, estate sale, as is,
//    court-ordered), tagged from what the listing states;
//  - municipal tax sales: land a city sells by public tender for unpaid
//    property tax, published on the city's site and in the provincial
//    gazette, with a minimum bid and a tender deadline.

const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const positive = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

export const DISTRESS = {
  'power-of-sale': { label: 'Power of sale', re: /\bpower[- ]of[- ]sale\b/i, text: 'The lender is selling after the owner fell behind on the mortgage. Usually sold as is, with no warranties.' },
  'bank-owned': { label: 'Bank-owned', re: /\b(bank[- ]owned|lender[- ]owned|mortgagee sale)\b/i, text: 'The lender already owns it and is selling it.' },
  receivership: { label: 'Court-ordered sale', re: /\b(receiver(ship)?|court[- ](ordered|approved)|trustee sale|bankruptcy sale)\b/i, text: 'A receiver or trustee is selling under a court order; the court approves the final sale.' },
  estate: { label: 'Estate sale', re: /\bestate (sale|of the late)\b|\bestate[- ]owned\b/i, text: 'Sold by an estate. Executors often want a quick, simple sale.' },
  'as-is': { label: 'Sold as is', re: /\b(sold )?as[- ]is(,? where[- ]is)?\b|\bhandyman special\b|\bfixer[- ]upper\b/i, text: 'The seller makes no promises about condition: inspect carefully.' },
  'tax-sale': { label: 'Tax sale', re: /\btax sale\b|\btax arrears\b/i, text: 'A city is selling it by public tender for unpaid property tax.' },
};
const ORDER = ['power-of-sale', 'bank-owned', 'receivership', 'tax-sale', 'estate', 'as-is'];

/** The kind of distressed sale a listing is, from the run's tag or what the listing says; null when it's an ordinary sale. */
export function distressOf(listing) {
  if (listing?.distress && DISTRESS[listing.distress]) return listing.distress;
  const said = `${listing?.highlights ?? ''} ${listing?.description ?? ''}`;
  return ORDER.find((k) => DISTRESS[k].re.test(said)) ?? null;
}

/** A tax sale property as the run reported it, kept to what an official notice states; null without the essentials. */
export function cleanTaxSale(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const address = text(raw.address, 160);
  const legal = text(raw.legal, 300);
  const roll = text(raw.roll, 40).replace(/[^0-9A-Za-z.\- ]/g, '');
  const minimumBid = positive(raw.minimumBid);
  let url = null;
  try {
    const u = new URL(String(raw.url ?? ''));
    if (u.protocol === 'https:') url = u.toString();
  } catch {
    url = null;
  }
  if ((!address && !legal) || !minimumBid || !url) return null;
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(raw.deadline ?? '') ? raw.deadline : null;
  return {
    id: roll ? `roll-${roll.replace(/[^0-9A-Za-z]/g, '')}` : `tax-${(address || legal).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
    address: address || null,
    legal: legal || null,
    roll: roll || null,
    minimumBid,
    deadline,
    size: text(raw.size, 80) || null,
    notes: text(raw.notes, 220) || null,
    url,
  };
}

/**
 * Merge today's tax sale findings into the saved document
 * ({ schema, updatedAt, cities: { key: { checked, sales: [...] } } }).
 * Sales past their tender deadline drop off; a city with nothing found keeps
 * its open sales and gets today's date as checked.
 */
export function mergeTaxSales(prev, found, { city, today }) {
  const doc = prev && typeof prev === 'object' && prev.cities ? { ...prev, cities: { ...prev.cities } } : { schema: 1, cities: {} };
  const old = doc.cities[city]?.sales ?? [];
  const byId = new Map(old.map((s) => [s.id, s]));
  let added = 0;
  for (const raw of Array.isArray(found) ? found : []) {
    const s = cleanTaxSale(raw);
    if (!s) continue;
    if (!byId.has(s.id)) added += 1;
    byId.set(s.id, { ...byId.get(s.id), ...Object.fromEntries(Object.entries(s).filter(([, v]) => v != null)), firstSeen: byId.get(s.id)?.firstSeen ?? today });
  }
  const sales = [...byId.values()].filter((s) => !s.deadline || s.deadline >= today).sort((a, b) => String(a.deadline ?? '9').localeCompare(String(b.deadline ?? '9')) || a.minimumBid - b.minimumBid);
  doc.cities[city] = { checked: today, sales };
  doc.updatedAt = Date.now();
  return { doc, stats: { open: sales.length, added } };
}

/** How a municipal tax sale works, for the note beside the list. */
export const TAX_SALE_STEPS = [
  'Bids are sealed tenders on the city’s own form, delivered to the city before the deadline. The highest bid at or above the minimum wins.',
  'Each tender needs a deposit, usually 20% of your bid, by certified cheque or bank draft. Losing bidders get theirs back.',
  'You buy it as is, usually without seeing inside. Ask the city what it knows, and look at it from the street.',
  'The city doesn’t promise clear title or vacant possession. Liens, tenants or an owner still living there can come with it.',
  'Have a real estate lawyer read the notice and the title before you bid. If the owner pays the arrears before the sale, it’s cancelled.',
];
