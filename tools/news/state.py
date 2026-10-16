"""
Market news: what's been decided so far, and the run log.

news-checks/state.json
  decided       {item id: "approved" | "rejected"}: so an item is only ever shown for review once
  oem_retailers the last list of retailers seen on OEM's site
  pending       {item id: headline}: on-topic headlines waiting for a decision. Kept here, not
                re-read from the feeds, because some feeds only hold a day or two of stories.
news-checks/runs.csv
  one row per run: what was found, and what was approved and when it went live
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHECKS = ROOT / "news-checks"
STATE = CHECKS / "state.json"
LOG = CHECKS / "runs.csv"

COLUMNS = [
    "run_date", "sources_ok", "sources_failed", "items_read", "for_review",
    "approved_by", "approved_at", "approved", "rejected", "applied_at",
]


def load_state(path=STATE):
    if Path(path).exists():
        s = json.loads(Path(path).read_text(encoding="utf-8"))
    else:
        s = {}
    s.setdefault("decided", {})
    s.setdefault("oem_retailers", None)
    s.setdefault("pending", {})
    return s


def save_state(state, path=STATE):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(state, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def record(run_date, path=LOG, **fields):
    """Add or update the row for run_date. Columns not given keep their value."""
    path = Path(path)
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
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:  # utf-8-sig so Excel shows names correctly
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    return path
