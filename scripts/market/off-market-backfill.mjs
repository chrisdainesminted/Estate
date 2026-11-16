#!/usr/bin/env node
// One-off: rebuild each city's off-market record from the history of its
// feed file in git, replaying every saved day in order (see
// carryOffMarket in src/lib/market.js), and write it into today's file.
//   node scripts/market/off-market-backfill.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carryOffMarket } from '../../src/lib/market.js';

const root = new URL('../..', import.meta.url).pathname;
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const dir = join(root, 'public', 'data');
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.json') || ['markets.json', 'taxsales.json'].includes(name)) continue;
  const path = `public/data/${name}`;
  const commits = git('log', '--reverse', '--format=%H %cs', '--', path).trim().split('\n').filter(Boolean);
  let prev = null;
  for (const line of commits) {
    const [sha, day] = line.split(' ');
    let next;
    try {
      next = JSON.parse(git('show', `${sha}:${path}`));
    } catch {
      continue;
    }
    prev = prev ? carryOffMarket(prev, next, next.lastRun?.date ?? day) : { ...next, offMarket: next.offMarket ?? [] };
  }
  const now = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  const out = carryOffMarket(prev, now, now.lastRun?.date ?? new Date().toISOString().slice(0, 10));
  writeFileSync(join(dir, name), JSON.stringify(out));
  const left = out.offMarket.filter((r) => r.status === 'left').length;
  const cond = out.offMarket.length - left;
  console.log(`${name}: ${commits.length} days replayed, ${left} left the market, ${cond} conditional`);
}
