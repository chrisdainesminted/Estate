# DSCR Deal Workbench

A personal real-estate calculator that separates **lender DSCR math (PITIA)** from **real-world cash flow (PITIA + OpEx)**, so a deal that a DSCR lender approves can't quietly lose money every month.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # finance engine unit tests
npm run build    # static site in dist/
```

Deals are saved in your browser's localStorage. The ↺ button in the header restores the three starter deals.

## What it calculates

| Metric | Formula |
|---|---|
| P&I | `P · r(1+r)^n / ((1+r)^n − 1)`, r = rate/12, n = years × 12 |
| PITIA | P&I + taxes/12 + insurance/12 + HOA |
| Lender DSCR | (gross rent × (1 − lender haircut)) ÷ PITIA |
| OpEx | gross rent × (management + maintenance + vacancy + CapEx %) |
| Real net cash flow | gross rent − PITIA − OpEx |
| Cash out of pocket | down payment + closing costs (3% default) |
| Cash-on-cash | annual net cash flow ÷ cash out of pocket |
| Year-1 paydown | principal from amortization months 1–12 |
| 10-year total return | cumulative cash flow + principal paydown + appreciation (3%/yr default) |

DSCR bands: **< 1.00** red (negative), **1.00–1.19** yellow (tight), **1.20–1.25** green (sweet spot), **> 1.25** blue (strong). DSCR is banded on the 2-decimal value shown on screen.

Additional figures: cap rate (NOI ÷ price), breakeven rent per unit, rent needed for a 1.20 DSCR, and "rent cushion" (how far rent can drop before cash flow hits $0).

## Features

- **Analyze view**: summary cards, DSCR gauge, a lender-vs-reality breakdown, and a warning banner when DSCR ≥ 1.00 but real cash flow is negative.
- **What-if sliders**: rate ±2%, down payment 15–35%, rent −15% to +25%. They apply to the active deal or all deals without changing saved inputs. Use "Apply" to commit them.
- **Compare view**: 2–3 deals side by side, with a trophy on the best value per row (ties share it) and a 10-year total-return chart.
- **10-year projection**: stacked chart or table, with optional rent growth and tax/insurance/HOA growth (both 0% by default).
- Light/dark mode (follows the OS until toggled), responsive down to phone width.

## Layout

```
src/lib/finance.js        pure calculation engine (tested in finance.test.js)
src/lib/dscr.js           DSCR bands and colors
src/lib/presets.js        default and starter deals
src/hooks/useDeals.js     deal state + localStorage
src/components/*          UI sections
```

Estimates for personal analysis only. Not lending or investment advice.
