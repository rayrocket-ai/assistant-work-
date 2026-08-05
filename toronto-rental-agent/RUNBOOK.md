# Daily Toronto Rental-Property Scout — Runbook

You are running the daily property-scouting job. Goal: deliver **2–3 investment
properties in the Greater Toronto Area, under $1,000,000, with 3+ rental units
(or clear 3-unit potential), where rent can cover the mortgage at minimum down
payment.** The GTA includes the City of Toronto plus Durham, York, Peel, and
Halton regions — the 905 (Mississauga, Brampton, Oshawa, Ajax, Pickering, etc.)
often has better price-to-rent ratios than Toronto proper, so search it every day.

Read `config.json` first — all criteria and assumptions live there.

## Step 1 — Get today's mortgage rate
WebSearch: `best 5 year fixed insured mortgage rate Canada today`. Use the best
broadly-available insured 5-yr fixed rate (e.g. from ratehub.ca / wowa.ca). If
the search fails, use `financing.default_rate_pct` from config.json. If the rate
moved >0.25% from the config default, update config.json in your commit.

## Step 2 — Find candidate listings (aim for 6–10 candidates)
**Field-tested 2026-08-05: WebFetch returns 403 on essentially ALL listing
sites from this environment** (zolo, realtor.ca, housesigma, rew, kijiji,
zillow, trovit, keyhomes, viewhomes, small realtor sites, even news sites).
Don't burn time on fetches — WebSearch snippets are the working channel, and
they surface prices, unit counts, and even stated rents.

High-yield query patterns (Zolo page titles follow `<address> — For Sale @
$<price> | Zolo.ca`, so quoting a price prefix surfaces priced listings
directly):
- `zolo.ca triplex Toronto "For Sale @ $9"` (and `@ $8`, `@ $7` variants)
- `triplex for sale Toronto under $1,000,000 housesigma`
- `legal triplex for sale <neighbourhood> Toronto asking price`
- `duplex with basement apartment 3 units for sale Toronto under $1,000,000`
- Follow-up per candidate: `"<street number> <street name>" Toronto triplex`
  to cross-verify price/units across multiple sites' snippets.
- 905/GTA sweeps (rotate cities daily): `triplex for sale Mississauga OR
  Brampton under $1,000,000`, `legal triplex Oshawa OR Whitby OR Ajax for sale`,
  `zolo.ca triplex Mississauga "For Sale @"`, `multiplex for sale Vaughan OR
  Markham under 1 million`. Durham region (Oshawa/Whitby/Ajax) is the most
  likely source of sub-$1M triplexes that fully cash-flow.
- Mark 905 candidates with `"toronto": false` in the JSON — they pay single
  (provincial-only) land transfer tax, which the analyzer prices in.

Expectation-setting: legal 4-plexes in Toronto proper run $2M+; the sub-$1M
pool is triplexes and duplex+basement conversions, and only a handful are
listed at any time. Finding 2–3 verified candidates is a normal day.

For each candidate capture: address, asking price, # of units (self-contained,
with kitchens — not just "finished basement"), beds/baths per unit, listed
actual rents if stated, days on market, and the listing URL.

**Verification is mandatory — search AI snippets conflate listings.** Confirm
price AND unit count from at least two independent sources (e.g. Zolo title +
MLS-number snippet) before analyzing. Real failure case: an aggregator
advertised 74 Clouston Ave as a "$884,900 fourplex" but the MLS listing shows a
3-bed single-family. Also beware name collisions — "Scarborough" returns
Scarborough Maine/UK results; anchor queries with "Toronto" or the MLS number.

## Step 2.5 — Verify ACTIVE status (hard gate, learned 2026-08-05)
**Cached "For Sale @" pages persist for months after a property sells.** The
first live run reported two properties the user knew had sold months earlier —
every source above still showed them as active. A pick may only go in the
report if it passes ALL of:
1. **Current MLS series.** TRREB MLS numbers increment over time — as of
   Aug 2026 active listings are 13-series (E13/W13/C13/N13xxxxx); 12-series
   numbers date from ~2025 and are almost certainly sold or expired.
   Calibrate each run against MLS numbers seen on brand-new rental listings.
2. **Explicit recency signal** in a snippet: "X hours/days on site", "new
   listing", or a listed-date within the last ~45 days. "June 2026" on a
   cached page does NOT count — that page may predate a sale.
3. **Negative sold-check**: search `"<address>" sold` and
   `"<address>" <city>` — reject on any sold/leased/delisted/terminated
   evidence, and treat HouseSigma sold-page snippets as authoritative.
Anything that fails a gate but looks compelling goes in the report ONLY under
a clearly-labeled "Leads (status unverified — check on HouseSigma)" section
with its MLS number so the user can verify in one tap. Never present a
gate-failing listing as a pick. If nothing passes all three gates, say so
plainly — a short honest report beats a stale one.

Skip: price > $1M, fewer than 3 units unless a 3rd is permitted/roughed-in,
land-lease/co-op, obvious teardowns.

## Step 3 — Establish rents
Prefer **actual rents stated in the listing** (mark `rent_source: "listed actual rents"`).
Otherwise estimate from market data (mark `"market estimate"`): WebSearch
`average rent 2 bedroom apartment <neighbourhood> Toronto` or use rentals.ca /
CMHC averages. Be conservative — use the low end of the range.

## Step 4 — Run the numbers
Write the candidates to a JSON file (schema at top of `analyze.py`), then:
```
python3 toronto-rental-agent/analyze.py candidates.json --rate <today's rate> --top 3
```
The calculator applies minimum-down rules automatically (10% down for 3–4 unit
owner-occupied, CMHC premium rolled into the loan, Toronto double land-transfer
tax, semi-annual compounding, stress test).

## Step 5 — Judge location quality
For the top picks, sanity-check location against `search.good_location_signals`
in config.json (transit walkability, area rents/vacancy, employment anchors).
Demote a pick with a bad location even if the math scores well, and say why.

## Step 6 — Deliver
1. Write the report to `toronto-rental-agent/reports/YYYY-MM-DD.md`:
   - Top 2–3 properties: the analyzer output (it shows BOTH financing
     scenarios per property — owner-occupied 10% min down and pure-rental 20%
     down) plus 2–3 sentences each on why it's a good investment and any risks
     (condition, tenancies in place, neighbourhood direction).
   - Today's rate used, and the full also-analyzed list.
   - A caveats line: 10% minimum down requires living in one unit; rents
     unverified until seen; listing data from public snippets.
2. Send the report file to the user (SendUserFile, status: proactive).
3. Commit the report (and any config rate update) to branch
   `claude/toronto-rental-property-agent-kk93a3` and push.
4. End your final message with a short summary: the 2–3 addresses, price,
   units, monthly cash flow at min down, and whether rent covers the mortgage —
   this summary is what reaches the user's phone/email notification.

## Quality bar
- Never fabricate a listing. Every property must have a real, current URL you
  actually saw in search results or a fetched page. If you can only verify 1–2
  good candidates today, send 1–2 and say the market was thin — don't pad.
- Dedupe against `reports/` from previous days; only resend a property if its
  price dropped (and say so).
