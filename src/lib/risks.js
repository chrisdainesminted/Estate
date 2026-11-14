// What to check about a property before counting on its numbers: the
// things that most often turn a good-looking deal into a bad one, flagged
// from what the listing says (units, age, condo, rented). Each is a
// question to ask, not a verdict.

const RENTED = /\b(tenant(ed|s)?|lease[ds]?|rented|month[- ]to[- ]month|existing rent|currently rent)/i;

/**
 * [{ key, title, text }] for a property: { units, condo, yearBuilt,
 * province, rentStated (the listing gives rents), text (its description) }.
 */
export function propertyRisks({ units = 1, condo = false, yearBuilt = null, province = 'ON', rentStated = false, text = '' } = {}) {
  const out = [];
  const n = Math.max(Math.round(Number(units)) || 1, 1);
  const year = Number(yearBuilt) || null;
  if (n >= 2 && n <= 4) {
    out.push({
      key: 'legal',
      title: 'Is every unit legal?',
      text: 'Lenders and insurers count rent only from legal units, and an illegal unit can be ordered closed. Ask the seller for the city’s permit or registration for each unit, and have the inspector check fire separation and exits.',
    });
  }
  if (n >= 2 && (rentStated || RENTED.test(text))) {
    out.push({
      key: 'tenants',
      title: 'It’s rented now: you take over the leases',
      text:
        province === 'ON'
          ? 'In Ontario you can end a tenancy to live there yourself only with at least 60 days’ notice to the end of a rental period and a month’s rent in compensation (form N12), and units first lived in before November 15, 2018 have rent increases capped by the province. Ask for every lease and rent ledger before you offer.'
          : 'Your province’s tenancy rules decide whether you can move in or raise the rent, and how much notice it takes. Ask for every lease and rent ledger before you offer.',
    });
  }
  if (year && year < 1950) {
    out.push({
      key: 'old',
      title: `Built in ${year}: ask about the wiring and an oil tank`,
      text: 'Older homes can still have knob-and-tube wiring or an old oil tank, and some insurers won’t cover either until it’s replaced. Get an insurance quote before your conditions end, and budget for a full inspection.',
    });
  } else if (year && year < 1990) {
    out.push({
      key: 'asbestos',
      title: `Built in ${year}: have the inspector look for asbestos`,
      text: 'Homes built before 1990 can have asbestos in insulation (including vermiculite), tiles or plaster. It’s usually safe left alone, but costly to remove before a renovation.',
    });
  }
  if (condo) {
    out.push({
      key: 'condo',
      title: 'Ask for the condo fees and the status certificate',
      text: 'The listing doesn’t give the monthly fee. Ask for it, the reserve fund study and the status certificate (an estoppel certificate in some provinces): a low reserve fund can mean a special assessment, a bill every owner shares.',
    });
  }
  return out;
}
