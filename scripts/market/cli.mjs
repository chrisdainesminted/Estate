#!/usr/bin/env node
// Entry for the bundled tool the daily run downloads from the page:
//   node bedrock-market.mjs merge <prev.json|-> <found.json> [--today YYYY-MM-DD] [--note "text"] > next.json
//   node bedrock-market.mjs score <feed.json> [bedrock.json] [--json]
import { runMerge, runScore } from './commands.mjs';

const [command, ...rest] = process.argv.slice(2);
if (command === 'merge') runMerge(rest);
else if (command === 'score') runScore(rest);
else {
  console.error('usage: bedrock-market.mjs merge <prev.json|-> <found.json> [--today YYYY-MM-DD] [--note "text"]\n       bedrock-market.mjs score <feed.json> [bedrock.json] [--json]');
  process.exitCode = 2;
}
