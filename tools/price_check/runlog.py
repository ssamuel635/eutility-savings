"""
Weekly price check: the run log (price-checks/runs.csv).

One row per run. compare.py fills in what the agent found; apply.py adds what
the approver approved and when it went live. Opens in Excel, so it doubles as
the record of how reliable the agent is week to week.
"""
import csv
from pathlib import Path

COLUMNS = [
    "run_date", "rates_as_at", "plans_total", "plans_confirmed", "coverage_pct",
    "changed", "withdrawn", "new", "unverified", "blocked", "double_checked", "promo_updates",
    "approved_by", "approved_at", "plans_approved", "promos_approved", "applied_at",
]


def record(log_dir: Path, run_date: str, **fields):
    """Add or update the row for run_date. Columns not given keep their value."""
    path = Path(log_dir) / "runs.csv"
    rows = []
    if path.exists():
        with path.open(newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
    row = next((r for r in rows if r.get("run_date") == run_date), None)
    if row is None:
        row = {"run_date": run_date}
        rows.append(row)
    row.update({k: "" if v is None else v for k, v in fields.items() if k in COLUMNS})
    rows.sort(key=lambda r: r["run_date"])
    # utf-8-sig so Excel shows names with accents correctly
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    return path


def from_summary(summary):
    """The compare.py half of a row."""
    c, cov = summary["counts"], summary["coverage"]
    return {
        "rates_as_at": summary.get("data_rates_as_at"),
        "plans_total": cov["total"], "plans_confirmed": cov["confirmed"], "coverage_pct": cov["pct"],
        "changed": c["changed"], "withdrawn": c["removed"], "new": c["new"], "unverified": c["unverified"],
        "blocked": summary["blocked"], "double_checked": summary["double_checked"],
        "promo_updates": summary["promo_changes"],
    }
