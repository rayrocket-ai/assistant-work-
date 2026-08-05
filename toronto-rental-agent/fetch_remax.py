#!/usr/bin/env python3
"""Live listing fetcher backed by remax.ca (server-rendered, curl-friendly,
MLS-synced — listings disappear when sold, and detail pages carry datePosted,
so everything found here is verifiably ACTIVE).

Flow: fetch each city's search page (price-capped), parse the embedded
schema.org ItemList (address, price, beds, baths, sqft, MLS#, URL), keep
plausible multiplex candidates (beds >= --min-beds, not an apartment-unit
address), then fetch each candidate's detail page and keyword-match the
description for real multi-unit evidence (triplex / fourplex / legal duplex /
self-contained units...). Emits candidates JSON compatible with analyze.py
(rent left null — the agent estimates it from the description + market data).

Usage:
  python3 fetch_remax.py --max-price 1000000 [--cities toronto,oshawa,...]
                         [--min-beds 4] [--max-details 25] [-o candidates.json]
"""

import argparse
import json
import re
import subprocess
import sys
import time

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36")

DEFAULT_CITIES = ["toronto", "mississauga", "brampton", "vaughan", "markham",
                  "pickering", "ajax", "whitby", "oshawa"]

MULTI_UNIT_RE = re.compile(
    r"triplex|tri-plex|fourplex|four-plex|4-plex|multiplex|multi-plex"
    r"|legal duplex|duplex with|self-contained (?:unit|suite|apartment)"
    r"|three (?:self-contained )?(?:units|apartments|suites)"
    r"|3 (?:self-contained )?(?:units|apartments|suites)"
    r"|4 (?:self-contained )?(?:units|apartments|suites)"
    r"|basement apartment|in-law suite|second suite|garden suite",
    re.I)

APT_UNIT_ADDR_RE = re.compile(r"^\s*#?\w{1,6}\s+-\s+\d")  # "714 - 135 East Liberty"


def fetch(url, timeout=30):
    r = subprocess.run(
        ["curl", "-sS", "--max-time", str(timeout), "-H", f"User-Agent: {UA}",
         "-H", "Accept: text/html,application/xhtml+xml", url],
        capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


def parse_search(html):
    """Pull every schema.org RealEstateListing (with an Offer) out of the
    page's JSON-LD, wherever it's nested (CollectionPage > ItemList > ...)."""
    found = []

    def walk(o):
        if isinstance(o, dict):
            if o.get("@type") == "RealEstateListing" and isinstance(o.get("offers"), dict):
                offer = o["offers"]
                prop = offer.get("itemOffered", {}) or {}
                addr = (prop.get("address") or {})
                found.append({
                    "address": addr.get("streetAddress", ""),
                    "locality": addr.get("addressLocality", ""),
                    "price": offer.get("price"),
                    "beds": prop.get("numberOfBedrooms"),
                    "baths": prop.get("numberOfBathroomsTotal"),
                    "sqft": (prop.get("floorSize") or {}).get("value"),
                    "mls": (o.get("identifier") or {}).get("value", ""),
                    "url": o.get("url", ""),
                })
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            walk(json.loads(m.group(1)))
        except json.JSONDecodeError:
            continue
    return found


def parse_detail(html):
    desc = ""
    m = re.search(r'"description"\s*:\s*"(.*?)(?<!\\)"', html)
    if m:
        desc = json.loads(f'"{m.group(1)}"')  # unescape
    posted = ""
    m = re.search(r'"datePosted"\s*:\s*"([^"]+)"', html)
    if m:
        posted = m.group(1)
    return desc, posted


def infer_units(text):
    t = text.lower()
    if re.search(r"fourplex|four-plex|4-plex|4 (?:self-contained )?(?:units|apartments|suites)", t):
        return 4
    if re.search(r"triplex|tri-plex|three (?:self-contained )?(?:units|apartments|suites)|3 (?:self-contained )?(?:units|apartments|suites)", t):
        return 3
    if re.search(r"legal duplex|duplex", t) and re.search(r"basement apartment|in-law|third", t):
        return 3
    if re.search(r"duplex|2 units|two units|basement apartment|second suite", t):
        return 2
    return 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max-price", type=int, default=1_000_000)
    p.add_argument("--cities", default=",".join(DEFAULT_CITIES))
    p.add_argument("--min-beds", type=int, default=4)
    p.add_argument("--pages", type=int, default=1, help="search pages per city (26 listings each)")
    p.add_argument("--max-details", type=int, default=25)
    p.add_argument("-o", "--out", default="candidates.json")
    args = p.parse_args()

    shortlist, seen = [], set()
    for city in args.cities.split(","):
        rows = []
        for pg in range(1, args.pages + 1):
            url = (f"https://www.remax.ca/on/{city.strip()}-real-estate"
                   f"?priceMax={args.max_price}&pageNumber={pg}")
            page_rows = parse_search(fetch(url))
            rows.extend(page_rows)
            if not page_rows:
                break
            time.sleep(1)
        kept = 0
        for r in rows:
            if not r["price"] or r["price"] > args.max_price or r["url"] in seen:
                continue
            if APT_UNIT_ADDR_RE.match(r["address"] or ""):
                continue  # condo/apartment unit
            if (r["beds"] or 0) < args.min_beds:
                continue
            seen.add(r["url"])
            r["city"] = city
            shortlist.append(r)
            kept += 1
        print(f"[{city}] {len(rows)} listings on page, {kept} shortlisted", file=sys.stderr)
        time.sleep(1)

    # Spend detail fetches on the most multiplex-likely first: more bedrooms,
    # then more bathrooms (each self-contained unit adds one), then cheaper.
    shortlist.sort(key=lambda r: (-(r["beds"] or 0), -(r["baths"] or 0), r["price"] or 0))

    candidates = []
    for r in shortlist[: args.max_details]:
        html = fetch(r["url"])
        desc, posted = parse_detail(html)
        units = infer_units(desc)
        if units >= 2 and MULTI_UNIT_RE.search(desc):
            candidates.append({
                "address": f"{r['address']}",
                "url": r["url"],
                "price": r["price"],
                "units": units,
                "monthly_rent": None,
                "rent_source": "TO ESTIMATE",
                "location_notes": r["locality"],
                "mls": r["mls"],
                "date_posted": posted,
                "beds": r["beds"], "baths": r["baths"], "sqft": r["sqft"],
                "description": desc[:900],
            })
            print(f"  CANDIDATE ({units}u, posted {posted}): {r['address']} ${r['price']:,}", file=sys.stderr)
        time.sleep(1)

    with open(args.out, "w") as f:
        json.dump(candidates, f, indent=1)
    print(f"{len(candidates)} multi-unit candidates -> {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
