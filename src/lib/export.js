// CSV export of the deal library. Pure string building; saving the file
// goes through saveFile() in runtime.js.

const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : '');
const pct2 = (v) => (Number.isFinite(v) ? Math.round(v * 10000) / 100 : '');

const COLUMNS = [
  ['Deal', (x) => x.deal.name],
  ['Address', (x) => x.deal.address ?? ''],
  ['Status', (x) => (x.deal.status === 'owned' ? 'Owned' : 'Prospect')],
  ['Rules', (x) => (x.deal.country === 'ca' ? 'Canada (Ontario)' : 'US')],
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
  ['Land transfer tax', (x) => (x.a.landTransferTax ? r2(x.a.landTransferTax) : '')],
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
  ['Max offer at targets', (x) => (Number.isFinite(x.offer?.price) ? r2(x.offer.price) : '')],
  ['After-repair value', (x) => (Number(x.deal.arv) > 0 ? r2(Number(x.deal.arv)) : '')],
  ['Prepayment penalty', (x) => x.deal.prepay || 'none'],
  ['Refinance year', (x) => (x.refi ? x.refi.year : '')],
  ['Cash out at refinance', (x) => (x.refi ? r2(x.refi.cashOut) : '')],
  ['Cash left in deal', (x) => r2(x.refi ? x.refi.cashLeft : x.a.cashInvested)],
  ['Profit if sold yr 10', (x) => r2(x.sale.profit)],
  ['IRR %', (x) => pct2(x.sale.irr)],
  ['Equity multiple', (x) => r2(x.sale.equityMultiple)],
  ['Listing link', (x) => x.deal.listingUrl ?? ''],
  ['Notes', (x) => x.deal.notes ?? ''],
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
