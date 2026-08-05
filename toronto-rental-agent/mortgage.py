#!/usr/bin/env python3
"""Canadian mortgage + rental cash-flow calculator for Toronto multiplex deals.

Encodes the rules that matter for "minimum down payment" investing in Canada:
  - Min down: 5% of first $500k + 10% of the rest for 1-2 unit owner-occupied
    (insurable up to $1.5M), 10% for 3-4 unit owner-occupied, 20% if not
    owner-occupied, 25% for 5+ units (CMHC multi-unit / commercial territory).
  - CMHC insurance premium added to the loan (PST on the premium is due in cash
    at closing in Ontario).
  - Canadian fixed mortgages compound semi-annually, not monthly.
  - Ontario + Toronto municipal land transfer tax (both apply in Toronto).

CLI:
  python3 mortgage.py --price 949000 --units 3 --rent 5600 [--rate 4.09]
"""

import argparse
import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

CMHC_PREMIUM_TIERS = [  # (max LTV, premium as % of loan)
    (0.65, 0.0060),
    (0.75, 0.0170),
    (0.80, 0.0240),
    (0.85, 0.0280),
    (0.90, 0.0310),
    (0.95, 0.0400),
]


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def min_down_payment(price, units, owner_occupied=True):
    """Minimum down payment in dollars, per Canadian insured-mortgage rules."""
    if units >= 5:
        return 0.25 * price  # commercial/CMHC MLI territory
    if not owner_occupied:
        return 0.20 * price  # pure rental: uninsured, 20% minimum
    if units >= 3:
        return 0.10 * price  # 3-4 units, owner lives in one
    if price <= 500_000:
        return 0.05 * price
    if price <= 1_500_000:
        return 0.05 * 500_000 + 0.10 * (price - 500_000)
    return 0.20 * price  # above insurable cap


def cmhc_premium(loan, price):
    ltv = loan / price
    if ltv <= 0.80:
        return 0.0  # conventional, no insurance required
    for max_ltv, pct in CMHC_PREMIUM_TIERS:
        if ltv <= max_ltv + 1e-9:
            return loan * pct
    raise ValueError(f"LTV {ltv:.1%} exceeds 95% — not insurable")


def monthly_payment(loan, annual_rate_pct, amort_years):
    """Payment with Canadian semi-annual compounding."""
    r = (1 + annual_rate_pct / 100 / 2) ** (1 / 6) - 1  # effective monthly rate
    n = amort_years * 12
    if r == 0:
        return loan / n
    return loan * r / (1 - (1 + r) ** -n)


def land_transfer_tax(price, units, toronto=True):
    """Ontario LTT; doubled in the City of Toronto (MLTT mirrors it)."""
    def ltt(p):
        tax = 0.0
        brackets = [(55_000, 0.005), (250_000, 0.01), (400_000, 0.015)]
        prev = 0
        for cap, rate in brackets:
            if p > prev:
                tax += (min(p, cap) - prev) * rate
            prev = cap
        if p > 400_000:
            # the 2% bracket applies to homes with 1-2 single-family residences;
            # 3+ unit residential stays at 1.5% above $400k
            rate = 0.015 if units >= 3 else 0.02
            tax += (min(p, 2_000_000) - 400_000) * rate
            if p > 2_000_000:
                tax += (p - 2_000_000) * 0.025
        return tax

    return ltt(price) * (2 if toronto else 1)


def analyze(price, units, monthly_rent, rate_pct=None, amort_years=None,
            owner_occupied=None, toronto=True, config=None):
    cfg = config or load_config()
    a = cfg["assumptions"]
    fin = cfg["financing"]
    rate_pct = rate_pct if rate_pct is not None else fin["default_rate_pct"]
    amort_years = amort_years or fin["amortization_years"]
    owner_occupied = fin["owner_occupied"] if owner_occupied is None else owner_occupied

    down = min_down_payment(price, units, owner_occupied)
    base_loan = price - down
    premium = cmhc_premium(base_loan, price)
    loan = base_loan + premium
    pst_on_premium = premium * a["ontario_pst_on_cmhc_pct"]
    ltt = land_transfer_tax(price, units, toronto)
    cash_to_close = down + pst_on_premium + ltt + a["closing_legal_misc"]

    pmt = monthly_payment(loan, rate_pct, amort_years)
    stress_pmt = monthly_payment(loan, max(rate_pct + 2, 5.25), amort_years)

    tax_mo = price * a["property_tax_pct_of_price"] / 12
    maint_mo = price * a["maintenance_pct_of_price_yr"] / 12
    vacancy_mo = monthly_rent * a["vacancy_pct_of_rent"]
    opex_mo = tax_mo + a["insurance_monthly"] + maint_mo + vacancy_mo + a["landlord_paid_utilities_monthly"]

    noi_yr = (monthly_rent - opex_mo) * 12
    cash_flow_mo = monthly_rent - opex_mo - pmt
    dscr = noi_yr / (pmt * 12) if pmt else float("inf")

    return {
        "price": price,
        "units": units,
        "owner_occupied": owner_occupied,
        "rate_pct": rate_pct,
        "amortization_years": amort_years,
        "down_payment": round(down),
        "down_payment_pct": round(down / price * 100, 1),
        "cmhc_premium_added_to_loan": round(premium),
        "total_loan": round(loan),
        "land_transfer_tax": round(ltt),
        "cash_to_close": round(cash_to_close),
        "monthly_payment": round(pmt),
        "stress_test_payment": round(stress_pmt),
        "monthly_rent": monthly_rent,
        "pst_on_cmhc": round(pst_on_premium),
        "closing_legal": a["closing_legal_misc"],
        "monthly_property_tax": round(tax_mo),
        "monthly_insurance": a["insurance_monthly"],
        "monthly_maintenance": round(maint_mo),
        "monthly_vacancy": round(vacancy_mo),
        "monthly_utilities": a["landlord_paid_utilities_monthly"],
        "monthly_operating_costs": round(opex_mo),
        "monthly_cash_flow": round(cash_flow_mo),
        "rent_covers_mortgage": monthly_rent >= pmt,
        "rent_covers_everything": cash_flow_mo >= 0,
        "breakeven_rent": round(opex_mo + pmt),
        "cap_rate_pct": round(noi_yr / price * 100, 2),
        "cash_on_cash_pct": round(cash_flow_mo * 12 / cash_to_close * 100, 2),
        "dscr": round(dscr, 2),
    }


def format_report(r):
    lines = [
        f"Price ${r['price']:,.0f} | {r['units']} units | {'owner-occ' if r['owner_occupied'] else 'rental'}",
        f"  Min down: ${r['down_payment']:,} ({r['down_payment_pct']}%) "
        f"+ CMHC ${r['cmhc_premium_added_to_loan']:,} rolled into loan of ${r['total_loan']:,}",
        f"  Cash to close (down + LTT ${r['land_transfer_tax']:,} + PST/legal): ${r['cash_to_close']:,}",
        f"  Mortgage: ${r['monthly_payment']:,}/mo @ {r['rate_pct']}% / {r['amortization_years']}yr "
        f"(stress-test ${r['stress_test_payment']:,}/mo)",
        f"  Rent ${r['monthly_rent']:,.0f}/mo vs costs ${r['monthly_operating_costs']:,} opex + mortgage "
        f"-> cash flow ${r['monthly_cash_flow']:,}/mo",
        f"  Rent covers mortgage: {'YES' if r['rent_covers_mortgage'] else 'NO'} | "
        f"covers everything: {'YES' if r['rent_covers_everything'] else 'NO'} | "
        f"breakeven rent ${r['breakeven_rent']:,}",
        f"  Cap rate {r['cap_rate_pct']}% | cash-on-cash {r['cash_on_cash_pct']}% | DSCR {r['dscr']}",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Toronto multiplex deal analyzer")
    p.add_argument("--price", type=float, required=True)
    p.add_argument("--units", type=int, required=True)
    p.add_argument("--rent", type=float, required=True, help="total monthly rent, all units")
    p.add_argument("--rate", type=float, default=None, help="annual rate %% (default from config)")
    p.add_argument("--amort", type=int, default=None)
    p.add_argument("--not-owner-occupied", action="store_true")
    p.add_argument("--outside-toronto", action="store_true", help="single LTT instead of double")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    result = analyze(
        args.price, args.units, args.rent,
        rate_pct=args.rate, amort_years=args.amort,
        owner_occupied=False if args.not_owner_occupied else None,
        toronto=not args.outside_toronto,
    )
    print(json.dumps(result, indent=2) if args.json else format_report(result))
