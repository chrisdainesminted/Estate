# Daily listings run, across Canada

The scheduled "Squarely listings" task follows this every morning. It finds properties for sale in Thunder Bay (every day) and in three more Canadian cities taken in turn (so each of the 27 gets searched about every nine days), saves each city's list to the Squarely page's database, and reports any that beat the owner's targets. The page's Listings tab does the full analysis live from what this run saves, using the owner's current assumptions moved to each city.

- Squarely page: https://claude.ai/artifact/5KH4ZZHoZ8CvCKF5CXutGJ
- Saved feeds: collection `data/users/me`, one document per city, named by the `plan` command (Thunder Bay's is `thunderbay`, Calgary's `calgary`, St. John's `stjohns`, and so on)
- Index of every city: collection `data/users/me`, document `markets`
- Municipal tax sales: collection `data/users/me`, document `taxsales`
- Owner's library and settings: collection `data/users/me`, document `bedrock` (read it; never write it)
- The run's tool, published with the page: `tools/bedrock-market.mjs` (a bundle of `scripts/market/cli.mjs`: `plan`, `merge`, `index` and `score` below). This file is published beside it as `tools/RUNBOOK.md`, so a run needs no copy of the repository.

## Rules

- Change nothing except the city documents for today's cities, the `markets` document and the `taxsales` document. Don't edit, commit or push any repository, and never write the `bedrock` document.
- Use web search only. Don't scrape REALTOR.ca or any other site. (This environment can't open web pages anyway.)
- Only properties in that city (the city itself, not the region around it) that are for sale now. Skip places for rent, sold or leased listings, vacant land and commercial-only property.
- **Only real listings.** Every listing needs a link to its own listing page, copied exactly from a search result: a page whose address shows the property's street number and street, on a listing site such as REALTOR.ca, REW, Zolo, HouseSigma, Zoocasa, Point2, Wahi, Redfin, RE/MAX, Royal LePage, Century 21, Coldwell Banker, eXp, Square Yards, HonestDoor, Centris (Québec), DuProprio (Québec), PropertyGuys, OnePercent, or a local brokerage's own site. Never type, build or adjust a link, and never use a search, area or neighbourhood page. If no result links to the property's own page, leave the property out. The merge tool turns away anything without one.
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
   - ArtifactData `get` with doc_id `taxsales`, out_dir `$RUN/taxsales`. Note its `version`. If it's missing, use `-` for `$TAXSALES`; otherwise `$TAXSALES` is the saved file.
   - ArtifactData `get` with doc_id `bedrock`, out_dir `$RUN/settings`. If it's missing, defaults apply. Call the saved file `$SETTINGS`.
   - `node "$TOOL" plan "$INDEX" --count 4` prints today's cities, one per line: the city key, its document name, the name to search with, and its typical house price. Thunder Bay is always first.

3. **For each of today's cities**, in order (`$CITY` is its key, `$DOC` its document name, `$NAME` the name to search with, such as `Calgary, AB`):

   a. **Read what's saved.** ArtifactData `get` with collection `data/users/me`, doc_id `$DOC`, out_dir `$RUN/$CITY/prev`. Note its `version`. If there's no such document, this city's first run: use `-` for `$PREV`.

   b. **Search** with WebSearch in `standard` mode. The goal is **every listing for sale in the city, from every site**: the owner wants nothing missed. Run **every** query on the list, even when earlier ones turned up plenty: each one reaches listings the others miss, and different sites carry different listings (private sales and small brokerages are often on only one). If a query returns fewer than three listings, run it once more in `extended` mode. A single result page often names several properties; record each one that has its own listing link. Keep a count of the searches you run.

      **Expect this to take a while**: about 60 searches for Thunder Bay and 40 for each other city, plus the address and tax checks below. That is the job; don't cut it short. A run that skips searches misses listings.

      - Thunder Bay:
        1. Thunder Bay ON duplex for sale
        2. Thunder Bay ON triplex for sale
        3. Thunder Bay ON fourplex OR 4-plex for sale
        4. Thunder Bay ON apartment building OR multi-residential for sale
        5. Thunder Bay ON income property for sale
        6. Thunder Bay ON house with basement apartment OR secondary suite OR in-law suite for sale
        7. Thunder Bay ON house for sale under $200,000
        8. Thunder Bay ON house for sale $200,000 to $275,000
        9. Thunder Bay ON house for sale $275,000 to $350,000
        10. Thunder Bay ON house for sale $350,000 to $425,000
        11. Thunder Bay ON house for sale $425,000 to $500,000
        12. Thunder Bay ON house for sale $500,000 to $650,000
        13. Thunder Bay ON house for sale over $650,000
        14. Thunder Bay ON bungalow for sale
        15. Thunder Bay ON two storey house for sale
        16. Thunder Bay ON condo for sale
        17. Thunder Bay ON townhouse OR semi-detached for sale
        18. Thunder Bay ON fixer upper OR handyman special OR as is for sale
        19. Thunder Bay ON estate sale house
        20. Port Arthur Thunder Bay house for sale
        21. Fort William Thunder Bay house for sale
        22. Westfort Thunder Bay house for sale
        23. Current River Thunder Bay house for sale
        24. Northwood Thunder Bay house for sale
        25. Intercity OR Vickers Heights Thunder Bay house for sale
        26. County Park OR Parkdale Thunder Bay house for sale
        27. Shuniah OR Neebing OR Oliver Paipoonge house for sale
        28. Thunder Bay ON new listing this week house for sale
        29. Thunder Bay ON price reduced house for sale
        30. Thunder Bay ON open house this weekend
        31. Thunder Bay for sale by owner house
        32. Thunder Bay power of sale house
        33. Thunder Bay bank owned OR mortgagee sale property
        34. Thunder Bay estate sale house
        35. Thunder Bay court ordered sale OR receivership property
        Then one search per site, each `site:<site> Thunder Bay house for sale`, for every site here: realtor.ca, rew.ca, zolo.ca, housesigma.com, zoocasa.com, point2homes.com, wahi.com, redfin.ca, remax.ca, royallepage.ca, c21.ca, coldwellbanker.ca, exprealty.ca, onepercentrealty.com, squareyards.ca, honestdoor.com, propertyguys.com, kijiji.ca. Then the same for `Thunder Bay duplex OR triplex for sale` on realtor.ca, zolo.ca, housesigma.com and remax.ca. Finally `Thunder Bay real estate brokerage listings` and one `site:` search on each local brokerage site those results name.
      - Every other city (`$NAME` as printed; `$PRICE` is its typical house price, rounded; `$P1` to `$P4` are 50%, 75%, 125% and 160% of it):
        1. `$NAME` duplex for sale
        2. `$NAME` triplex OR fourplex for sale
        3. `$NAME` income property OR multi-residential OR apartment building for sale
        4. `$NAME` house with basement suite OR secondary suite OR legal suite for sale
        5. `$NAME` house for sale under `$P1`
        6. `$NAME` house for sale `$P1` to `$P2`
        7. `$NAME` house for sale `$P2` to `$PRICE`
        8. `$NAME` house for sale `$PRICE` to `$P3`
        9. `$NAME` house for sale `$P3` to `$P4`
        10. `$NAME` house for sale over `$P4`
        11. `$NAME` bungalow for sale
        12. `$NAME` condo for sale
        13. `$NAME` townhouse OR semi-detached for sale
        14. `$NAME` fixer upper OR handyman special OR as is for sale
        15. `$NAME` new listing house for sale
        16. `$NAME` price reduced house for sale
        17. `$NAME` for sale by owner house
        18. `$NAME` power of sale OR bank owned house
        19. `$NAME` estate sale OR court ordered sale house
        Then one search per site, each `site:<site> $NAME house for sale`, for every site here: realtor.ca, rew.ca, zolo.ca, housesigma.com, zoocasa.com, point2homes.com, wahi.com, redfin.ca, remax.ca, royallepage.ca, c21.ca, coldwellbanker.ca, exprealty.ca, onepercentrealty.com, squareyards.ca, honestdoor.com, propertyguys.com (in Québec also centris.ca and duproprio.com). Then `site:realtor.ca $NAME duplex OR triplex for sale` and `site:zolo.ca $NAME duplex OR triplex for sale`.

      Then confirm saved listings: search the address (with the city) of every saved listing whose `lastSeen` is three or more days old, oldest first, up to 25 for Thunder Bay and 15 for other cities. If a result still shows its listing page for sale, include it in `found.json` like any other. If it shows the property sold, include it with status `sold`; if there's no for-sale page for it any more, include it with status `gone`.

      Then **find the tax bills**: every listing without `taxes` is shown with no monthly numbers until its real bill is known, so this matters as much as finding listings. For listings (saved or found today) with no `taxes`, up to 30 for Thunder Bay and 20 for other cities, buildings with the most units first, then the highest price, run these until one states the annual property tax for that address:
        1. `"<address>" <city> property taxes`
        2. `site:zolo.ca "<address>" <city>` (Zolo pages usually state the taxes)
        3. `site:housesigma.com "<address>" <city>`
        4. `site:realtor.ca "<address>" <city>`
        5. `<MLS number> taxes`, if the listing has one
      When a result states the annual property tax for that address, include the listing in `found.json` with its `url`, `price` and `taxes`. Never guess, estimate or work out a tax figure (not from an assessment, not from a mill rate): leave it out when no page states it.

      Then **look for tax sales**: land the city is selling by public tender (or, outside Ontario, at auction) for unpaid property tax. Search `$NAME tax sale properties <this year>` and `$NAME tax sale <next year>`; in Ontario also `site:ontario.ca "sale of land for tax arrears" <city name>` (the Ontario Gazette). Record a property only from the municipality's own notice or the provincial gazette, never from a reseller or a news story, and only while its tender or auction date is still ahead. Write them to `$RUN/$CITY/taxsales.json` as an array of objects with the tax sale fields below (`[]` when there are none), then:

      ```bash
      node "$TOOL" taxsales "$TAXSALES" "$RUN/$CITY/taxsales.json" --city "$CITY" --today "$TODAY" > "$RUN/taxsales-next.json" && TAXSALES="$RUN/taxsales-next.json"
      ```

   c. **Write `$RUN/$CITY/found.json`**: a JSON array with one object for each listing found today in that city, including ones already saved, so their dates and prices update. Fields below.

   d. **Merge.** Thunder Bay is searched daily, so a listing not confirmed for 7 days drops off; other cities come round about every nine days, so give them 12:

      ```bash
      node "$TOOL" merge "$PREV" "$RUN/$CITY/found.json" --city "$CITY" --today "$TODAY" --keep-days <7 for thunder-bay, 12 otherwise> --note "<one line: searches run, e.g. 62 searches, 3 thin, 9 tax bills found>" > "$RUN/$CITY/next.json"
      ```

   e. **Save.** ArtifactData `set` with collection `data/users/me`, doc_id `$DOC`, file_path `$RUN/$CITY/next.json`, and `if_version` set to the version from step a (leave it out only on that city's first run). If the save fails because the version changed, re-read it (step a), then redo steps d and e once.

   f. **Index.** `node "$TOOL" index "$INDEX" "$RUN/$CITY/next.json" --city "$CITY" > "$RUN/index-next.json"`, then use `$RUN/index-next.json` as `$INDEX` for the next city.

   g. **Score.** `node "$TOOL" score "$RUN/$CITY/next.json" "$SETTINGS"` (leave `$SETTINGS` off if there wasn't one). Keep its standouts for the report.

   If one city's searches or save fail, note it and go on to the next city.

4. **Save the tax sales.** ArtifactData `set` with collection `data/users/me`, doc_id `taxsales`, file_path `$TAXSALES` (the last `taxsales-next.json`), and `if_version` from step 2 (leave it out if there was no document). If the version changed, re-read it and redo each city's `taxsales` command against it once.

5. **Save the index.** ArtifactData `set` with collection `data/users/me`, doc_id `markets`, file_path `$INDEX` (the last `index-next.json`), and `if_version` from step 2 (leave it out on the first run). If the version changed, re-read `markets`, redo step 3f for each of today's cities against it (their `next.json` files are still in `$RUN`), and save once more.

6. **Report.** Your final message becomes the phone notification, so keep it short.
   - With standouts: "N listing(s) beat your targets today", then one line each with the city, address, price, cash flow per door, "(rents estimated)" where the score script says so, and the link.
   - Without: "No standouts today. Checked <cities>: X listings, Y new, Z price drops."
   - Always add one line: "<N> searches, <T> tax bills found." Add "<D> distressed listings, <S> open tax sales." when there are any.
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
| `distress` | string | Only when the listing says so: `power-of-sale`, `bank-owned`, `receivership` (court-ordered or trustee sale), `estate`, or `as-is` |
| `status` | string | `active`, `conditional` (sold subject to conditions), `sold`, or `gone` (a saved listing with no for-sale page any more) |


### Tax sale fields

| Field | Type | Notes |
|---|---|---|
| `address` | string | Street address, if the notice gives one |
| `legal` | string | The legal description (e.g. `PCL 1234 SEC TBF; LT 5 PL 1001`), if given. One of `address` or `legal` is required |
| `roll` | string | The assessment roll number |
| `minimumBid` | number | **Required.** The minimum tender amount (or the auction's opening bid) in dollars |
| `deadline` | string | The tender or auction date, `YYYY-MM-DD` |
| `size` | string | Lot size or area as the notice states it |
| `notes` | string | One short line the notice states, e.g. "vacant land" or "no access road" |
| `url` | string | **Required.** The https link to the official notice (the municipality's page or PDF, or the gazette) |
