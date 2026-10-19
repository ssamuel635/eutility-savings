"""Checks the contract-terms guards (terms.py).  Run: python tools/price_check/test_terms.py"""
import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from terms import agree, compare_terms, flags_for, in_source

# Keppel's fact sheet text and the wording approved for the site on 19 Oct 2026: the case that slipped through.
KEPPEL_DEPOSIT_SRC = ("Security Deposit ($) All New Sign-ups HDB 1/2 50 HDB 3/4/5/EA/Jumbo 90 "
                      "Condo/HDUC/EC 120 Others (e.g. shophouse) 190 Landed 220")
KEPPEL_ETF_SRC = ("Early termination charges: A x B x 30% where: A = the number of complete days remaining in the "
                  "Initial Term ... B = the arithmetic average of the Charges ... during the period of the latest 2 months")
KEPPEL_DEPOSIT = ("Billed on your first bill for all new sign-ups: HDB 1–2 room S$50; HDB 3–5 room, Executive or Jumbo S$90; "
                  "condo or EC S$120; other premises (e.g. shophouse) S$190; landed S$220.")
KEPPEL_ETF = "30% of your average daily charge over the last 2 months, for each day left in the contract."

fails = 0


def check(name, ok):
    global fails
    fails += not ok
    print(("PASS" if ok else "FAIL"), name)


good = {"changed": True, "deposit": KEPPEL_DEPOSIT, "deposit_source": KEPPEL_DEPOSIT_SRC,
        "etf": KEPPEL_ETF, "etf_source": KEPPEL_ETF_SRC, "factsheet_date": "2026-09-30"}
check("real Keppel wording passes against its fact sheet", flags_for(good) == [])
check("an amount not in the fact sheet is caught", bool(flags_for({**good, "deposit": KEPPEL_DEPOSIT.replace("S$90", "S$95")})))
check("a changed percentage is caught", bool(flags_for({**good, "etf": KEPPEL_ETF.replace("30%", "35%")})))
check("wording without its source text is blocked", bool(flags_for({"deposit": "S$50", "deposit_source": ""})))
check("no partial-number matches (50 is not in '150')", not in_source(50, "Condo 150"))
check("comma amounts match ('S$1,000' vs '$1,000')", in_source(1000, "Bungalow - $1,000"))
check("two reads with the same numbers agree, whatever the wording",
      agree(good, {**good, "deposit": "HDB 1–2 room S$50, HDB 3–5/Exec/Jumbo S$90, condo/EC S$120, others S$190, landed S$220 (first bill)"}))
check("two reads with a different amount disagree", not agree(good, {**good, "deposit": KEPPEL_DEPOSIT.replace("S$220", "S$200")}))
check("two reads with a different percentage disagree", not agree(good, {**good, "etf": KEPPEL_ETF.replace("30%", "25%")}))
check("phrasing of periods doesn't cause a false disagreement",
      agree({"etf": "S$545 if you leave in the first 12 months, S$327 in months 13 to 24."}, {"etf": "Year 1: S$545. Year 2: S$327."}))
check("a wrong period is still caught against the fact sheet", bool(flags_for({**good, "etf": KEPPEL_ETF.replace("2 months", "12 months")})))

# compare_terms end to end, over a pretend run folder with an earlier run.
with tempfile.TemporaryDirectory() as d:
    runs = Path(d)
    (runs / "2026-10-12").mkdir()
    (runs / "2026-10-12" / "changes.json").write_text(json.dumps({"terms": [
        {"id": "keppel-electric-fixed24", "factsheet_date": "2026-09-30"},
        {"id": "keppel-electric-fixed36", "factsheet_date": "2026-09-01"}]}), encoding="utf-8")
    run = runs / "2026-10-19"
    run.mkdir()
    current = {
        "keppel-electric-fixed24": {"name": "FIXED24", "deposit": "Waived for Singapore Citizens and PRs", "etf": "past 12 months"},
        "keppel-electric-fixed36": {"name": "FIXED36", "deposit": KEPPEL_DEPOSIT, "etf": KEPPEL_ETF},
    }
    finding = {"retailer": "Keppel Electric", "plans": [
        {"name": "FIXED24", "matches_id": "keppel-electric-fixed24", "terms": good},
        {"name": "FIXED36", "matches_id": "keppel-electric-fixed36",
         "terms": {"changed": False, "deposit": None, "etf": None, "factsheet_date": "2026-10-02",
                   "deposit_source": KEPPEL_DEPOSIT_SRC, "etf_source": KEPPEL_ETF_SRC}}]}
    rows = {r["id"]: r for r in compare_terms([finding], [], current, run)}
    f24, f36 = rows["keppel-electric-fixed24"], rows["keppel-electric-fixed36"]
    check("a terms change is found", f24["kind"] == "changed")
    check("one read is not enough: blocked until a second read", f24["trust"]["blocked"] and f24["trust"]["second_read"] == "none")
    check("a newer fact sheet with no change is listed for a look", f36["kind"] == "newer_factsheet")

    verify = [{"plans": [{"matches_id": "keppel-electric-fixed24", "terms": good}]}]
    f24 = {r["id"]: r for r in compare_terms([finding], verify, current, run)}["keppel-electric-fixed24"]
    check("an agreeing second read unblocks it", not f24["trust"]["blocked"] and f24["trust"]["second_read"] == "agrees")
    verify = [{"plans": [{"matches_id": "keppel-electric-fixed24", "terms": {**good, "deposit": KEPPEL_DEPOSIT.replace("S$220", "S$200")}}]}]
    f24 = {r["id"]: r for r in compare_terms([finding], verify, current, run)}["keppel-electric-fixed24"]
    check("a disagreeing second read keeps it blocked", f24["trust"]["blocked"] and f24["trust"]["second_read"] == "disagrees")

sys.exit(1 if fails else 0)
