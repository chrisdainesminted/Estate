# Daily listings run, across Canada

The scheduled "Squarely listings" task follows this every morning. It finds properties for sale in Thunder Bay (every day) and in a few more Canadian cities taken in turn (so each gets searched about once a week), saves each city's list to the Squarely page's database, and reports any that beat the owner's targets. The page's Listings tab does the full analysis live from what this run saves, using the owner's current assumptions moved to each city.

- Squarely page: https://claude.ai/artifact/5KH4ZZHoZ8CvCKF5CXutGJ
- Saved feeds: collection `data/users/me`, one document per city, named by the `plan` command (Thunder Bay's is `thunderbay`, Calgary's `calgary`, St. John's `stjohns`, and so on)
- Index of every city: collection `data/users/me`, document `markets`
- Owner's library and settings: collection `data/users/me`, document `bedrock` (read it; never write it)
- The run's tool, published with the page: `tools/bedrock-market.mjs` (a bundle of `scripts/market/cli.mjs`: `plan`, `merge`, `index` and `score` below). This file is published beside it as `tools/RUNBOOK.md`, so a run needs no copy of the repository.

## Rules

- Change nothing except the city documents for today's cities and the `markets` document. Don't edit, commit or push any repository, and never write the `bedrock` document.
- Use web search only. Don't scrape REALTOR.ca or any other site. (This environment can't open web pages anyway.)
- Only properties in that city (the city itself, not the region around it) that are for sale now. Skip places for rent, sold or leased listings, vacant land and commercial-only property.
- **Only real listings.** Every listing needs a link to its own listing page, copied exactly from a search result: a page whose address shows the property's street number and street, on a listing site such as REALTOR.ca, REW, Zolo, RE/MAX, Royal LePage, Century 21, Coldwell Banker, Square Yards, HonestDoor, Centris (Québec) or OnePercent. Never type, build or adjust a link, and never use a search, area or neighbourhood page. If no result links to the property's own page, leave the property out. The merge tool turns away anything without one.
- Leave out anything the results show as sold, conditionally sold, expired, terminated or off the market, and anything whose sources disagree on the asking price.
- Record only what a source states, and leave a field out rather than guess. Rents are current rents only: leave a unit's rent `null` if it's vacant or the figure is the agent's estimate of market rent.

## Steps

1. **Set up.**

   ```bash
   RUN=$(mktemp -d)
   TODAY=$(TZ=America/Toronto date +%F)
   ```

   Load the `Artifact` and `ArtifactData` tools with ToolSearch if they aren't loaded. Get the tool: Artifact `read` with the page URL and path `tools/bedrock-market.mjs`, and call the saved file `$TOOL`. (With the repository checked out, `node scripts/market/cli.mjs` is the same tool.)

2. **Plan today.**
   - ArtifactData `get` with the page URL, collection `data/users/me`, doc_id `markets`, out_dir `$RUN/index`. Note its `version`. If there's no such document, this is the first run across Canada; use `-` for `$INDEX`. Otherwise `$INDEX` is the saved file (`find "$RUN/index" -name '*.json'`).
   - ArtifactData `get` with doc_id `bedrock`, out_dir `$RUN/settings`. If it's missing, defaults apply. Call the saved file `$SETTINGS`.
   - `node "$TOOL" plan "$INDEX" --count 4` prints today's cities, one per line: the city key, its document name, the name to search with, and its typical house price. Thunder Bay is always first.

3. **For each of today's cities**, in order (`$CITY` is its key, `$DOC` its document name, `$NAME` the name to search with, such as `Calgary, AB`):

   a. **Read what's saved.** ArtifactData `get` with collection `data/users/me`, doc_id `$DOC`, out_dir `$RUN/$CITY/prev`. Note its `version`. If there's no such document, this city's first run: use `-` for `$PREV`.

   b. **Search** with WebSearch in `standard` mode; if a query returns fewer than three listings, run it once more in `extended` mode.
      - Thunder Bay, all ten:
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
      - Every other city, these five (`$NAME` as printed; `$PRICE` is its typical house price, rounded):
        1. `$NAME` duplex OR triplex OR fourplex for sale
        2. `$NAME` income property OR multi-residential for sale
        3. `$NAME` house for sale under `$PRICE`
        4. `$NAME` house with basement suite OR secondary suite OR in-law suite for sale
        5. `$NAME` new listing house for sale

      Then confirm saved listings: search the address (with the city) of every saved listing whose `lastSeen` is three or more days old, oldest first, up to 12 for Thunder Bay and 6 for other cities. If a result still shows its listing page for sale, include it in `found.json` like any other. If it shows the property sold, include it with status `sold`; if there's no for-sale page for it any more, include it with status `gone`.

   c. **Write `$RUN/$CITY/found.json`**: a JSON array with one object for each listing found today in that city, including ones already saved, so their dates and prices update. Fields below.

   d. **Merge.** Thunder Bay is searched daily, so a listing not confirmed for 7 days drops off; other cities come round about weekly, so give them 10:

      ```bash
      node "$TOOL" merge "$PREV" "$RUN/$CITY/found.json" --city "$CITY" --today "$TODAY" --keep-days <7 for thunder-bay, 10 otherwise> --note "<one line, e.g. 5 searches, 1 thin>" > "$RUN/$CITY/next.json"
      ```

   e. **Save.** ArtifactData `set` with collection `data/users/me`, doc_id `$DOC`, file_path `$RUN/$CITY/next.json`, and `if_version` set to the version from step a (leave it out only on that city's first run). If the save fails because the version changed, re-read it (step a), then redo steps d and e once.

   f. **Index.** `node "$TOOL" index "$INDEX" "$RUN/$CITY/next.json" --city "$CITY" > "$RUN/index-next.json"`, then use `$RUN/index-next.json` as `$INDEX` for the next city.

   g. **Score.** `node "$TOOL" score "$RUN/$CITY/next.json" "$SETTINGS"` (leave `$SETTINGS` off if there wasn't one). Keep its standouts for the report.

   If one city's searches or save fail, note it and go on to the next city.

4. **Save the index.** ArtifactData `set` with collection `data/users/me`, doc_id `markets`, file_path `$INDEX` (the last `index-next.json`), and `if_version` from step 2 (leave it out on the first run). If the version changed, re-read `markets`, redo step 3f for each of today's cities against it (their `next.json` files are still in `$RUN`), and save once more.

5. **Report.** Your final message becomes the phone notification, so keep it short.
   - With standouts: "N listing(s) beat your targets today", then one line each with the city, address, price, cash flow per door, "(rents estimated)" where the score script says so, and the link.
   - Without: "No standouts today. Checked <cities>: X listings, Y new, Z price drops."
   - If searching or saving failed for a city, say which plainly.

### Listing fields

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

