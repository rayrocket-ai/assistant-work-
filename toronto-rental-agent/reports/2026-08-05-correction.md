# Correction — August 5, 2026 reports

The user confirmed that the top picks in today's two reports (295 Arthur St,
Oshawa and 227 Woodfield Rd, Toronto) **sold months ago**. Cached listing pages
and search snippets still showed all of them as "For Sale" — cached pages never
reflect sold status, and this pipeline had no active-status gate.

**Retracted:** 295 Arthur St Oshawa (listed Sept 2025 — 12-series MLS
E12415530, a red flag now codified), 227 Woodfield Rd Toronto (E13229230,
cached page dated June 2026 but confirmed sold).

**Status uncertain:** 185 Laughton Ave (W13616740) — a snippet today said "on
Zolo for 1 day" and it carries a current-series MLS with multiple recent
relistings, but treat as unverified until checked on HouseSigma.

**Active-likely lead (price unknown):** Oshawa triplex MLS **E13089616**
(3 units: 2-bed main VACANT, 2-bed 2nd tenanted, 3-bed 3rd tenanted, 6
parking, near GO/transit; RE/MAX Hallmark First Group). Current-series MLS
with live tenancy detail — worth checking on HouseSigma for price and status.

**Fix applied:** RUNBOOK Step 2.5 adds a hard active-status gate — current
MLS-series check, explicit recency signal, and a negative sold-check — with
anything failing the gate demoted to a labeled "Leads" section. Structural
limitation stated honestly: without logged-in MLS data (HouseSigma account or
an IDX/DDF data feed), sold status is only detectable indirectly; the gate
reduces stale picks sharply but cannot make them impossible.
