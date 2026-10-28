# Daily Thunder Bay listings run

The scheduled "Bedrock Thunder Bay listings" task follows this every morning. It finds Thunder Bay properties for sale, saves them to the Bedrock page's database, and reports any that beat the owner's targets. The page's Listings tab does the full analysis live from what this run saves, using the owner's current assumptions.

- Bedrock page: https://claude.ai/artifact/5KH4ZZHoZ8CvCKF5CXutGJ
- Saved feed: collection `data/users/me`, document `thunderbay` (private to the owner)
- Owner's library and settings: collection `data/users/me`, document `bedrock` (read it; never write it)
- The run's tool, published with the page: `tools/bedrock-market.mjs` (a bundle of `scripts/market/cli.mjs`; `merge` and `score` below). This file is published beside it as `tools/RUNBOOK.md`, so a run needs no copy of the repository.

## Rules

- Change nothing except the `thunderbay` document. Don't edit, commit or push any repository, and never write the `bedrock` document.
- Use web search only. Don't scrape REALTOR.ca or any other site. (This environment can't open web pages anyway.)
- Only properties in the City of Thunder Bay that are for sale now. Skip places for rent, sold or leased listings, vacant land and commercial-only property.
- **Only real listings.** Every listing needs a link to its own listing page, copied exactly from a search result: a page whose address shows the property's street number and street, on a listing site such as REALTOR.ca, REW, Zolo, RE/MAX, Royal LePage, Century 21, Coldwell Banker, Square Yards or OnePercent. Never type, build or adjust a link, and never use a search, area or neighbourhood page. If no result links to the property's own page, leave the property out. The merge tool turns away anything without one.
- Leave out anything the results show as sold, conditionally sold, expired, terminated or off the market, and anything whose sources disagree on the asking price.
- Record only what a source states, and leave a field out rather than guess. Rents are current rents only: leave a unit's rent `null` if it's vacant or the figure is the agent's estimate of market rent.

## Steps

1. **Set up.**

   ```bash
   RUN=$(mktemp -d)
   TODAY=$(TZ=America/Toronto date +%F)
   ```

   Load the `Artifact` and `ArtifactData` tools with ToolSearch if they aren't loaded. Get the tool: Artifact `read` with the page URL and path `tools/bedrock-market.mjs`, and call the saved file `$TOOL`. (With the repository checked out, `node scripts/market/cli.mjs` is the same tool.)

2. **Read what's saved.**
   - ArtifactData `get` with the page URL, collection `data/users/me`, doc_id `thunderbay`, out_dir `$RUN/prev`. Note the `version` it reports. If there's no such document, this is the first run.
   - ArtifactData `get` with collection `data/users/me`, doc_id `bedrock`, out_dir `$RUN/settings`. If it's missing, defaults apply.
   - Find the saved files with `find "$RUN" -name '*.json'`. Call the feed file `$PREV` (use `-` on the first run) and the library file `$SETTINGS`.

3. **Search.** Run each query with WebSearch in `standard` mode. If one returns fewer than three listings, run it once more in `extended` mode.
   1. Thunder Bay ON duplex for sale
   2. Thunder Bay ON triplex for sale
   3. Thunder Bay ON fourplex OR 4-plex for sale
   4. Thunder Bay ON apartment building OR multi-residential for sale
   5. Thunder Bay ON income property for sale
   6. Thunder Bay ON house for sale under $300,000
   7. Thunder Bay ON house for sale $300,000 to $500,000
   8. Thunder Bay ON house with basement apartment OR secondary suite for sale
   9. Thunder Bay ON new listing this week house for sale
   10. Thunder Bay ON price reduced house for sale

   Then confirm saved listings: search the address of every saved listing whose `lastSeen` is three or more days old (oldest first, up to 12). If a result still shows its listing page for sale, include it in `found.json` like any other. If it shows the property sold, include it with status `sold`; if there's no for-sale page for it any more, include it with status `gone`. A listing that isn't confirmed for seven days drops off on its own.

4. **Write `$RUN/found.json`**: a JSON array with one object for each listing found today, including ones already saved, so their dates and prices update.

   | Field | Type | Notes |
   |---|---|---|
   | `mls` | string | MLS® number if stated, e.g. `TB2602251` or `X13684758` |
   | `address` | string | **Required.** Street address, e.g. `228 Archibald Street S` |
   | `url` | string | **Required** (except for `sold` or `gone`). The link to the property's own listing page, copied exactly from the search result. Never type or build one. |
   | `source` | string | Site name, e.g. `rew.ca` |
   | `price` | number | **Required.** Asking price in dollars |
   | `units` | number | Rental units: a house is 1; a house with a legal basement suite is 2 |
   | `beds` | number[] | Bedrooms for each unit, in order, e.g. `[2, 2, 1]`, if stated (0 = bachelor) |
   | `rents` | (number \| null)[] | Current monthly rent per unit, same order; `null` where unknown or vacant |
   | `grossRent` | number | Total current monthly rent, only when stated as a total (an annual figure ÷ 12) |
   | `taxes` | number | Annual property tax, if stated |
   | `yearBuilt` | number | If stated |
   | `highlights` | string | One short line: condition, who pays utilities, tenancy facts (200 characters at most) |
   | `status` | string | `active`, `conditional` (sold subject to conditions), `sold`, or `gone` (a saved listing with no for-sale page any more) |

5. **Merge.**

   ```bash
   node "$TOOL" merge "$PREV" "$RUN/found.json" --today "$TODAY" --note "<one line, e.g. 10 searches, 2 thin>" > "$RUN/next.json"
   ```

6. **Save.** ArtifactData `set` with collection `data/users/me`, doc_id `thunderbay`, file_path `$RUN/next.json`, and `if_version` set to the version from step 2 (leave it out only on the first run). If the save fails because the version changed, re-read the feed (step 2), then redo steps 5 and 6 once.

7. **Score.**

   ```bash
   node "$TOOL" score "$RUN/next.json" "$SETTINGS"   # leave $SETTINGS off if there wasn't one
   ```

8. **Report.** Your final message becomes the phone notification, so keep it short.
   - With standouts: "Thunder Bay: N listing(s) beat your targets today", then one line each with the address, price, cash flow per door, "(rents estimated)" where the score script says so, and the link.
   - Without: "No standouts today. Checked X listings: Y new, Z price drops."
   - If searching or saving failed, say so plainly instead.
