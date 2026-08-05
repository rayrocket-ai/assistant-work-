# Daily Toronto Rental-Property Scout — Runbook

You are running the daily property-scouting job. Goal: deliver **2–3 investment
properties in the Toronto area, under $1,000,000, with 3+ rental units (or clear
3-unit potential), where rent can cover the mortgage at minimum down payment.**

Read `config.json` first — all criteria and assumptions live there.

## Step 1 — Get today's mortgage rate
WebSearch: `best 5 year fixed insured mortgage rate Canada today`. Use the best
broadly-available insured 5-yr fixed rate (e.g. from ratehub.ca / wowa.ca). If
the search fails, use `financing.default_rate_pct` from config.json. If the rate
moved >0.25% from the config default, update config.json in your commit.

## Step 2 — Find candidate listings (aim for 6–10 candidates)
Search multiple ways; each source is blind to the others:
- WebSearch: `triplex for sale Toronto under $1,000,000 housesigma`
- WebSearch: `fourplex OR multiplex for sale Toronto site:zolo.ca`
- WebSearch: `triplex for sale Toronto site:realtor.ca` (realtor.ca often blocks
  direct fetches — get details from the search snippets or a mirror like zolo/listing.ca)
- WebSearch: `duplex with basement apartment for sale Toronto under 1 million`
- WebFetch category pages that allow it, e.g.:
  - `https://www.zolo.ca/toronto-real-estate/triplex`
  - `https://www.zolo.ca/toronto-real-estate/fourplex`
  - `https://listing.ca/mls/?tri-plex.for.sale`
- HouseSigma requires login for full data; use search snippets and cross-reference
  the same address on zolo/listing.ca/realmaster for price and details.

For each candidate capture: address, asking price, # of units (self-contained,
with kitchens — not just "finished basement"), beds/baths per unit, listed
actual rents if stated, days on market, and the listing URL.

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
   - Top 2–3 properties: the analyzer output plus 2–3 sentences each on why
     it's a good investment and any risks (condition, tenancies in place,
     neighbourhood direction).
   - Today's rate used, and the full also-analyzed list.
   - A caveats line: numbers assume owner-occupying one unit (that's what
     unlocks 10% min down for 3–4 units; a pure rental needs 20% down),
     rents unverified until seen, listing data from public snippets.
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
