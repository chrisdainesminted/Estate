// Where in Canada: what changes by province and city when you buy a home.
// Land transfer tax (and the first-buyer relief some provinces give), the
// sales tax a few provinces charge on the mortgage insurance premium,
// income tax (for refunds on FHSA deposits), and typical local rent and
// property tax as starting points the person can change. Everything else
// (down payment, insurance, the stress test, FHSA, HBP) is federal.
//
// Checked October 30, 2026 against secondary sources (provincial sites
// couldn't be reached); the app shows estimates as estimates.

export const CANADA_CHECKED = '2026-10-30';

export const PROVINCES = [
  { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'ON', name: 'Ontario' },
  { code: 'QC', name: 'Quebec' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'YT', name: 'Yukon' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const provinceName = (code) => PROVINCES.find((p) => p.code === code)?.name ?? 'Ontario';

/**
 * Cities, with three local numbers:
 * - rent: the average a two-bedroom unit brings (CMHC's October 2025
 *   survey; `rentEstimated` where it gives none),
 * - taxPct: property tax as a share of what a home sells for (Ontario
 *   assessments still use 2016 values, so there the share of today's price
 *   is well under the city's published rate),
 * - price: what a typical detached house sells for, fall 2026 (the local
 *   board's detached average, median or benchmark where one was found;
 *   `priceEstimated` where it's worked out from the all-homes average).
 * Each province also gets an "elsewhere" entry, all estimates.
 */
// key, name, province, rent, taxPct, price, [rentEstimated, priceEstimated]
const CITY_LIST = [
  ['vancouver', 'Vancouver', 'BC', 2363, 0.3, 1785000],
  ['victoria', 'Victoria', 'BC', 2120, 0.5, 1300000],
  ['kelowna', 'Kelowna', 'BC', 1950, 0.45, 1050000, true],
  ['calgary', 'Calgary', 'AB', 1914, 0.65, 705000],
  ['edmonton', 'Edmonton', 'AB', 1603, 1, 530000, false, true],
  ['regina', 'Regina', 'SK', 1473, 1.1, 380000, false, true],
  ['saskatoon', 'Saskatoon', 'SK', 1548, 1, 480000, false, true],
  ['winnipeg', 'Winnipeg', 'MB', 1571, 1.2, 440000],
  ['toronto', 'Toronto', 'ON', 2046, 0.6, 1563000],
  ['ottawa', 'Ottawa', 'ON', 1926, 0.9, 705000],
  ['hamilton', 'Hamilton', 'ON', 1750, 1, 850000, true, true],
  ['kitchener', 'Kitchener-Waterloo', 'ON', 1800, 0.85, 815000, true],
  ['london', 'London', 'ON', 1650, 1, 700000, true, true],
  ['windsor', 'Windsor', 'ON', 1450, 1.2, 505000, true],
  ['sudbury', 'Greater Sudbury', 'ON', 1500, 1, 500000, true, true],
  ['thunder-bay', 'Thunder Bay', 'ON', 1700, 1, 390000, true, true],
  ['montreal', 'Montréal', 'QC', 1346, 0.75, 635000],
  ['quebec-city', 'Québec City', 'QC', 1277, 0.85, 465000],
  ['gatineau', 'Gatineau', 'QC', 1400, 0.95, 480000, true, true],
  ['halifax', 'Halifax', 'NS', 1826, 1, 624000],
  ['moncton', 'Moncton', 'NB', 1453, 1.4, 420000, false, true],
  ['saint-john', 'Saint John', 'NB', 1300, 1.6, 330000, true, true],
  ['fredericton', 'Fredericton', 'NB', 1400, 1.4, 380000, true, true],
  ['charlottetown', 'Charlottetown', 'PE', 1500, 1.2, 450000, true, true],
  ['st-johns', 'St. John’s', 'NL', 1250, 0.85, 400000, true, true],
  ['whitehorse', 'Whitehorse', 'YT', 1800, 0.8, 650000, true, true],
  ['yellowknife', 'Yellowknife', 'NT', 2000, 1.3, 550000, true, true],
];

// Elsewhere in each province: rough typical rent, property tax and house price.
const ELSEWHERE = {
  BC: [1800, 0.45, 850000],
  AB: [1500, 0.9, 450000],
  SK: [1350, 1.1, 330000],
  MB: [1400, 1.2, 350000],
  ON: [1600, 1, 650000],
  QC: [1200, 0.85, 420000],
  NB: [1350, 1.5, 300000],
  NS: [1600, 1.1, 420000],
  PE: [1450, 1.2, 400000],
  NL: [1200, 0.9, 330000],
  YT: [1800, 0.8, 600000],
  NT: [2000, 1.2, 450000],
  NU: [2400, 0.8, 600000],
};

export const CITIES = [
  ...CITY_LIST.map(([key, name, province, rent, taxPct, price, rentEstimated = false, priceEstimated = false]) => ({ key, name, province, rent, taxPct, price, rentEstimated, priceEstimated })),
  ...PROVINCES.map(({ code, name }) => {
    const [rent, taxPct, price] = ELSEWHERE[code];
    return { key: `${code.toLowerCase()}-other`, name: `Elsewhere in ${name}`, province: code, rent, taxPct, price, rentEstimated: true, priceEstimated: true };
  }),
];

export const DEFAULT_CITY = 'toronto';
export const cityByKey = (key) => CITIES.find((c) => c.key === key) ?? CITIES.find((c) => c.key === DEFAULT_CITY);

/** The city a browser's time zone most likely means, to preselect. */
const ZONES = {
  'America/Vancouver': 'vancouver',
  'America/Edmonton': 'calgary',
  'America/Regina': 'regina',
  'America/Swift_Current': 'regina',
  'America/Winnipeg': 'winnipeg',
  'America/Toronto': 'toronto',
  'America/Thunder_Bay': 'thunder-bay',
  'America/Nipigon': 'thunder-bay',
  'America/Montreal': 'montreal',
  'America/Halifax': 'halifax',
  'America/Glace_Bay': 'ns-other',
  'America/Moncton': 'moncton',
  'America/St_Johns': 'st-johns',
  'America/Goose_Bay': 'nl-other',
  'America/Whitehorse': 'whitehorse',
  'America/Yellowknife': 'yellowknife',
  'America/Iqaluit': 'nu-other',
};
export function guessCity(timeZone) {
  try {
    return ZONES[timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone] ?? DEFAULT_CITY;
  } catch {
    return DEFAULT_CITY;
  }
}

/** Tax on marginal bands: [[upTo, rate], ...], the last upTo Infinity. */
function banded(amount, bands) {
  const a = Math.max(num(amount), 0);
  let tax = 0;
  let floor = 0;
  for (const [cap, rate] of bands) {
    if (a <= floor) break;
    tax += (Math.min(a, cap) - floor) * rate;
    floor = cap;
  }
  return tax;
}

const ONTARIO = (units) => [
  [55000, 0.005],
  [250000, 0.01],
  [400000, 0.015],
  [2000000, 0.02],
  [Infinity, units <= 2 ? 0.025 : 0.02],
];
const TORONTO = [
  [55000, 0.005],
  [250000, 0.01],
  [400000, 0.015],
  [2000000, 0.02],
  [3000000, 0.025],
  [4000000, 0.035],
  [5000000, 0.045],
  [10000000, 0.055],
  [20000000, 0.065],
  [Infinity, 0.075],
];
const QUEBEC = [
  [62900, 0.005],
  [315000, 0.01],
  [Infinity, 0.015],
];
const MONTREAL = [
  [62900, 0.005],
  [315000, 0.01],
  [552300, 0.015],
  [1104700, 0.02],
  [2136500, 0.025],
  [3113000, 0.035],
  [Infinity, 0.04],
];
const BC = [
  [200000, 0.01],
  [2000000, 0.02],
  [3000000, 0.03],
  [Infinity, 0.05],
];
const MANITOBA = [
  [30000, 0],
  [90000, 0.005],
  [150000, 0.01],
  [200000, 0.015],
  [Infinity, 0.02],
];

/**
 * Land transfer tax (or the registration fees that stand in for it) on a
 * purchase, before any first-buyer relief, with the city's own tax where
 * there is one (Toronto, Montréal; deed transfer tax in Nova Scotia).
 */
export function transferTax(price, { city, units = 1 } = {}) {
  const c = cityByKey(city);
  const p = Math.max(num(price), 0);
  switch (c.province) {
    case 'ON':
      return banded(p, ONTARIO(units)) + (c.key === 'toronto' ? banded(p, TORONTO) : 0);
    case 'BC':
      return banded(p, BC);
    case 'QC':
      return banded(p, c.key === 'montreal' ? MONTREAL : QUEBEC);
    case 'MB':
      return banded(p, MANITOBA);
    case 'AB':
      // No tax: Land Titles charges $50 plus $5 for each $5,000 of value.
      return p > 0 ? 50 + 5 * Math.ceil(p / 5000) : 0;
    case 'SK':
      return p * 0.003; // Land Titles transfer fee
    case 'NB':
    case 'PE':
      return p * 0.01;
    case 'NS':
      return p * 0.015; // municipal deed transfer tax, up to 1.5% (Halifax's rate)
    case 'NL':
      return p > 0 ? 100 + p * 0.004 : 0; // registration of the deed
    default:
      return p * 0.001; // territories: registration fees only
  }
}

/**
 * First-time buyer relief on that tax, as the list of programs a buyer
 * could claim. Each has the amount for this purchase (never more than the
 * tax it offsets) and its official page.
 */
export function transferRelief(price, { city, units = 1 } = {}) {
  const c = cityByKey(city);
  const p = Math.max(num(price), 0);
  const out = [];
  if (c.province === 'ON') {
    out.push({
      key: 'ltt',
      name: 'Ontario land transfer tax refund',
      amount: Math.min(banded(p, ONTARIO(units)), 4000),
      what: 'Up to $4,000 off the land transfer tax at closing. Your lawyer claims it when the sale closes.',
      url: 'https://www.ontario.ca/document/land-transfer-tax/refunds-first-time-homebuyers',
    });
    if (c.key === 'toronto')
      out.push({
        key: 'mltt',
        name: 'Toronto land transfer tax rebate',
        amount: Math.min(banded(p, TORONTO), 4475),
        what: 'Up to $4,475 off Toronto’s own land transfer tax, also claimed by your lawyer at closing.',
        url: 'https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/municipal-land-transfer-tax-mltt-rebate-opportunities/',
      });
  }
  if (c.province === 'BC') {
    // No tax on the first $500,000 for homes worth up to $835,000, phased out by $860,000.
    const full = banded(Math.min(p, 500000), BC);
    const amount = p <= 835000 ? full : p >= 860000 ? 0 : (full * (860000 - p)) / 25000;
    out.push({
      key: 'ptt',
      name: 'BC first-time buyers’ property transfer tax exemption',
      amount,
      what: 'No property transfer tax on the first $500,000 of a home worth up to $835,000, less up to $860,000.',
      url: 'https://www2.gov.bc.ca/gov/content/taxes/property-taxes/property-transfer-tax/exemptions/first-time-home-buyers',
    });
  }
  if (c.province === 'QC')
    out.push({
      key: 'welcome',
      name: 'Quebec credit for access to homeownership',
      amount: Math.min(banded(p, c.key === 'montreal' ? MONTREAL : QUEBEC), 5875),
      what: 'A refundable credit of up to $5,875 against the welcome tax (transfer duties) on your first home, new for 2026.',
      url: 'https://www.revenuquebec.ca/en/press-room/news/details/2026-10-06/tax-credit-for-access-to-homeownership-apply-for-an-advance-payment-today/',
    });
  if (c.province === 'PE' && p <= 200000)
    out.push({
      key: 'rptt',
      name: 'PEI first-time buyers’ transfer tax exemption',
      amount: p * 0.01,
      what: 'No real property transfer tax for first-time buyers on a home up to $200,000.',
      url: 'https://www.princeedwardisland.ca/en/information/finance/real-property-transfer-tax',
    });
  return out.filter((r) => r.amount > 0);
}

/** Provincial first-home tax credits (non-refundable), on top of the federal $1,500. */
export function provincialHomeCredit(province) {
  if (province === 'QC')
    return {
      key: 'qc-hbtc',
      name: 'Quebec home buyers’ tax credit',
      amount: 1400,
      what: 'Claim $10,000 on your Quebec return the year you buy, which takes $1,400 off your provincial tax.',
      url: 'https://www.revenuquebec.ca/en/citizens/tax-credits/home-buyers-tax-credit/',
    };
  if (province === 'SK')
    return {
      key: 'sk-hbtc',
      name: 'Saskatchewan first-time homebuyers’ tax credit',
      amount: 1050,
      what: 'Claim $10,000 on your Saskatchewan return the year you buy, which takes about $1,050 off your provincial tax.',
      url: 'https://www.saskatchewan.ca/residents/taxes-and-investments',
    };
  return null;
}

/** Provinces that charge sales tax on the mortgage insurance premium, due in cash at closing. */
export const PREMIUM_TAX = { ON: 0.08, QC: 0.09, SK: 0.06 };

// Income tax, 2026: [basic personal amount, bands]. Federal brackets are the
// CRA's; provincial ones are 2025's indexed where the province indexes.
const FEDERAL = [
  16452,
  [
    [58523, 0.14],
    [117045, 0.205],
    [181440, 0.26],
    [258482, 0.29],
    [Infinity, 0.33],
  ],
];
const PROVINCIAL = {
  BC: [13216, [[50363, 0.056], [100728, 0.077], [115648, 0.105], [140430, 0.1229], [190405, 0.147], [265545, 0.168], [Infinity, 0.205]]],
  AB: [22769, [[61200, 0.08], [154259, 0.1], [185111, 0.12], [246813, 0.13], [370220, 0.14], [Infinity, 0.15]]],
  SK: [20381, [[54532, 0.105], [155805, 0.125], [Infinity, 0.145]]],
  MB: [15780, [[47000, 0.108], [100000, 0.1275], [Infinity, 0.174]]],
  ON: [12989, [[53891, 0.0505], [107785, 0.0915], [150000, 0.1116], [220000, 0.1216], [Infinity, 0.1316]]],
  QC: [18952, [[54345, 0.14], [108680, 0.19], [132245, 0.24], [Infinity, 0.2575]]],
  NB: [13664, [[52333, 0.094], [104666, 0.14], [193861, 0.16], [Infinity, 0.195]]],
  NS: [11932, [[30995, 0.0879], [61991, 0.1495], [97417, 0.1667], [157124, 0.175], [Infinity, 0.21]]],
  PE: [15000, [[33328, 0.095], [64656, 0.1347], [105000, 0.166], [140000, 0.1762], [Infinity, 0.19]]],
  NL: [11188, [[45076, 0.087], [90150, 0.145], [160948, 0.158], [225328, 0.178], [287858, 0.198], [575718, 0.208], [1151435, 0.213], [Infinity, 0.218]]],
  YT: [16452, [[58523, 0.064], [117045, 0.09], [181440, 0.109], [500000, 0.128], [Infinity, 0.15]]],
  NT: [18198, [[53003, 0.059], [106009, 0.086], [172346, 0.122], [Infinity, 0.1405]]],
  NU: [19659, [[55801, 0.04], [111602, 0.07], [181439, 0.09], [Infinity, 0.115]]],
};

function bracketTax(income, [bpa, bands]) {
  return Math.max(banded(income, bands) - bpa * bands[0][1], 0);
}

/**
 * Federal plus provincial income tax on an income, before most credits:
 * enough to estimate what a deduction saves. Ontario's surtax is included;
 * in Quebec the federal tax is cut by the 16.5% abatement.
 */
export function incomeTax(income, province = 'ON') {
  const i = Math.max(num(income), 0);
  let federal = bracketTax(i, FEDERAL);
  if (province === 'QC') federal *= 1 - 0.165;
  let prov = bracketTax(i, PROVINCIAL[province] ?? PROVINCIAL.ON);
  if (province === 'ON') prov += Math.max(prov - 5818, 0) * 0.2 + Math.max(prov - 7446, 0) * 0.36;
  return federal + prov;
}

/** What a deduction (an FHSA deposit) takes off this year's tax: the refund. */
export const deductionRefund = (income, amount, province) => incomeTax(income, province) - incomeTax(Math.max(num(income) - num(amount), 0), province);

/**
 * A rent table by bedrooms (the listing assumptions, set for Thunder Bay)
 * moved to another city by the ratio of the two cities' average rents.
 */
export function rentsIn(rents, cityKey) {
  const ratio = cityByKey(cityKey).rent / cityByKey('thunder-bay').rent;
  return Object.fromEntries(Object.entries(rents ?? {}).map(([beds, r]) => [beds, Math.round((num(r) * ratio) / 25) * 25]));
}
