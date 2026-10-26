// CSV export of the deal library. Pure string building; saving the file
// goes through saveFile() in runtime.js.

const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : '');
const pct2 = (v) => (Number.isFinite(v) ? Math.round(v * 10000) / 100 : '');

const COLUMNS = [
  ['Deal', (x) => x.deal.name],
  ['Status', (x) => (x.deal.status === 'owned' ? 'Owned' : 'Prospect')],
  ['Years owned', (x) => (x.deal.status === 'owned' ? r2(Number(x.deal.yearsOwned) || 0) : '')],
  ['Purchase price', (x) => r2(x.a.price)],
  ['Units', (x) => x.a.units],
  ['Rent per unit /mo', (x) => r2(Number(x.deal.rentPerUnit))],
  ['Gross rent /mo', (x) => r2(x.a.grossRent)],
  ['Down payment %', (x) => r2(Number(x.deal.downPct))],
  ['Interest rate %', (x) => r2(Number(x.deal.rate))],
  ['Term (years)', (x) => Number(x.deal.termYears)],
  ['Interest-only (years)', (x) => x.a.ioYears],
  ['Closing costs', (x) => r2(x.a.closingCosts)],
  ['Rehab', (x) => r2(x.a.rehab)],
  ['Taxes /yr', (x) => r2(Number(x.deal.taxesAnnual))],
  ['Insurance /yr', (x) => r2(Number(x.deal.insuranceAnnual))],
  ['HOA /mo', (x) => r2(Number(x.deal.hoaMonthly))],
  ['PITIA /mo', (x) => r2(x.a.pitia)],
  ['OpEx /mo', (x) => r2(x.a.opex.total)],
  ['Net cash flow /mo', (x) => r2(x.a.netCashFlow)],
  ['DSCR', (x) => (Number.isFinite(x.a.dscr) ? r2(x.a.dscr) : '')],
  ['DSCR band', (x) => x.a.status.label],
  ['Cash-on-cash %', (x) => pct2(x.a.coc)],
  ['Cap rate %', (x) => pct2(x.a.capRate)],
  ['Cash invested', (x) => r2(x.a.cashInvested)],
  ['Reserves to hold', (x) => r2(x.a.reserves)],
  ['Year-10 equity', (x) => r2(x.rows[x.rows.length - 1].equity)],
  ['Profit if sold yr 10', (x) => r2(x.sale.profit)],
  ['IRR %', (x) => pct2(x.sale.irr)],
  ['Equity multiple', (x) => r2(x.sale.equityMultiple)],
];

function cell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Items are { deal, a, rows, sale } as built in App. */
export function dealsToCsv(items) {
  const lines = [COLUMNS.map(([h]) => cell(h)).join(',')];
  items.forEach((x) => lines.push(COLUMNS.map(([, get]) => cell(get(x))).join(',')));
  return `${lines.join('\r\n')}\r\n`;
}
