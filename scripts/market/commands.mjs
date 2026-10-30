// The daily run's two commands, shared by the repo scripts and the bundled
// tool published with the page (tools/bedrock-market.mjs).
import { HOME_MARKET, LISTING_CITIES, feedDoc, localMarket, mergeFeed, planRun, rankListings, standouts, isNew, droppedInLatestRun, lensTargets, updateIndex } from '../../src/lib/market.js';
import { cityByKey, provinceName } from '../../src/lib/canada.js';
import { DEFAULT_TARGETS } from '../../src/lib/finance.js';
import { money, percent } from '../../src/lib/format.js';
import { parseArgs, readJson, unwrap } from './io.mjs';

// Plain text for the terminal: drop the invisible word joiner money() puts after a sign.
const plainMoney = (v, opts) => money(v, opts).replace(/\u2060/g, '');

const cityFlag = (flags) => {
  const city = typeof flags.city === 'string' ? flags.city : HOME_MARKET;
  if (!LISTING_CITIES.includes(city)) throw new Error(`--city must be one of ${LISTING_CITIES.join(', ')}; got ${city}`);
  return city;
};

/** merge <prev.json|-> <found.json> [--city key] [--today YYYY-MM-DD] [--keep-days N] [--note "text"]: print the new feed. */
export function runMerge(argv) {
  const { flags, positional } = parseArgs(argv);
  const [prevPath, foundPath] = positional;
  if (!foundPath) {
    console.error('usage: merge <prev.json|-> <found.json> [--city key] [--today YYYY-MM-DD] [--keep-days N] [--note "text"]');
    process.exitCode = 2;
    return;
  }
  const today = typeof flags.today === 'string' ? flags.today : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);

  const prev = unwrap(readJson(prevPath), 'listings');
  const foundJson = readJson(foundPath);
  const found = Array.isArray(foundJson) ? foundJson : (unwrap(foundJson, 'listings')?.listings ?? []);
  const city = cityFlag(flags);
  const keepDays = Number(flags['keep-days']) > 0 ? Number(flags['keep-days']) : 7;
  const { feed, stats } = mergeFeed(prev, found, { today, city, keepDays, note: typeof flags.note === 'string' ? flags.note : '' });

  process.stdout.write(`${JSON.stringify(feed)}\n`);
  console.error(`merged ${city} ${today}: ${JSON.stringify(stats)} -> ${feed.listings.length} listings in the feed (${stats.rejected} turned away: no link to the listing's own page, or no address or price)`);
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
  const market = localMarket(settings.market, LISTING_CITIES.includes(feed.market) ? feed.market : HOME_MARKET);
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
    const counted = lensTargets(targets, market.lens);
    const on = [counted.useDscr && `DSCR ≥ ${counted.dscr}`, counted.useCashFlow && `$${counted.cashFlowPerDoor}/door`, counted.useCoc && `${counted.coc}% cash-on-cash`].filter(Boolean).join(', ');
    const loan = market.lens === 'own' ? `own money, 20% down, regular mortgage at ${market.rate}%` : `DSCR loan, ${market.dscrDownPct}% down at ${market.dscrRate}%`;
    console.log(`${cityByKey(market.city).name} run ${r.date}: ${r.found} found, ${r.added} new, ${r.priceDrops} price drops; ${feed.listings.length} in the feed, ${ranked.length} ranked.`);
    console.log(`Assumptions: ${loan}, over ${market.amortYears} years. Targets: ${on || 'none'}.\n`);
    ranked.forEach((s, i) => {
      const flagsText = [isNew(s.listing, feed) && 'NEW', droppedInLatestRun(s.listing, feed) && `DROP ${plainMoney(s.drop)}`, s.meets && 'meets targets'].filter(Boolean).join(' · ');
      console.log(
        `${String(i + 1).padStart(2)}. ${plainMoney(s.perDoor, { signed: true }).padStart(7)}/door  DSCR ${s.a.dscr.toFixed(2)}  CoC ${percent(s.a.coc, 1).padStart(6)}  ${plainMoney(s.a.price).padStart(10)}  ${s.a.units}u  rents ${s.rentSource.padEnd(9)} ${s.listing.address}${flagsText ? `  [${flagsText}]` : ''}`,
      );
    });
    console.log(`\nSTANDOUTS (beat every target, new or cheaper today): ${best.length}`);
    best.forEach((s) =>
      console.log(
        `- ${s.listing.address}: ${plainMoney(s.a.price)}, ${plainMoney(s.perDoor, { signed: true })}/door/mo, DSCR ${s.a.dscr.toFixed(2)}${s.rentSource === 'stated' ? '' : ` (rents ${s.rentSource === 'mixed' ? 'partly ' : ''}estimated)`}${s.listing.url ? `, ${s.listing.url}` : ''}`,
      ),
    );
  }
}

/** plan [markets.json|-] [--count N] [--json]: today's cities, one per line: key, feed doc, then the search name. */
export function runPlan(argv) {
  const { flags, positional } = parseArgs(argv);
  const index = unwrap(readJson(positional[0]), 'cities');
  const count = flags.count !== undefined && Number.isFinite(Number(flags.count)) ? Number(flags.count) : 4;
  const cities = planRun(index, count).map((key) => {
    const c = cityByKey(key);
    return { key, doc: feedDoc(key), name: c.name, province: c.province, provinceName: provinceName(c.province), typicalPrice: c.price, lastRun: index?.cities?.[key]?.date ?? null };
  });
  if (flags.json) process.stdout.write(`${JSON.stringify(cities, null, 1)}\n`);
  else for (const c of cities) console.log(`${c.key}\t${c.doc}\t${c.name}, ${c.province}\t(typical house ${plainMoney(c.typicalPrice)}; last searched ${c.lastRun ?? 'never'})`);
}

/** index <markets.json|-> <feed.json> --city key: print the index with that city's feed recorded. */
export function runIndex(argv) {
  const { flags, positional } = parseArgs(argv);
  const feed = unwrap(readJson(positional[1]), 'listings');
  if (!feed) {
    console.error('usage: index <markets.json|-> <feed.json> --city key');
    process.exitCode = 2;
    return;
  }
  const city = cityFlag(flags);
  const next = updateIndex(unwrap(readJson(positional[0]), 'cities'), city, feed);
  process.stdout.write(`${JSON.stringify(next)}\n`);
  console.error(`index: ${city} has ${next.cities[city].count} listings as of ${next.cities[city].date}; ${Object.keys(next.cities).length} cities indexed`);
}
