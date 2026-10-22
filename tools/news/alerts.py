#!/usr/bin/env python3
"""
Market news: what the daily GitHub run should tell people about.

Reads news-checks/ and prints JSON for .github/workflows/news-collect.yml, which
turns it into GitHub issues (GitHub emails the repo owner about them):
  waiting       headlines in the newest run that nobody has decided on yet
  new           how many of those first turned up in the newest run
  failing       sources that couldn't be read in each of the last 3 runs
  waiting_md    issue text for "Market news waiting for review"
  failing_md    issue text for "Market news sources failing"

Usage:
  python tools/news/alerts.py
  python tools/news/alerts.py --folder news-checks --review-url https://…/staff/review.html
"""
import argparse
import json
import re
import sys
from pathlib import Path

from state import CHECKS, ROOT, load_state

FAIL_DAYS = 3
REVIEW_URL = "https://eutility-savings.vercel.app/staff/review.html"


def runs(folder):
    """The run folders that have a candidates.json, oldest first."""
    return sorted(d for d in Path(folder).iterdir() if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d.name) and (d / "candidates.json").exists())


def read(run):
    return json.loads((run / "candidates.json").read_text(encoding="utf-8"))


def waiting_items(latest, decided):
    return [it for it in latest["items"] if it["id"] not in decided]


def failing_sources(recent, days=FAIL_DAYS):
    """Sources with an error in every one of the last `days` runs: [{source, error, since}]."""
    if len(recent) < days:
        return []
    last = recent[-days:]
    errs = [{s["source"]: s["error"] for s in r["sources"] if s.get("error")} for r in last]
    return [{"source": name, "error": errs[-1][name], "since": last[0]["run"]}
            for name in errs[-1] if all(name in e for e in errs)]


def summarise(folder=CHECKS, review_url=REVIEW_URL):
    found = runs(folder)
    if not found:
        return {"run": None, "waiting": 0, "new": 0, "failing": [], "waiting_md": "", "failing_md": ""}
    recent = [read(r) for r in found[-FAIL_DAYS:]]
    latest = recent[-1]
    waiting = waiting_items(latest, load_state(Path(folder) / "state.json")["decided"])
    before = {it["id"] for it in recent[-2]["items"]} if len(recent) > 1 else set()
    new = [it for it in waiting if it["id"] not in before]
    failing = failing_sources(recent)

    lines = "\n".join(f"- {it['date']} · {it['source']}: [{it['title']}]({it['url']})" for it in waiting)
    waiting_md = (f"**{len(waiting)} headline(s)** from the {latest['run']} run are waiting for a decision.\n\n"
                  f"Approve or reject them on the staff Review page: {review_url}\n\n{lines}\n\n"
                  "Nothing goes on the website until someone approves it. This issue closes by itself when nothing is waiting.")
    failing_md = ("These sources couldn't be read in each of the last "
                  f"{FAIL_DAYS} daily runs, so their headlines are missing from the Review page:\n\n"
                  + "\n".join(f"- **{f['source']}** since {f['since']}: `{f['error']}`" for f in failing)
                  + "\n\nThe other sources still run. Check whether the site changed or now blocks automated readers; "
                  "don't work around a block. This issue closes by itself once they read again.") if failing else ""
    return {"run": latest["run"], "waiting": len(waiting), "new": len(new), "failing": failing,
            "waiting_md": waiting_md if waiting else "", "failing_md": failing_md}


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--folder", default=str(CHECKS))
    ap.add_argument("--review-url", default=REVIEW_URL)
    args = ap.parse_args()
    print(json.dumps(summarise(ROOT / args.folder, args.review_url), ensure_ascii=False))


if __name__ == "__main__":
    main()
