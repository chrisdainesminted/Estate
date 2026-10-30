#!/usr/bin/env node
// Entry for the bundled tool the daily run downloads from the page:
//   node bedrock-market.mjs plan [markets.json|-] [--count N]                 today's cities
//   node bedrock-market.mjs merge <prev.json|-> <found.json> --city key [--today YYYY-MM-DD] [--keep-days N] [--note "text"] > next.json
//   node bedrock-market.mjs index <markets.json|-> <next.json> --city key > markets-next.json
//   node bedrock-market.mjs score <feed.json> [bedrock.json] [--json]
import { runIndex, runMerge, runPlan, runScore } from './commands.mjs';

const COMMANDS = { plan: runPlan, merge: runMerge, index: runIndex, score: runScore };
const [command, ...rest] = process.argv.slice(2);
if (COMMANDS[command]) COMMANDS[command](rest);
else {
  console.error(
    'usage: bedrock-market.mjs plan [markets.json|-] [--count N]\n       bedrock-market.mjs merge <prev.json|-> <found.json> --city key [--today YYYY-MM-DD] [--keep-days N] [--note "text"]\n       bedrock-market.mjs index <markets.json|-> <next.json> --city key\n       bedrock-market.mjs score <feed.json> [bedrock.json] [--json]',
  );
  process.exitCode = 2;
}
