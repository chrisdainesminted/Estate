<p align="center"><img src="public/favicon.svg" width="72" alt="Bedrock logo" /></p>

# Bedrock

**Cash flow you can build on.**

Bedrock separates **lender DSCR math (PITIA)** from **real-world cash flow (PITIA + OpEx)**, so a deal a DSCR lender approves can't quietly lose money every month. The mark is stacked layers widening to a solid base: real cash flow is the layer a portfolio is built on.

- Website: https://bedrock.signia83.workers.dev/ (public; deals are saved in each visitor's browser)
- Claude page: https://claude.ai/artifact/5KH4ZZHoZ8CvCKF5CXutGJ (private to the owner; deals sync to their Claude account, Second opinion, and the morning listings run saves here)

The website is the same app, served by Cloudflare as a static-assets Worker. Cloudflare builds it from the default branch on every push with `npm test && npm run build`, then `npx wrangler deploy` publishes `dist/` as set in `wrangler.jsonc`, so a failing test stops a deploy and the last good version stays up. Outside Claude it reads Thunder Bay listings from `public/data/thunderbay.json`, which is published with the site.

## Run it

```bash
npm install
npm run dev             # http://localhost:5173
npm test                # finance engine unit tests
npm run build           # static site in dist/
npm run build:artifact  # page fragment + assets in dist-artifact/ for the Claude artifact host
```

Deals are always saved in the browser. On the hosted page they also sync to the viewer's private space in their Claude account, so the same deals show up on every device (newest edit wins). The ↺ button in the header starts over with the example deals, after an in-page confirmation, and you can undo it.

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
| Today's figures (owned) | value and loan balance rolled forward by years owned; the payment due now (after an IO period ends or a refinance) drives today's PITIA, DSCR and cash flow |
| Depreciation | ((price + closing costs) × (1 − land share) + rehab) ÷ 27.5 years, residential straight-line |
| Taxable rental income | rent collected − management, maintenance, taxes, insurance, HOA − mortgage interest − depreciation (CapEx reserves aren't deducted in the year they're saved) |
| After-tax cash flow | cash flow − taxable income × your rate; a loss lowers tax only if you can use rental losses, otherwise it carries forward |
| Stress test | the deal re-run for rent −15% to +15% against rate −1 to +2 points; break-even rate solved by bisection |
| Canadian mortgage | the quoted rate compounds semi-annually: monthly rate = (1 + r/2)^(1/6) − 1 |
| Ontario land transfer tax | 0.5% to $55k, 1% to $250k, 1.5% to $400k, 2% above (2.5% over $2M for one or two homes), added to closing costs |
| Capital cost allowance (Canada) | 4% of the Class 1 cost (building share of price + closing, plus rehab), capped so it never creates or deepens a rental loss |

DSCR bands: **< 1.00** red (negative), **1.00–1.19** yellow (tight), **1.20–1.25** green (sweet spot), **> 1.25** blue (strong). DSCR is banded on the 2-decimal value shown on screen.

Additional figures: cap rate (NOI ÷ price), breakeven rent per unit, rent needed for a 1.20 DSCR, and "rent cushion" (how far rent can drop before cash flow hits $0).

## Features

- **Portfolio view**: owned properties rolled up into today's net cash flow, global DSCR, cash-on-cash and equity (value, loan balance and payment rolled forward by years owned), what you'd net if you sold everything in 10 years, a cash-flow-by-property chart, and "What if you buy it?", which shows how a prospect changes the whole portfolio.
- **Analyze view**: one summary card answers "is this a good deal?" in a plain sentence (what a lender would say and what your bank account would see, plus the break-even rent), then four numbers that each say what they mean: the lender check (DSCR, with where it sits among the lender bands), monthly cash flow, cash-on-cash return and the cash you put in. Below it every part of the analysis folds down to one line with its key number and a plain explanation: where the rent goes, the most you should pay, a what-if, the stress test, the 10-year outlook, a refinance, selling in year 10, taxes and a second opinion. Open one to see how the number adds up, or open them all; the page remembers which you left open.
- **Stress test**: a 7×7 heatmap of rent against rate, in cash flow or DSCR, with the break-even rate and rent. Click any cell to load it as the what-if.
- **Taxes, year 1**: depreciation, mortgage interest and operating costs become taxable income, then after-tax cash flow and cash-on-cash, using your tax rate, the land share of the price and whether you can use rental losses.
- **Loan schedule**: a third projection view with yearly payments, interest, principal and balance, noting when interest-only ends or a refinance happens.
- **Second opinion** (hosted page): Claude reviews the open deal like an underwriter: a verdict, the biggest risks, assumptions to check and a negotiation angle based on your max offer. It runs on the viewer's own Claude account and asks before the first request.
- **What-if sliders**: rate ±2%, down payment 15–35%, rent −15% to +25%, for the open deal or every compared deal, without changing saved inputs until you apply them.
- **Compare view**: pick up to 3 deals from the library; an "in short" note says which keeps the most each month, which a lender would approve most easily and which makes the most if sold; then a side-by-side matrix with a trophy on the best value per row (ties share it) and a profit-if-sold-by-year chart.
- **Max offer price**: set targets (DSCR, cash flow per door, cash-on-cash) and see the most you can pay, which target sets it, and a one-click "use this price".
- **Value-add and refinance (BRRRR)**: after-repair value, a cash-out refinance in year 1–9, cash left in the deal, the new loan's DSCR and cash flow, and prepayment penalties.
- **Plan view**: cash on hand, monthly savings and a deal to repeat become a 10-year path in doors, cash flow and equity, with every purchase dated and lender reserves held throughout.
- **Listings (Thunder Bay)**: every morning a scheduled Claude run searches public listing sites for Thunder Bay properties for sale and saves them to the page's database. The Listings tab ranks them by cash flow per door under your assumptions (financing, costs, a rent table for units without stated rents), sums each one up in a sentence (cash per door, the lender's view, asking against your max offer), flags new listings and price drops, keeps the full numbers a tap away under Details, and opens any listing as a full deal. Your phone gets a notification when a new or cheaper listing beats all your targets.
- **Canadian rules**: any deal can switch to Canada (Ontario): semi-annual mortgage compounding, land transfer tax in closing costs, CCA in the tax card, condo fees and owner-paid utilities in place of HOA. Deals added from Listings are Canadian, and new deals follow the open deal's rules.
- **Deal library**: unlimited deals, each a prospect or owned, with a searchable picker. Each deal can carry an address, a listing link and notes, which search, the CSV and the PDF memo include. Starter deals are tagged "Example" until edited.
- **Search** (Ctrl K, or ⌘K on a Mac): open any deal, view or section, or run an action such as export, duplicate or new deal.
- **Undo instead of "are you sure?"**: deleting a deal, applying a what-if, using the max-offer price and starting over each show an Undo button for a few seconds.
- **Phones**: deal inputs open in a slide-up sheet from an "Edit deal" button, and the header stays compact. First-time visitors get a short welcome card.
- **Export**: a one-page PDF deal memo (vector, Letter size) and a CSV of every deal. Ctrl+P also prints the memo.
- **Plain language**: every headline number carries a sentence saying what it means for this deal (`src/lib/explain.js`), and the (i) tips keep the textbook definitions (open on hover, tap or keyboard focus; Escape closes).
- **Polish**: count-up numbers, animated charts and staggered panels (all off under reduced motion), light/dark mode that follows the host or OS.
- **Accessibility**: no axe-core violations in either theme on phones or desktop, across every view, the search palette, the edit sheet, menus, dialogs and tips. Every control works by keyboard, and scrollable tables can be focused and scrolled.
- **Speed**: views and charts load on demand, so the first load is about 124 KB of gzipped JavaScript (215 KB before). The PDF libraries load only when you export.

## Layout

```
src/lib/finance.js        calculation engine: loans, DSCR, cash flow, projection, refinance, sale/IRR, max offer, portfolio (tested)
src/lib/growth.js         growth plan simulation (tested)
src/lib/dscr.js           DSCR bands, colors and the one-line verdict
src/lib/export.js         CSV export (tested)
src/lib/memoPdf.js        PDF deal memo (jsPDF, loaded on demand)
src/lib/runtime.js        hosted-viewer capabilities with plain-browser fallbacks
src/lib/glossary.js       metric explanations used by the hover tips
src/lib/opinion.js        second-opinion prompt and reply parser (tested)
src/lib/explain.js        plain-language meanings for the numbers on screen (tested)
src/lib/market.js         daily listings: cleaning, merging, listing → deal, ranking, standouts (tested)
src/hooks/useDeals.js     deal library: browser storage + account sync, snapshots for undo
src/hooks/useExports.js   PDF and CSV export with status toasts
src/hooks/useMarket.js    the saved listings feed, live from the page's database
src/components/Section.jsx fold-down sections: one line with the key number and its meaning, detail on demand
src/components/*          UI sections, plus the search palette, phone sheet and toasts
src/views/CompareView.jsx compare view (loaded on demand)
src/views/ListingsView.jsx listings tab (loaded on demand)
scripts/market/           the daily run: RUNBOOK.md, merge.mjs (fold findings into the feed), score.mjs (rank and pick standouts)
scripts/build-artifact.mjs  turns the Vite build into the hosted page
wrangler.jsonc            Cloudflare config for the website (serves dist/)
```

## Daily listings

A scheduled task runs every morning at about 6 am Eastern in a fresh cloud session and follows `scripts/market/RUNBOOK.md`:

1. Read the saved feed (`data/users/<owner>/thunderbay`) and the owner's settings from the page's database.
2. Search the web for Thunder Bay listings (no page scraping) and write what each result states to `found.json`. Only real listings count: each needs the link to its own listing page, copied from the search result (its address names the street number and street), and anything shown sold, expired or with conflicting prices is left out. Saved listings are searched again every few days to confirm they're still for sale.
3. `node scripts/market/merge.mjs prev.json found.json --today YYYY-MM-DD > next.json` keeps first-seen dates, records price changes, turns away any listing without its own page, and drops listings not confirmed for a week or reported sold or gone.
4. Save `next.json` back with a version check, then `node scripts/market/score.mjs next.json bedrock.json` ranks everything and lists standouts for the phone notification.

The page does the full analysis live, so changing an assumption re-ranks the list straight away.

At about 6:34 am a second scheduled step, running in a session that has this repository checked out, copies the saved feed into `public/data/thunderbay.json` and pushes it. Cloudflare rebuilds the website from that push, so its Listings tab shows the same morning list. (The 6 am run itself can't push: scheduled runs start without repository access.)

## Brand

- Name: Bedrock. Tagline: "Cash flow you can build on."
- Accent: emerald (`emerald-700` #047857 light, `emerald-500/600` dark) on zinc "ink" neutrals.
- Type: Geist.
- Surfaces: frosted glass cards (`.glass` in `src/index.css`) over a fixed emerald/teal aurora with a faint grid and grain. Users who turn on "reduce transparency" in their OS get solid cards instead.

Estimates for personal analysis only. Not lending or investment advice.
