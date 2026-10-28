#!/usr/bin/env node
// Rank the feed with the owner's saved assumptions and targets, and list the standouts.
//   node scripts/market/score.mjs <feed.json> [bedrock.json] [--json]
// bedrock.json is the owner's library document (its settings hold targets and listing assumptions).
import { DEFAULT_TARGETS } from '../../src/lib/finance.js';
import { normalizeMarket, rankListings, standouts, isNew, droppedInLatestRun } from '../../src/lib/market.js';
import { money, percent } from '../../src/lib/format.js';
import { parseArgs, readJson, unwrap } from './io.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const feed = unwrap(readJson(positional[0]), 'listings');
if (!feed) {
  console.error('usage: score.mjs <feed.json> [bedrock.json] [--json]  (feed has no listings)');
  process.exit(2);
}
const settings = unwrap(readJson(positional[1]), 'settings')?.settings ?? {};
const market = normalizeMarket(settings.market);
const targets = { ...DEFAULT_TARGETS, ...(settings.targets ?? {}) };

const ranked = rankListings(feed.listings, market, targets);
const best = standouts(feed, market, targets);
const line = (s) => ({
  address: s.listing.address,
  price: s.a.price,
  units: s.a.units,
  cashFlowPerDoor: Math.round(s.perDoor),
  dscr: Math.round(s.a.dscr * 100) / 100,
  cashOnCash: Math.round(s.a.coc * 1000) / 10,
  rents: s.rentSource,
  url: s.listing.url,
  new: isNew(s.listing, feed),
  priceDrop: droppedInLatestRun(s.listing, feed) ? s.drop : 0,
});

if (flags.json) {
  process.stdout.write(`${JSON.stringify({ lastRun: feed.lastRun, ranked: ranked.map(line), standouts: best.map(line) }, null, 1)}\n`);
} else {
  const r = feed.lastRun ?? {};
  const on = [targets.useDscr && `DSCR ≥ ${targets.dscr}`, targets.useCashFlow && `$${targets.cashFlowPerDoor}/door`, targets.useCoc && `${targets.coc}% cash-on-cash`].filter(Boolean).join(', ');
  console.log(`Run ${r.date}: ${r.found} found, ${r.added} new, ${r.priceDrops} price drops; ${feed.listings.length} in the feed, ${ranked.length} ranked.`);
  console.log(`Assumptions: ${market.downPct}% down, ${market.rate}% over ${market.amortYears} years. Targets: ${on || 'none'}.\n`);
  ranked.forEach((s, i) => {
    const flagsText = [isNew(s.listing, feed) && 'NEW', droppedInLatestRun(s.listing, feed) && `DROP ${money(s.drop)}`, s.meets && 'meets targets'].filter(Boolean).join(' · ');
    console.log(
      `${String(i + 1).padStart(2)}. ${money(s.perDoor, { signed: true }).padStart(7)}/door  DSCR ${s.a.dscr.toFixed(2)}  CoC ${percent(s.a.coc, 1).padStart(6)}  ${money(s.a.price).padStart(10)}  ${s.a.units}u  rents ${s.rentSource.padEnd(9)} ${s.listing.address}${flagsText ? `  [${flagsText}]` : ''}`,
    );
  });
  console.log(`\nSTANDOUTS (beat every target, new or cheaper today): ${best.length}`);
  best.forEach((s) =>
    console.log(
      `- ${s.listing.address}: ${money(s.a.price)}, ${money(s.perDoor, { signed: true })}/door/mo, DSCR ${s.a.dscr.toFixed(2)}${s.rentSource === 'stated' ? '' : ` (rents ${s.rentSource === 'mixed' ? 'partly ' : ''}estimated)`}${s.listing.url ? `, ${s.listing.url}` : ''}`,
    ),
  );
}
