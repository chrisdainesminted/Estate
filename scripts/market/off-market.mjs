#!/usr/bin/env node
// After the daily listings are saved into public/data/, keep a record of
// the homes that came off the market since the last commit (see
// carryOffMarket in src/lib/market.js). Compares each city file with its
// version at HEAD and writes the record into the new file.
//   node scripts/market/off-market.mjs [YYYY-MM-DD]

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carryOffMarket } from '../../src/lib/market.js';

const root = new URL('../..', import.meta.url).pathname;
const today = process.argv[2] || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const dir = join(root, 'public', 'data');
let total = 0;
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.json') || ['markets.json', 'taxsales.json'].includes(name)) continue;
  const file = join(dir, name);
  const next = JSON.parse(readFileSync(file, 'utf8'));
  let prev = null;
  try {
    prev = JSON.parse(execFileSync('git', ['show', `HEAD:public/data/${name}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    // A new city: nothing came off its market yet.
  }
  const out = carryOffMarket(prev, next, today);
  const added = out.offMarket.length - (prev?.offMarket?.length ?? 0);
  if (JSON.stringify(out.offMarket) !== JSON.stringify(next.offMarket ?? [])) writeFileSync(file, JSON.stringify(out));
  total += Math.max(added, 0);
}
console.log(`Off the market: ${total} new record${total === 1 ? '' : 's'} kept.`);
