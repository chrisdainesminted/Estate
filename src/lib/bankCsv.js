// Reading a bank or credit-card statement exported as CSV, so its rental
// expenses can be logged in one go. Banks lay these out differently (RBC
// names its columns, TD sends none, some split money out and money in), so
// the columns are guessed and the landlord can change the guess.

/** Rows of a CSV file: quoted fields, commas and line breaks inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field.trim());
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field.trim());
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field.trim());
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

/** A statement date as YYYY-MM-DD, or '' when it isn't one. `dayFirst` reads 03/04/2026 as 3 April. */
export function toDate(v, dayFirst = false) {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  let y;
  let mo;
  let d;
  if (m) [, y, mo, d] = m;
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) {
    [, mo, d, y] = m;
    if (dayFirst) [mo, d] = [d, mo];
    if (y.length === 2) y = `20${y}`;
  } else if ((m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(s)) || (m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s))) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const named = /^\d/.test(m[1]) ? { d: m[1], mon: m[2] } : { d: m[2], mon: m[1] };
    const idx = months.indexOf(named.mon.toLowerCase());
    if (idx < 0) return '';
    [y, mo, d] = [m[3], String(idx + 1), named.d];
  } else return '';
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A statement amount as a number: "$1,234.56", "(12.00)" and "-12.00" all read; '' and text are null. */
export function toAmount(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
  const digits = s.replace(/[^0-9.]/g, '');
  if (!/\d/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

const share = (rows, col, test) => rows.filter((r) => test(r[col])).length / Math.max(rows.length, 1);

/**
 * Which columns hold the date, the description and the money, and whether
 * the first row is a header. `amount` holds money in and out (spending as
 * negative); `debit`, when a statement splits them, holds money out.
 */
export function guessColumns(rows) {
  const width = Math.max(0, ...rows.map((r) => r.length));
  // A header row has no dates where the rows under it do.
  const header = rows.length > 1 && !rows[0].some((c) => toDate(c)) && rows.slice(1, 6).some((r) => r.some((c) => toDate(c)));
  const names = header ? rows[0].map((c) => c.toLowerCase()) : [];
  const body = (header ? rows.slice(1) : rows).slice(0, 50);
  const cols = [...Array(width).keys()];
  const named = (re) => cols.find((i) => re.test(names[i] || ''));
  const dateCol = named(/date/) ?? cols.find((i) => share(body, i, (v) => toDate(v)) > 0.8) ?? 0;
  const moneyCols = cols.filter((i) => i !== dateCol && share(body, i, (v) => v === '' || toAmount(v) !== null) > 0.9 && share(body, i, (v) => toAmount(v) !== null) > 0.2);
  const debit = named(/debit|withdraw|money out|paid out/) ?? null;
  const amount = debit != null ? null : (named(/amount|cad|\$/) ?? moneyCols.find((i) => !/balance/.test(names[i] || '')) ?? null);
  const textCols = cols.filter((i) => i !== dateCol && !moneyCols.includes(i) && share(body, i, (v) => /[a-z]/i.test(v)) > 0.5);
  const description = cols.find((i) => i !== dateCol && /description|details|payee|merchant|memo|narrative/.test(names[i] || '')) ?? textCols[0] ?? null;
  // Day first only when a date's first part can't be a month.
  const dayFirst = body.some((r) => {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(String(r[dateCol] ?? ''));
    return m && Number(m[1]) > 12;
  });
  return { header, date: dateCol, description, amount, debit, dayFirst, width, names: header ? rows[0] : cols.map((i) => `Column ${i + 1}`) };
}

/** A T776 line suggested from what a statement line says; 'other' when nothing fits. */
const RULES = [
  ['propertyTax', /property tax|city of|municipal|town of|tax levy|ville de/i],
  ['insurance', /insur|assurance|intact|aviva|wawanesa|cooperators|co-operators|desjardins gen|td insurance|square one/i],
  ['interest', /interest|mortgage int|service charge|bank fee|monthly fee|nsf/i],
  ['utilities', /hydro|enbridge|fortis|epcor|enmax|atco|bc hydro|water|sewer|utilit|electric|natural gas|union gas|tbhydro|synergy|toronto hydro|telus|bell|rogers|shaw|internet/i],
  ['repairs', /home depot|rona|lowe|canadian tire|home hardware|kent|plumb|electrical|repair|maint|hvac|furnace service|roof|paint|lock|appliance|clean|landscap|snow|pest|exterminat/i],
  ['advertising', /kijiji|facebook ads|rentals\.ca|padmapper|zumper|advert|marketplace/i],
  ['professional', /lawyer|legal|law office|notary|accountant|cpa|bookkeep|paralegal|landlord and tenant board|ltb/i],
  ['management', /property manage|management fee/i],
  ['office', /staples|office|postage|canada post|stationery/i],
  ['vehicle', /esso|petro|shell|husky|gas station|fuel|parking/i],
];
export function guessCategory(description) {
  const s = String(description ?? '');
  return RULES.find(([, re]) => re.test(s))?.[0] ?? 'other';
}

/**
 * The statement's money going out, as candidate expenses: { key, date,
 * amount, description, category, duplicate }. `spendingPositive` is for
 * statements (often credit cards) that show purchases as positive amounts.
 * `existing` expenses mark the ones already logged (same date and amount).
 */
export function statementExpenses(rows, cols, { spendingPositive = false, existing = [] } = {}) {
  const body = cols.header ? rows.slice(1) : rows;
  const seen = new Set(existing.map((e) => `${e.date}|${Math.round(Number(e.amount) * 100)}`));
  const out = [];
  body.forEach((r, i) => {
    const date = toDate(r[cols.date], cols.dayFirst);
    if (!date) return;
    let amount = null;
    if (cols.debit != null) amount = toAmount(r[cols.debit]);
    else if (cols.amount != null) {
      const a = toAmount(r[cols.amount]);
      if (a != null) amount = spendingPositive ? a : -a;
    }
    amount = amount == null ? null : Math.round(amount * 100) / 100;
    if (!(amount > 0)) return; // money in, or nothing
    const description = cols.description != null ? String(r[cols.description] ?? '').slice(0, 120) : '';
    out.push({ key: `${i}`, date, amount, description, category: guessCategory(description), duplicate: seen.has(`${date}|${Math.round(amount * 100)}`) });
  });
  return out.slice(0, 1000);
}
