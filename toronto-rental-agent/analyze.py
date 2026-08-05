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
            return "✅ YES — covers mortgage + ALL costs"
        if r["rent_covers_mortgage"]:
            return f"✅ covers mortgage (short ${-r['monthly_cash_flow']:,} of total costs)"
        return f"❌ NO (short ${r['monthly_payment'] - r['monthly_rent']:,.0f}/mo on mortgage alone)"

    def money(v, hide_zero=False):
        return "—" if (hide_zero and not v) else f"${v:,.0f}"

    def property_tables(l, own, inv):
        out = []
        out.append("**One-time costs to buy**\n")
        out.append("| Upfront | Owner-occupied (minimum down) | Pure rental (20% down) |")
        out.append("|---|---:|---:|")
        out.append(f"| Down payment | {money(own['down_payment'])} ({own['down_payment_pct']}%) | {money(inv['down_payment'])} ({inv['down_payment_pct']}%) |")
        out.append(f"| CMHC premium (added to loan, not cash) | {money(own['cmhc_premium_added_to_loan'], True)} | {money(inv['cmhc_premium_added_to_loan'], True)} |")
        out.append(f"| PST on CMHC (cash) | {money(own['pst_on_cmhc'], True)} | {money(inv['pst_on_cmhc'], True)} |")
        out.append(f"| Land transfer tax | {money(own['land_transfer_tax'])} | {money(inv['land_transfer_tax'])} |")
        out.append(f"| Legal & closing | {money(own['closing_legal'])} | {money(inv['closing_legal'])} |")
        out.append(f"| **Cash needed to close** | **{money(own['cash_to_close'])}** | **{money(inv['cash_to_close'])}** |")
        out.append(f"| Total mortgage | {money(own['total_loan'])} | {money(inv['total_loan'])} |")
        out.append("\n**Monthly costs vs rent**\n")
        out.append("| Monthly | Owner-occupied | Pure rental |")
        out.append("|---|---:|---:|")
        out.append(f"| Mortgage payment ({own['rate_pct']}%, {own['amortization_years']}yr) | {money(own['monthly_payment'])} | {money(inv['monthly_payment'])} |")
        out.append(f"| Property tax | {money(own['monthly_property_tax'])} | {money(inv['monthly_property_tax'])} |")
        out.append(f"| Insurance | {money(own['monthly_insurance'])} | {money(inv['monthly_insurance'])} |")
        out.append(f"| Maintenance reserve | {money(own['monthly_maintenance'])} | {money(inv['monthly_maintenance'])} |")
        out.append(f"| Vacancy allowance | {money(own['monthly_vacancy'])} | {money(inv['monthly_vacancy'])} |")
        out.append(f"| Landlord-paid utilities | {money(own['monthly_utilities'])} | {money(inv['monthly_utilities'])} |")
        out.append(f"| **Total monthly cost** | **{money(own['monthly_payment'] + own['monthly_operating_costs'])}** | **{money(inv['monthly_payment'] + inv['monthly_operating_costs'])}** |")
        out.append(f"| **Rent income** | **{money(own['monthly_rent'])}** | **{money(inv['monthly_rent'])}** |")
        cf_o, cf_i = own['monthly_cash_flow'], inv['monthly_cash_flow']
        out.append(f"| **Net cash flow** | **{'+' if cf_o >= 0 else '−'}${abs(cf_o):,}/mo** | **{'+' if cf_i >= 0 else '−'}${abs(cf_i):,}/mo** |")
        out.append("\n**Investment metrics**\n")
        out.append("| Metric | Owner-occupied | Pure rental |")
        out.append("|---|---:|---:|")
        out.append(f"| Rent covers mortgage? | {coverage(own)} | {coverage(inv)} |")
        out.append(f"| Breakeven rent | {money(own['breakeven_rent'])} | {money(inv['breakeven_rent'])} |")
        out.append(f"| Cap rate | {own['cap_rate_pct']}% | {inv['cap_rate_pct']}% |")
        out.append(f"| Cash-on-cash return | {own['cash_on_cash_pct']}% | {inv['cash_on_cash_pct']}% |")
        out.append(f"| DSCR | {own['dscr']} | {inv['dscr']} |")
        out.append(f"| Stress-test payment | {money(own['stress_test_payment'])} | {money(inv['stress_test_payment'])} |")
        return "\n".join(out)

    print(f"# Ranked candidates ({len(rows)} analyzed, top {args.top} shown)\n")
    for rank, (s, l, own, inv) in enumerate(rows[: args.top], 1):
        print(f"## {rank}. {l['address']} — {money(l['price'])} — score {s}")
        print(f"{l['units']} units | rent ${l['monthly_rent']:,}/mo ({l.get('rent_source', 'estimate')})  ")
        print(f"{l.get('url', '')}  ")
        print(f"Location: {l.get('location_notes', 'n/a')}\n")
        print(property_tables(l, own, inv))
        print()

    if len(rows) > args.top:
        print("### Also analyzed (didn't make the cut)")
        for s, l, own, inv in rows[args.top:]:
            print(f"- {l['address']} (${l['price']:,}, {l['units']}u): score {s}, "
                  f"cash flow ${own['monthly_cash_flow']:,}/mo owner-occ / ${inv['monthly_cash_flow']:,}/mo rental")


if __name__ == "__main__":
    main()
