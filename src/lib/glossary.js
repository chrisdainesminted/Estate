// Plain-English explanations shown in hover tips next to each metric.

export const GLOSSARY = {
  dscr: {
    term: 'Lender DSCR',
    body: 'Debt service coverage ratio: monthly rent ÷ PITIA. DSCR lenders approve on this number alone, so it ignores management, repairs, vacancy and CapEx.',
  },
  globalDscr: {
    term: 'Global DSCR',
    body: 'Total rent across every property ÷ total PITIA. Lenders look at this when you apply for your next loan.',
  },
  pitia: {
    term: 'PITIA',
    body: 'Principal, interest, taxes, insurance and HOA: the monthly payment a lender underwrites.',
  },
  opex: {
    term: 'Operating expenses',
    body: 'Costs the lender ignores but you still pay: property management, maintenance, a vacancy reserve and a CapEx reserve, each as a % of rent.',
  },
  netCashFlow: {
    term: 'Real net cash flow',
    body: 'Rent − PITIA − operating expenses. What actually lands in your account each month.',
  },
  coc: {
    term: 'Cash-on-cash return',
    body: 'Annual net cash flow ÷ cash invested (down payment + closing costs + rehab). Ignores appreciation and paydown.',
  },
  cashInvested: {
    term: 'Cash invested',
    body: 'Down payment + closing costs + rehab budget: the money you actually spend to get the deal running.',
  },
  reserves: {
    term: 'Lender reserves',
    body: 'Months of PITIA most DSCR lenders want you to hold in the bank at closing. You keep it, but it has to be available.',
  },
  capRate: {
    term: 'Cap rate',
    body: 'Net operating income ÷ price. NOI is rent minus OpEx, taxes, insurance and HOA, before any loan payment, so it compares properties regardless of financing.',
  },
  breakevenRent: {
    term: 'Breakeven rent',
    body: 'Rent per unit at which real net cash flow is exactly $0.',
  },
  rentFor120: {
    term: 'Rent for 1.20 DSCR',
    body: 'Rent per unit needed to reach the 1.20 DSCR many lenders treat as their comfort zone.',
  },
  rentCushion: {
    term: 'Rent cushion',
    body: 'How far rent can fall before cash flow hits $0. Higher means more room for a bad year.',
  },
  paydown: {
    term: 'Principal paydown',
    body: 'Loan principal paid off by your tenants through the mortgage payment. Zero during an interest-only period.',
  },
  totalReturn: {
    term: 'Total return (before sale)',
    body: 'Cumulative cash flow + principal paydown + appreciation. Paper wealth: it ignores the cost of actually selling.',
  },
  profitIfSold: {
    term: 'Profit if sold',
    body: 'Total cash flow + sale price − selling costs − loan payoff − cash invested. What you would actually walk away with.',
  },
  irr: {
    term: 'IRR',
    body: 'Internal rate of return: the annual return that accounts for when each dollar arrives, from today’s investment to the year-10 sale.',
  },
  equityMultiple: {
    term: 'Equity multiple',
    body: 'Everything you get back (cash flow + net sale proceeds) ÷ cash invested. 2.0× means you doubled your money.',
  },
  ltv: {
    term: 'LTV',
    body: 'Loan-to-value: loan balance ÷ property value.',
  },
  interestOnly: {
    term: 'Interest-only period',
    body: 'Many DSCR loans let you pay only interest for the first 5–10 years. DSCR is calculated on that lower payment, and the payment rises when it ends.',
  },
  maxOffer: {
    term: 'Max offer price',
    body: 'Each target sets its own price ceiling: pay more and that target is missed. Your offer is the lowest ceiling, so every target you switched on is met.',
  },
  arv: {
    term: 'After-repair value (ARV)',
    body: 'What the property is worth once the rehab is done. Bedrock grows value from here instead of the price, so a good rehab shows up as equity.',
  },
  refinance: {
    term: 'Cash-out refinance',
    body: 'A new, larger loan based on the property’s current value. It pays off the old loan (plus any prepayment penalty and fees) and hands you the rest in cash.',
  },
  cashLeft: {
    term: 'Cash left in the deal',
    body: 'Cash invested minus the cash you pulled out when you refinanced. At $0 or below you have all your money back and still own the property.',
  },
  prepay: {
    term: 'Prepayment penalty',
    body: 'Many DSCR loans charge a fee for paying the loan off early, stepping down each year: 5-4-3-2-1 means 5% of the balance in year 1, 4% in year 2, and none after year 5.',
  },
  equity: {
    term: 'Equity',
    body: 'Estimated property value − loan balance. For owned properties, value and balance are rolled forward by years owned.',
  },
};
