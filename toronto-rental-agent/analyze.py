#!/usr/bin/env python3
"""Batch-score candidate listings and rank them by investment quality.

Input: a JSON file of listings, e.g.
[
  {
    "address": "123 Example Ave, East York",
    "url": "https://housesigma.com/...",
    "price": 949000,
    "units": 3,
    "monthly_rent": 5600,
    "rent_source": "listed actual rents" | "market estimate",
    "location_notes": "5 min walk to Woodbine station",
    "days_on_market": 12,
    "toronto": true
  }, ...
]

Set "toronto": false for 905-area properties (outside the City of Toronto) —
they pay only the provincial land transfer tax, not Toronto's municipal double.

Output: ranked markdown to stdout.
  python3 analyze.py candidates.json [--rate 4.09] [--top 3]
"""

import argparse
import json

from mortgage import analyze, load_config


def score(r, listing):
    """Composite investment score. Cash flow dominates; bonuses for coverage,
    cap rate, unit count, and confirmed (not estimated) rents."""
    s = 0.0
    s += r["monthly_cash_flow"] / 100.0
    s += 15 if r["rent_covers_mortgage"] else -15
    s += 10 if r["rent_covers_everything"] else 0
    s += (r["cap_rate_pct"] - 4.0) * 5
    s += (r["dscr"] - 1.0) * 20
    s += 5 if listing.get("units", 0) >= 4 else 0
    s += 5 if "actual" in listing.get("rent_source", "") else 0
    return round(s, 1)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("candidates", help="JSON file of listings")
    p.add_argument("--rate", type=float, default=None)
    p.add_argument("--top", type=int, default=3)
    args = p.parse_args()

    with open(args.candidates) as f:
        listings = json.load(f)

    cfg = load_config()
    rows = []
    for l in listings:
        in_toronto = l.get("toronto", True)
        own = analyze(l["price"], l["units"], l["monthly_rent"], rate_pct=args.rate,
                      owner_occupied=True, toronto=in_toronto, config=cfg)
        inv = analyze(l["price"], l["units"], l["monthly_rent"], rate_pct=args.rate,
                      owner_occupied=False, toronto=in_toronto, config=cfg)
        rows.append((score(own, l), l, own, inv))
    rows.sort(key=lambda x: -x[0])  # ranked by the owner-occupied (min-down) scenario

    def coverage(r):
        if r["rent_covers_everything"]:
            return "rent covers mortgage + all costs"
        if r["rent_covers_mortgage"]:
            return "rent covers mortgage (not all operating costs)"
        return f"rent does NOT cover mortgage (short ${r['monthly_payment'] - r['monthly_rent']:,.0f}/mo)"

    def scenario_lines(label, r):
        print(f"- **{label}**: down ${r['down_payment']:,} ({r['down_payment_pct']}%), "
              f"cash to close ${r['cash_to_close']:,}, mortgage ${r['monthly_payment']:,}/mo")
        print(f"  - Cash flow **${r['monthly_cash_flow']:,}/mo** — {coverage(r)}")
        print(f"  - Cap rate {r['cap_rate_pct']}% | cash-on-cash {r['cash_on_cash_pct']}% | "
              f"DSCR {r['dscr']} | breakeven rent ${r['breakeven_rent']:,}")

    print(f"# Ranked candidates ({len(rows)} analyzed, top {args.top} shown)\n")
    for rank, (s, l, own, inv) in enumerate(rows[: args.top], 1):
        print(f"## {rank}. {l['address']} — score {s}")
        print(f"- **${l['price']:,}** | {l['units']} units | rent ${l['monthly_rent']:,}/mo ({l.get('rent_source', 'estimate')})")
        print(f"- {l.get('url', '')}")
        print(f"- Location: {l.get('location_notes', 'n/a')}")
        print(f"- Mortgage @ {own['rate_pct']}% / {own['amortization_years']}yr; opex ${own['monthly_operating_costs']:,}/mo")
        scenario_lines("Owner-occupied (min 10% down)", own)
        scenario_lines("Pure rental (min 20% down)", inv)
        print()

    if len(rows) > args.top:
        print("### Also analyzed (didn't make the cut)")
        for s, l, own, inv in rows[args.top:]:
            print(f"- {l['address']} (${l['price']:,}, {l['units']}u): score {s}, "
                  f"cash flow ${own['monthly_cash_flow']:,}/mo owner-occ / ${inv['monthly_cash_flow']:,}/mo rental")


if __name__ == "__main__":
    main()
