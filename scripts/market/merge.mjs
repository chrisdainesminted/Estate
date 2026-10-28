#!/usr/bin/env node
// Fold today's findings into the saved feed and print the new feed document.
//   node scripts/market/merge.mjs <prev.json|-> <found.json> [--today YYYY-MM-DD] [--note "text"] > next.json
// found.json is an array of listings (see RUNBOOK.md); prev.json is the saved feed, if any.
import { runMerge } from './commands.mjs';

runMerge(process.argv.slice(2));
