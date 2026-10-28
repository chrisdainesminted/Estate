#!/usr/bin/env node
// Rank the feed with the owner's saved assumptions and targets, and list the standouts.
//   node scripts/market/score.mjs <feed.json> [bedrock.json] [--json]
// bedrock.json is the owner's library document (its settings hold targets and listing assumptions).
import { runScore } from './commands.mjs';

runScore(process.argv.slice(2));
