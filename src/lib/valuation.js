// What a home is likely worth, said as honestly as the data allows: a
// figure, the range around it, how sure we are, and what it rests on.
//
// - The city's assessment, when we have it, is the strongest base: it's
//   the assessor's market value for that exact property on a set date.
//   Ontario's assessments are still at their January 1, 2016 values, so
//   there they're shown but not used as today's price.
// - Otherwise, the middle asking price of similar homes for sale now (same
//   kind, within a bedroom where enough are listed).
// The range is always the middle half of those asking prices, when there
// are any: where most similar homes are priced, not a guess at error.

/** Cities whose every assessment we can look up from their open data. */
export const ASSESSMENT_LOOKUP = ['calgary', 'edmonton', 'winnipeg'];

// Provinces where assessments aren't recent market values.
const STALE_ASSESSMENT = { ON: 'Ontario’s assessments are still at their 2016 values (the province postponed reassessment), so they can’t say what a home is worth today.' };

const monthsBetween = (iso, today) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  return (today.getFullYear() - Number(m[1])) * 12 + (today.getMonth() + 1 - Number(m[2]));
};

/**
 * { estimate, low, high, confidence: 'high' | 'medium' | 'low', basis: [..],
 * notes: [..] } from an assessment ({ value, valuedAt 'YYYY-MM-DD', source
 * 'city' | 'you' }) and homeWorth's comparison, or null with neither.
 */
export function valueEstimate({ assessment, comps, province, today = new Date() }) {
  const notes = [];
  const basis = [];
  const a = assessment?.value > 0 ? assessment : null;
  const stale = a && STALE_ASSESSMENT[province];
  if (stale) notes.push(stale);
  const age = a ? monthsBetween(a.valuedAt, today) : null;
  const range = comps ? { low: comps.low, high: comps.high } : { low: null, high: null };

  if (a && !stale) {
    const fresh = age != null && age <= 18;
    const when = a.valuedAt ? (a.source === 'city' ? ` on ${longDate(a.valuedAt)}` : ` in ${a.valuedAt.slice(0, 4)}`) : '';
    basis.push(`${a.source === 'city' ? 'the city’s assessment' : 'your assessment'}${when ? `, its market value${when}` : ''}`);
    if (age == null) notes.push('Add the date your assessment values the home at: it’s on the notice.');
    else if (age > 18) notes.push(`That value is ${Math.round(age / 12)} years old: prices have moved since.`);
    else notes.push('Prices since that date, and anything about the home the assessor didn’t see, aren’t in it.');
    if (comps) basis.push(`${comps.count} similar homes for sale now`);
    return { estimate: a.value, ...range, confidence: a.source === 'city' && fresh ? 'high' : fresh ? 'medium' : 'low', basis, notes };
  }

  if (!comps) return null;
  basis.push(`the middle asking price of ${comps.count} ${comps.byBeds ? 'similar homes (within a bedroom)' : 'homes of the same kind, any size'} for sale now`);
  notes.push('Asking prices, not sales: homes usually sell for a little less. Size, condition and street aren’t counted.');
  return { estimate: comps.estimate, ...range, confidence: comps.byBeds && comps.count >= 8 ? 'medium' : 'low', basis, notes };
}

export const CONFIDENCE = {
  high: { label: 'High confidence', text: 'The assessor’s value for this exact home, from the last year and a half.' },
  medium: { label: 'Medium confidence', text: 'A fair guide. Check it against a few recent sales nearby.' },
  low: { label: 'Rough guide', text: 'Few similar homes, or nothing about this exact home. Get an agent’s market analysis before pricing.' },
};

function longDate(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
}
