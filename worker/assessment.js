// A home's assessed value from its city's open data, where the city
// publishes every property's assessment: Calgary, Edmonton and Winnipeg,
// each under its Open Government Licence (commercial use allowed, with
// attribution). Assessments are market value on a set date: July 1 of the
// year before the roll in Alberta; Winnipeg gives its own reference date.
//
// lookupAssessment finds an address (house number and the first word of the
// street name, so "Pl", "Place" and "PL SE" all match), and the spread of
// residential assessments in the same neighbourhood for context.

export const ASSESSMENT_CITIES = {
  calgary: {
    name: 'City of Calgary',
    licence: 'Open Government Licence – City of Calgary',
    url: 'https://data.calgary.ca/resource/4bsw-nn7w.json',
    find: ({ num, word }) => `starts_with(address, '${num} ${word}') AND assessment_class='RE'`,
    hood: (h) => `comm_name='${h}' AND assessment_class='RE'`,
    valueField: 'assessed_value',
    row: (r) => ({
      address: title(r.address),
      value: money(r.assessed_value),
      valuedAt: r.roll_year ? `${Number(r.roll_year) - 1}-07-01` : null,
      yearBuilt: int(r.year_of_construction),
      livingArea: null,
      lotSqft: int(r.land_size_sf),
      neighbourhood: r.comm_name ?? null,
    }),
  },
  edmonton: {
    name: 'City of Edmonton',
    licence: 'Open Government Licence – City of Edmonton',
    url: 'https://data.edmonton.ca/resource/q7d6-ambg.json',
    find: ({ num, word }) => `house_number='${num}' AND starts_with(street_name, '${word}') AND tax_class='Residential'`,
    hood: (h) => `neighbourhood='${h}' AND tax_class='Residential'`,
    valueField: 'assessed_value',
    // The current year's roll: market value on July 1 of last year.
    row: (r, today) => ({
      address: title(`${r.house_number ?? ''} ${r.street_name ?? ''}`.trim()),
      value: money(r.assessed_value),
      valuedAt: `${today.getFullYear() - 1}-07-01`,
      yearBuilt: null,
      livingArea: null,
      lotSqft: null,
      neighbourhood: r.neighbourhood ?? null,
    }),
  },
  winnipeg: {
    name: 'City of Winnipeg',
    licence: 'Open Government Licence – City of Winnipeg',
    url: 'https://data.winnipeg.ca/resource/d4mq-wa44.json',
    find: ({ num, word }) => `starts_with(full_address, '${num} ${word}') AND starts_with(property_class_1, 'RESIDENTIAL')`,
    hood: (h) => `neighbourhood_area='${h}' AND starts_with(property_class_1, 'RESIDENTIAL')`,
    valueField: 'total_assessed_value',
    row: (r) => ({
      address: title(r.full_address),
      value: money(r.total_assessed_value),
      valuedAt: r.assessment_date ? String(r.assessment_date).slice(0, 10) : null,
      yearBuilt: int(r.year_built),
      livingArea: int(r.total_living_area),
      lotSqft: null,
      neighbourhood: r.neighbourhood_area ?? null,
    }),
  },
};

const int = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
const money = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
const title = (s) => String(s ?? '').toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Nw|Ne|Sw|Se)\b/g, (d) => d.toUpperCase()).replace(/\b(\d+)([a-z])\b/g, (_, n, c) => n + c.toUpperCase());
// Only letters, digits and spaces reach a query, so nothing typed can change it.
const safe = (s) => String(s ?? '').toUpperCase().replace(/['’]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** "15 Deermeade Place SE" -> { num: '15', word: 'DEERMEADE' }; null without a house number and a street. */
export function parseAddress(address) {
  const words = safe(String(address ?? '').split(',')[0]).split(' ').filter(Boolean);
  const num = words[0];
  const word = words[1];
  if (!num || !/^\d{1,6}[A-Z]?$/.test(num) || !word || word.length < 2) return null;
  return { num, word: word.slice(0, 30) };
}

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return Math.round(sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo));
};

/** The query URL for a city's open data. */
export function queryUrl(city, where, { limit = 5, select } = {}) {
  const c = ASSESSMENT_CITIES[city];
  const params = new URLSearchParams({ $where: where, $limit: String(limit) });
  if (select) params.set('$select', select);
  return `${c.url}?${params}`;
}

/**
 * { city, source, licence, matches: [{ address, value, valuedAt, yearBuilt,
 * livingArea, lotSqft, neighbourhood }], hood: { name, count, median, low,
 * high } | null } for an address, or { error }.
 */
export async function lookupAssessment(city, address, { fetch: get = fetch, today = new Date() } = {}) {
  const c = ASSESSMENT_CITIES[city];
  if (!c) return { error: 'Assessments can be looked up in Calgary, Edmonton and Winnipeg.', status: 400 };
  const q = parseAddress(address);
  if (!q) return { error: 'Type the house number and street, like “15 Deermeade Place SE”.', status: 400 };
  const res = await get(queryUrl(city, c.find(q), { limit: 5 }), { headers: { accept: 'application/json' } });
  if (!res.ok) return { error: 'The city’s assessment data didn’t answer. Try again in a minute.', status: 502 };
  const rows = await res.json();
  const matches = (Array.isArray(rows) ? rows : []).map((r) => c.row(r, today)).filter((m) => m.value);
  let hood = null;
  const name = matches[0]?.neighbourhood;
  if (name) {
    const h = await get(queryUrl(city, c.hood(safe(name)), { limit: 5000, select: c.valueField }), { headers: { accept: 'application/json' } });
    if (h.ok) {
      const values = (await h.json()).map((r) => Number(r[c.valueField])).filter((v) => v > 0).sort((a, b) => a - b);
      if (values.length >= 5) hood = { name: title(name), count: values.length, median: quantile(values, 0.5), low: quantile(values, 0.25), high: quantile(values, 0.75) };
    }
  }
  return { city, source: c.name, licence: c.licence, matches, hood };
}
