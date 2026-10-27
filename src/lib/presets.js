// Starter deals mirroring the brief's comparison example. All editable.

export const UNIT_TYPES = [
  { key: 'sfh', label: 'Single Family', units: 1 },
  { key: 'duplex', label: 'Duplex', units: 2 },
  { key: 'triplex', label: 'Triplex', units: 3 },
  { key: 'fourplex', label: 'Fourplex', units: 4 },
  { key: 'multiplex', label: 'Multiplex (5+)', units: 6 },
];

// The library is unlimited; this caps how many deals sit side by side in Compare.
export const MAX_COMPARE = 3;

export const DEFAULT_DEAL = {
  name: 'New Deal',
  price: 300000,
  downPct: 25,
  rate: 7,
  termYears: 30,
  closingPct: 3,
  unitType: 'sfh',
  units: 1,
  rentPerUnit: 2400,
  taxesAnnual: 3600,
  insuranceAnnual: 1800,
  hoaMonthly: 0,
  mgmtPct: 8,
  maintPct: 5,
  vacancyPct: 5,
  capexPct: 5,
  appreciationPct: 3,
  rentGrowthPct: 0,
  expenseGrowthPct: 0,
  lenderHaircutPct: 0,
  rehabCost: 0,
  ioYears: 0,
  reserveMonths: 6,
  sellingCostPct: 7,
  status: 'prospect', // 'prospect' | 'owned'
  yearsOwned: 0,
  prepay: 'none', // key of PREPAY_SCHEDULES
  arv: 0, // after-repair value; 0 means no value-add
  refiEnabled: false,
  refiYear: 1,
  refiLtv: 75,
  refiRate: 7.25,
  refiTermYears: 30,
  refiCostPct: 2,
  address: '',
  listingUrl: '',
  notes: '',
};

export const PRESET_DEALS = [
  {
    ...DEFAULT_DEAL,
    name: '$250k Single-Family',
    price: 250000,
    rentPerUnit: 2100,
    taxesAnnual: 3000,
    insuranceAnnual: 1500,
  },
  {
    ...DEFAULT_DEAL,
    name: '$500k Duplex',
    price: 500000,
    unitType: 'duplex',
    units: 2,
    rentPerUnit: 2150,
    taxesAnnual: 6000,
    insuranceAnnual: 2400,
  },
  {
    ...DEFAULT_DEAL,
    name: '$500k Fourplex',
    price: 500000,
    unitType: 'fourplex',
    units: 4,
    rentPerUnit: 1350,
    taxesAnnual: 6500,
    insuranceAnnual: 3600,
    mgmtPct: 10,
  },
];

// Example properties already owned, so the Portfolio view has something to roll up.
export const PRESET_OWNED = [
  {
    ...DEFAULT_DEAL,
    name: 'Maple St Duplex',
    status: 'owned',
    yearsOwned: 3,
    price: 340000,
    unitType: 'duplex',
    units: 2,
    rate: 4.75,
    rentPerUnit: 1650,
    taxesAnnual: 4300,
    insuranceAnnual: 2100,
  },
  {
    ...DEFAULT_DEAL,
    name: 'Oak Ave Single-Family',
    status: 'owned',
    yearsOwned: 5,
    price: 215000,
    downPct: 20,
    rate: 3.875,
    rentPerUnit: 1850,
    taxesAnnual: 2700,
    insuranceAnnual: 1400,
  },
];

let counter = 0;
export function newId() {
  counter += 1;
  return `deal-${Date.now().toString(36)}-${counter}`;
}

export function makeDeal(overrides = {}) {
  return { ...DEFAULT_DEAL, ...overrides, id: newId() };
}
