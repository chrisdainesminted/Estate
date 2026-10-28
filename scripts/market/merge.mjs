#!/usr/bin/env node
// Fold today's findings into the saved feed and print the new feed document.
//   node scripts/market/merge.mjs <prev.json|-> <found.json> [--today YYYY-MM-DD] [--note "text"] > next.json
// found.json is an array of listings (see RUNBOOK.md); prev.json is the saved feed, if any.
import { mergeFeed } from '../../src/lib/market.js';
import { parseArgs, readJson, unwrap } from './io.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const [prevPath, foundPath] = positional;
if (!foundPath) {
  console.error('usage: merge.mjs <prev.json|-> <found.json> [--today YYYY-MM-DD] [--note "text"]');
  process.exit(2);
}
const today = typeof flags.today === 'string' ? flags.today : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);

const prev = unwrap(readJson(prevPath), 'listings');
const foundJson = readJson(foundPath);
const found = Array.isArray(foundJson) ? foundJson : (unwrap(foundJson, 'listings')?.listings ?? []);
const { feed, stats } = mergeFeed(prev, found, { today, note: typeof flags.note === 'string' ? flags.note : '' });

process.stdout.write(`${JSON.stringify(feed)}\n`);
console.error(`merged ${today}: ${JSON.stringify(stats)} -> ${feed.listings.length} listings in the feed (${found.length - stats.found} rejected as incomplete)`);
