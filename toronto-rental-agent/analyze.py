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
    "days_on_market": 12
  }, ...
]

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
        r = analyze(l["price"], l["units"], l["monthly_rent"],
                    rate_pct=args.rate, config=cfg)
        rows.append((score(r, l), l, r))
    rows.sort(key=lambda x: -x[0])

    print(f"# Ranked candidates ({len(rows)} analyzed, top {args.top} shown)\n")
    for rank, (s, l, r) in enumerate(rows[: args.top], 1):
        cov = "rent covers mortgage + all costs" if r["rent_covers_everything"] else (
            "rent covers mortgage" if r["rent_covers_mortgage"] else
            f"rent does NOT cover mortgage (short ${r['monthly_payment'] - r['monthly_rent']:,}/mo)")
        print(f"## {rank}. {l['address']} — score {s}")
        print(f"- **${l['price']:,}** | {l['units']} units | rent ${l['monthly_rent']:,}/mo ({l.get('rent_source', 'estimate')})")
        print(f"- {l.get('url', '')}")
        print(f"- Location: {l.get('location_notes', 'n/a')}")
        print(f"- Min down **${r['down_payment']:,}** ({r['down_payment_pct']}%), cash to close ${r['cash_to_close']:,}")
        print(f"- Mortgage ${r['monthly_payment']:,}/mo @ {r['rate_pct']}%; opex ${r['monthly_operating_costs']:,}/mo")
        print(f"- **Cash flow ${r['monthly_cash_flow']:,}/mo** — {cov}")
        print(f"- Cap rate {r['cap_rate_pct']}% | cash-on-cash {r['cash_on_cash_pct']}% | DSCR {r['dscr']} | breakeven rent ${r['breakeven_rent']:,}")
        print()

    if len(rows) > args.top:
        print("### Also analyzed (didn't make the cut)")
        for s, l, r in rows[args.top:]:
            print(f"- {l['address']} (${l['price']:,}, {l['units']}u): score {s}, cash flow ${r['monthly_cash_flow']:,}/mo")


if __name__ == "__main__":
    main()
