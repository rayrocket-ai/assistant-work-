# Toronto Rental-Property Scout

A daily agent that hunts for Toronto-area investment properties **under $1M with
3+ units** where **rent covers the mortgage at minimum down payment**, runs the
full Canadian financing math, and delivers the top 2–3 picks every morning.

## How it works
- A scheduled Routine fires a fresh Claude session every morning.
- The session follows [`RUNBOOK.md`](RUNBOOK.md): searches HouseSigma, Realtor.ca,
  Zolo, and listing.ca; establishes rents; scores every candidate with
  `analyze.py`; and writes/sends a report from `reports/`.

## The math (`mortgage.py`)
Encodes real Canadian rules:
- **Minimum down payment**: 5%/10% blend for 1–2 units (insured up to $1.5M),
  **10% for 3–4 unit owner-occupied**, 20% non-owner-occupied, 25% for 5+ units.
- CMHC premium (up to 4%) rolled into the loan; Ontario PST on the premium paid in cash.
- Semi-annual compounding (Canadian fixed mortgages), 25-yr amortization.
- Stress-test payment at max(rate + 2%, 5.25%).
- Ontario **and** Toronto municipal land transfer tax in cash-to-close.
- Operating costs: property tax, insurance, maintenance, vacancy, landlord utilities.
- Outputs: monthly cash flow, rent-covers-mortgage check, breakeven rent,
  cap rate, cash-on-cash return, DSCR.

Try it:
```bash
python3 mortgage.py --price 949000 --units 3 --rent 5600
python3 analyze.py candidates.json --rate 4.09 --top 3
```

Tune criteria and cost assumptions in [`config.json`](config.json).
