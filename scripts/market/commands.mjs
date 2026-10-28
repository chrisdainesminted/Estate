// The daily run's two commands, shared by the repo scripts and the bundled
// tool published with the page (tools/bedrock-market.mjs).
import { mergeFeed, normalizeMarket, rankListings, standouts, isNew, droppedInLatestRun } from '../../src/lib/market.js';
import { DEFAULT_TARGETS } from '../../src/lib/finance.js';
import { money, percent } from '../../src/lib/format.js';
import { parseArgs, readJson, unwrap } from './io.mjs';

/** merge <prev.json|-> <found.json> [--today YYYY-MM-DD] [--note "text"]: print the new feed. */
export function runMerge(argv) {
  const { flags, positional } = parseArgs(argv);
  const [prevPath, foundPath] = positional;
  if (!foundPath) {
    console.error('usage: merge <prev.json|-> <found.json> [--today YYYY-MM-DD] [--note "text"]');
    process.exitCode = 2;
    return;
  }
  const today = typeof flags.today === 'string' ? flags.today : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);

  const prev = unwrap(readJson(prevPath), 'listings');
  const foundJson = readJson(foundPath);
  const found = Array.isArray(foundJson) ? foundJson : (unwrap(foundJson, 'listings')?.listings ?? []);
  const { feed, stats } = mergeFeed(prev, found, { today, note: typeof flags.note === 'string' ? flags.note : '' });

  process.stdout.write(`${JSON.stringify(feed)}\n`);
  console.error(`merged ${today}: ${JSON.stringify(stats)} -> ${feed.listings.length} listings in the feed (${found.length - stats.found} rejected as incomplete)`);
}

/** score <feed.json> [bedrock.json] [--json]: rank the feed and list the standouts. */
export function runScore(argv) {
  const { flags, positional } = parseArgs(argv);
  const feed = unwrap(readJson(positional[0]), 'listings');
  if (!feed) {
    console.error('usage: score <feed.json> [bedrock.json] [--json]  (feed has no listings)');
    process.exitCode = 2;
    return;
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
}
