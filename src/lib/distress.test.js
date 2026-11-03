import { describe, expect, it } from 'vitest';
import { cleanTaxSale, distressOf, mergeTaxSales } from './distress.js';
import { cleanListing } from './market.js';

describe('distressed listings', () => {
  it('reads the kind of sale from what the listing says', () => {
    expect(distressOf({ highlights: 'Power of sale, sold as is where is' })).toBe('power-of-sale');
    expect(distressOf({ highlights: 'Estate sale, bring your ideas' })).toBe('estate');
    expect(distressOf({ highlights: 'Court-ordered sale by the receiver' })).toBe('receivership');
    expect(distressOf({ highlights: 'Handyman special' })).toBe('as-is');
    expect(distressOf({ highlights: 'Updated kitchen, close to schools' })).toBeNull();
  });
  it('keeps the run’s tag through cleaning, and ignores made-up kinds', () => {
    const base = { address: '12 Main St', price: 200000, url: 'https://www.realtor.ca/real-estate/1/12-main-st' };
    expect(cleanListing({ ...base, distress: 'power-of-sale' }).distress).toBe('power-of-sale');
    expect(cleanListing({ ...base, distress: 'cheap' }).distress).toBeNull();
    expect(distressOf(cleanListing({ ...base, distress: 'bank-owned' }))).toBe('bank-owned');
  });
});

describe('tax sales', () => {
  const sale = { address: '10 King St', roll: '5804-010-001-00100', minimumBid: 12000, deadline: '2027-06-10', url: 'https://www.thunderbay.ca/tax-sale.pdf' };
  it('needs a place, a minimum bid and the official notice', () => {
    expect(cleanTaxSale(sale).id).toBe('roll-580401000100100');
    expect(cleanTaxSale({ ...sale, url: 'http://x.ca' })).toBeNull();
    expect(cleanTaxSale({ ...sale, minimumBid: 0 })).toBeNull();
    expect(cleanTaxSale({ ...sale, address: '', legal: 'PCL 1234 SEC TBF' }).legal).toBe('PCL 1234 SEC TBF');
  });
  it('keeps open sales, adds new ones and drops ones past their deadline', () => {
    const { doc } = mergeTaxSales(null, [sale, { ...sale, roll: '2', deadline: '2026-01-01' }], { city: 'thunder-bay', today: '2026-11-03' });
    expect(doc.cities['thunder-bay'].sales.map((s) => s.roll)).toEqual(['5804-010-001-00100']);
    const again = mergeTaxSales(doc, [], { city: 'thunder-bay', today: '2027-06-11' });
    expect(again.doc.cities['thunder-bay'].sales).toHaveLength(0);
    expect(again.doc.cities['thunder-bay'].checked).toBe('2027-06-11');
  });
});
