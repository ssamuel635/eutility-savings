"""Checks the run log keeps one row per run and never loses a half.  Run: python3 tools/price_check/test_runlog.py"""
import csv
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from runlog import record

fails = 0


def check(name, ok):
    global fails
    print(("PASS " if ok else "FAIL ") + name)
    fails += not ok


with tempfile.TemporaryDirectory() as d:
    record(d, "2026-10-19", changed=3, blocked=1)
    record(d, "2026-10-12", changed=5)
    record(d, "2026-10-19", approved_by="Ebin", plans_approved=2)
    record(d, "2026-10-19", not_a_column="ignored")
    rows = list(csv.DictReader(open(Path(d) / "runs.csv", newline="", encoding="utf-8-sig")))
    check("one row per run", len(rows) == 2)
    check("rows sorted by date", [r["run_date"] for r in rows] == ["2026-10-12", "2026-10-19"])
    r = rows[1]
    check("apply's half doesn't wipe compare's half", r["changed"] == "3" and r["blocked"] == "1")
    check("approval recorded", r["approved_by"] == "Ebin" and r["plans_approved"] == "2")
    check("unknown fields ignored", "not_a_column" not in r)

sys.exit(1 if fails else 0)
