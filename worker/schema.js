// What each kind of landlord record may hold. Anything not listed is
// dropped; text is trimmed to its length; numbers are kept finite. The
// public forms (apply, report a repair) take only their own short lists.

export const T776 = [
  { key: 'advertising', line: '8521', label: 'Advertising' },
  { key: 'insurance', line: '8690', label: 'Insurance' },
  { key: 'interest', line: '8710', label: 'Interest and bank charges' },
  { key: 'office', line: '8810', label: 'Office expenses' },
  { key: 'professional', line: '8860', label: 'Legal, accounting and other professional fees' },
  { key: 'management', line: '8871', label: 'Management and administration fees' },
  { key: 'repairs', line: '8960', label: 'Repairs and maintenance' },
  { key: 'salaries', line: '9060', label: 'Salaries, wages and benefits' },
  { key: 'propertyTax', line: '9180', label: 'Property taxes' },
  { key: 'travel', line: '9200', label: 'Travel' },
  { key: 'utilities', line: '9220', label: 'Utilities' },
  { key: 'vehicle', line: '9281', label: 'Motor vehicle expenses' },
  { key: 'other', line: '9270', label: 'Other expenses' },
];

export const PROPERTY_TYPES = [
  { key: 'house', label: 'House' },
  { key: 'semi', label: 'Semi-detached' },
  { key: 'townhouse', label: 'Townhouse' },
  { key: 'condo', label: 'Condo' },
  { key: 'apartment', label: 'Apartment' },
  { key: 'suite', label: 'Basement or in-law suite' },
  { key: 'room', label: 'Room' },
  { key: 'duplex', label: 'Duplex' },
  { key: 'triplex', label: 'Triplex' },
  { key: 'fourplex', label: 'Fourplex' },
  { key: 'other', label: 'Other' },
];

const text = (max) => ({ type: 'text', max });
const num = { type: 'number' };
const bool = { type: 'boolean' };
const oneOf = (...values) => ({ type: 'enum', values });
const date = { type: 'date' }; // YYYY-MM-DD
const month = { type: 'month' }; // YYYY-MM
const when = { type: 'datetime' }; // ISO 8601 with time

export const SCHEMAS = {
  settings: {
    name: text(80),
    email: text(120),
    phone: text(40),
    city: text(40),
    signature: text(300),
  },
  listings: {
    kind: oneOf('rent', 'sale'),
    title: text(120),
    city: text(40), // a key in src/lib/canada.js CITIES, for the public search
    propertyType: oneOf(...PROPERTY_TYPES.map((t) => t.key)),
    unitId: text(40),
    area: text(120), // shown publicly: a neighbourhood or street, not the full address
    address: text(200), // private: shared once a viewing is confirmed
    rent: num,
    beds: num,
    baths: num,
    available: date,
    utilities: text(200),
    parking: text(120),
    details: text(3000),
    active: bool,
    public: bool, // shown on Bedrock's public listings, not only by its link
    price: num, // asking price, for a home for sale
    sqft: num,
    lot: text(60),
    taxes: num, // property tax a year
    yearBuilt: num,
  },
  slots: {
    listingId: text(40),
    start: when,
    minutes: num,
    status: oneOf('open', 'held', 'booked'),
    applicationId: text(40),
  },
  applications: {
    listingId: text(40),
    name: text(100),
    email: text(120),
    phone: text(40),
    moveIn: date,
    people: num,
    message: text(2000),
    slotId: text(40),
    status: oneOf('new', 'viewing', 'approved', 'declined', 'withdrawn'),
    note: text(1000), // the landlord's note, shown on the applicant's status page
    read: bool,
  },
  units: {
    label: text(80),
    address: text(200),
    rent: num,
    dueDay: num,
    tenantName: text(100),
    tenantEmail: text(120),
    tenantPhone: text(40),
    leaseStart: date,
    leaseEnd: date,
    deposit: num,
    lastIncrease: date,
    notes: text(2000),
  },
  payments: {
    unitId: text(40),
    month,
    amount: num,
    paidOn: date,
    method: text(40),
    note: text(300),
  },
  maintenance: {
    unitId: text(40),
    title: text(120),
    details: text(3000),
    urgency: oneOf('low', 'normal', 'urgent'),
    status: oneOf('reported', 'scheduled', 'fixed'),
    reportedBy: text(100),
    contact: text(120),
    entryOk: bool,
    scheduledFor: when,
    cost: num,
    fixedOn: date,
    notes: text(2000),
    read: bool,
  },
  messages: {
    applicationId: text(40),
    from: oneOf('landlord', 'applicant'),
    body: text(4000),
    read: bool, // by the other side
  },
  expenses: {
    date,
    amount: num,
    category: oneOf(...T776.map((c) => c.key)),
    unitId: text(40),
    vendor: text(120),
    note: text(300),
  },
};

export const COLLECTIONS = Object.keys(SCHEMAS);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

function cleanValue(rule, v) {
  switch (rule.type) {
    case 'text':
      return typeof v === 'string' ? v.trim().slice(0, rule.max) : undefined;
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, -1e9), 1e9) : undefined;
    case 'boolean':
      return typeof v === 'boolean' ? v : undefined;
    case 'enum':
      return rule.values.includes(v) ? v : undefined;
    case 'date':
      return typeof v === 'string' && DATE.test(v) ? v : v === '' ? '' : undefined;
    case 'month':
      return typeof v === 'string' && MONTH.test(v) ? v : undefined;
    case 'datetime':
      return typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined;
    default:
      return undefined;
  }
}

/** A record's fields kept to its schema. `only` limits which fields are accepted (for public forms). */
export function clean(collection, input, only) {
  const schema = SCHEMAS[collection];
  const out = {};
  if (!schema || !input || typeof input !== 'object') return out;
  for (const [k, rule] of Object.entries(schema)) {
    if (only && !only.includes(k)) continue;
    if (!(k in input)) continue;
    const v = cleanValue(rule, input[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** What an applicant may send. */
export const APPLY_FIELDS = ['name', 'email', 'phone', 'moveIn', 'people', 'message'];
/** What a tenant may send when reporting a repair. */
export const REPAIR_FIELDS = ['title', 'details', 'urgency', 'reportedBy', 'contact', 'entryOk'];

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
