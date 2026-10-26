<p align="center"><img src="public/favicon.svg" width="72" alt="Bedrock logo" /></p>

# Bedrock

**Cash flow you can build on.**

Bedrock separates **lender DSCR math (PITIA)** from **real-world cash flow (PITIA + OpEx)**, so a deal a DSCR lender approves can't quietly lose money every month. The mark is stacked layers widening to a solid base: real cash flow is the layer a portfolio is built on.

Live: https://claude.ai/artifact/5KH4ZZHoZ8CvCKF5CXutGJ (private to the owner until shared).

## Run it

```bash
npm install
npm run dev             # http://localhost:5173
npm test                # finance engine unit tests
npm run build           # static site in dist/
npm run build:artifact  # page fragment + assets in dist-artifact/ for the Claude artifact host
```

Deals are always saved in the browser. On the hosted page they also sync to the viewer's private space in their Claude account, so the same deals show up on every device (newest edit wins). The ↺ button in the header starts over with the example deals, after an in-page confirmation.

## What it calculates

| Metric | Formula |
|---|---|
| P&I | `P · r(1+r)^n / ((1+r)^n − 1)`, r = rate/12, n = years × 12 |
| Interest-only | interest only for the IO period, then the balance amortizes over the remaining term |
| PITIA | debt service + taxes/12 + insurance/12 + HOA (the IO payment during an IO period) |
| Lender DSCR | (gross rent × (1 − lender haircut)) ÷ PITIA |
| OpEx | gross rent × (management + maintenance + vacancy + CapEx %) |
| Real net cash flow | gross rent − PITIA − OpEx |
| Cash invested | down payment + closing costs (3% default) + rehab |
| Lender reserves | months of PITIA held in the bank (6 by default); shown separately, not spent |
| Cash-on-cash | annual net cash flow ÷ cash invested |
| 10-year total return | cumulative cash flow + principal paydown + appreciation, before selling costs |
| Profit if sold | cash flow + sale price − selling costs (7% default) − loan payoff − cash invested |
| IRR | rate that zeroes the NPV of −cash invested, each year's cash flow, and net sale proceeds in year 10 |
| Equity multiple | (cash flow + net sale proceeds) ÷ cash invested |
| Global DSCR | total lender rent ÷ total PITIA across owned properties |
| Max offer | the lowest of each target's price ceiling, solved exactly: DSCR, cash flow per door, cash-on-cash (rent, taxes, insurance, rehab held as entered) |
| Prepayment penalty | step-down % of the balance repaid (none, 3-2-1, 5-4-3-2-1), charged on a refinance or sale inside the window |
| Cash-out refinance | new loan = value × LTV; cash out = new loan − old balance − penalty − fees; the new loan's payment carries through cash flow, sale and IRR |
| Growth plan | monthly: savings + reinvested cash flow + refinance cash; buy the chosen deal whenever cash covers cash invested plus reserves for every property |

DSCR bands: **< 1.00** red (negative), **1.00–1.19** yellow (tight), **1.20–1.25** green (sweet spot), **> 1.25** blue (strong). DSCR is banded on the 2-decimal value shown on screen.

Additional figures: cap rate (NOI ÷ price), breakeven rent per unit, rent needed for a 1.20 DSCR, and "rent cushion" (how far rent can drop before cash flow hits $0).

## Features

- **Portfolio view**: owned properties rolled up into net cash flow, global DSCR, cash-on-cash and equity today (value and loan balance rolled forward by years owned), a cash-flow-by-property chart, and "What if you buy it?", which shows how a prospect changes the whole portfolio.
- **Analyze view**: hero summary with a one-line verdict, DSCR gauge, a lender-vs-reality breakdown, a warning when DSCR ≥ 1.00 but real cash flow is negative, a 10-year projection, and what you'd walk away with if you sold in year 10.
- **What-if sliders**: rate ±2%, down payment 15–35%, rent −15% to +25%, for the open deal or every compared deal, without changing saved inputs until you apply them.
- **Compare view**: pick up to 3 deals from the library; side-by-side matrix with a trophy on the best value per row (ties share it) and a profit-if-sold-by-year chart.
- **Max offer price**: set targets (DSCR, cash flow per door, cash-on-cash) and see the most you can pay, which target sets it, and a one-click "use this price".
- **Value-add and refinance (BRRRR)**: after-repair value, a cash-out refinance in year 1–9, cash left in the deal, the new loan's DSCR and cash flow, and prepayment penalties.
- **Plan view**: cash on hand, monthly savings and a deal to repeat become a 10-year path in doors, cash flow and equity, with every purchase dated and lender reserves held throughout.
- **Deal library**: unlimited deals, each a prospect or owned, with a searchable picker. Starter deals are tagged "Example" until edited.
- **Export**: a one-page PDF deal memo (vector, Letter size) and a CSV of every deal. Ctrl+P also prints the memo.
- **Polish**: count-up numbers, a sweeping gauge needle, animated charts and staggered panels (all off under reduced motion), plain-English explanations on every metric, light/dark mode that follows the host or OS.

## Layout

```
src/lib/finance.js        calculation engine: loans, DSCR, cash flow, projection, refinance, sale/IRR, max offer, portfolio (tested)
src/lib/growth.js         growth plan simulation (tested)
src/lib/dscr.js           DSCR bands, colors and the one-line verdict
src/lib/export.js         CSV export (tested)
src/lib/memoPdf.js        PDF deal memo (jsPDF, loaded on demand)
src/lib/runtime.js        hosted-viewer capabilities with plain-browser fallbacks
src/lib/glossary.js       metric explanations used by the hover tips
src/hooks/useDeals.js     deal library: browser storage + account sync
src/components/*          UI sections
scripts/build-artifact.mjs  turns the Vite build into the hosted page
```

## Brand

- Name: Bedrock. Tagline: "Cash flow you can build on."
- Accent: emerald (`emerald-700` #047857 light, `emerald-500/600` dark) on zinc "ink" neutrals.
- Type: Geist.
- Surfaces: frosted glass cards (`.glass` in `src/index.css`) over a fixed emerald/teal aurora with a faint grid and grain. Users who turn on "reduce transparency" in their OS get solid cards instead.

Estimates for personal analysis only. Not lending or investment advice.
