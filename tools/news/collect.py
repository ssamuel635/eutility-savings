#!/usr/bin/env python3
"""
Market news, step 1: collect headlines for review.

Reads every source in sources.py, keeps electricity-related headlines from the
last 7 days that nobody has decided on yet, and writes:
  news-checks/<date>/candidates.json   the headlines, for apply.py
  news-checks/<date>/review.html       the page where they are approved
Nothing goes on the website from here. A person ticks what should go live in
review.html and presses "Save approvals"; apply.py does the rest.

On-topic headlines are kept in news-checks/state.json until someone decides on
them, for up to 7 days after they were published. So a day the computer was off
loses nothing (some feeds only hold a day of stories), and only the newest
review page ever needs looking at.

The daily run happens on GitHub (.github/workflows/news-collect.yml), which
commits news-checks/ and the Review page on the website reads it from there.
A run on this computer while both are running should use --folder
news-checks-local, so the two never write the same files.

Usage:
  python tools/news/collect.py                   # today (Singapore time)
  python tools/news/collect.py --days 14         # look further back
  python tools/news/collect.py --folder news-checks-local   # a side copy (not committed)
"""
import argparse
import json
import shutil
import sys
from datetime import datetime, timedelta

import sources as S
from review import render
from state import CHECKS, ROOT, load_state, record, save_state

PARSERS = {"rss": S.parse_rss, "sp-group": S.parse_sp_group}


def update_pending(state, found, today, days):
    """Add today's on-topic, undecided headlines to the waiting list; drop decided and expired ones.
    Returns the list to review, newest first (official sources first on the same day)."""
    oldest = (today - timedelta(days=days)).isoformat()
    newest = today.isoformat()
    pend, decided = state["pending"], state["decided"]
    for it in found:
        if it["keywords"] and it["id"] not in decided and oldest <= it["date"] <= newest:
            pend.setdefault(it["id"], it)
    state["pending"] = {k: v for k, v in pend.items() if k not in decided and v["date"] >= oldest}
    return sorted(state["pending"].values(), key=lambda x: (x["date"], x["kind"] == "official", x["title"]), reverse=True)


def check_oem(src, state, now):
    """Compare OEM's retailer list with last time. Returns (retailer count, headline about a change or None)."""
    names = S.parse_oem_retailers(S.fetch(src["url"]))
    before = state["oem_retailers"]
    state["oem_retailers"] = names
    return len(names), (S.oem_change_item(src, before, names, now) if before is not None else None)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to cp1252
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--folder", default=str(CHECKS), help="where runs, state.json and runs.csv go (default news-checks)")
    args = ap.parse_args()

    now = datetime.now(S.SGT)
    today = now.date()
    folder = ROOT / args.folder
    run = folder / today.isoformat()
    run.mkdir(parents=True, exist_ok=True)
    if not (folder / "state.json").exists() and (CHECKS / "state.json").exists():
        shutil.copy2(CHECKS / "state.json", folder / "state.json")  # a side copy starts from what's been decided
    state = load_state(folder / "state.json")

    items, report = [], []
    for src in S.SOURCES:
        row = {"source": src["name"], "kind": src["kind"], "url": src["url"], "read": 0, "error": ""}
        try:
            if src["type"] == "oem-retailers":
                row["read"], change = check_oem(src, state, now)
                row["note"] = f"{row['read']} retailers listed" + (", list changed" if change else ", no change")
                items += [change] if change else []
            else:
                found = PARSERS[src["type"]](src, S.fetch(src["url"], raw=src["type"] == "rss"))
                row["read"] = len(found)
                items += found
        except Exception as e:  # one source failing never stops the others
            row["error"] = f"{type(e).__name__}: {e}"
        report.append(row)

    picked = update_pending(state, items, today, args.days)

    data = {"run": today.isoformat(), "collected_at": now.isoformat(timespec="seconds"),
            "days": args.days, "sources": report, "items": picked}
    (run / "candidates.json").write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (run / "review.html").write_text(render(data), encoding="utf-8")
    save_state(state, folder / "state.json")

    failed = [r for r in report if r["error"]]
    record(today.isoformat(), path=folder / "runs.csv", sources_ok=len(report) - len(failed), sources_failed=len(failed),
           items_read=sum(r["read"] for r in report if "note" not in r), for_review=len(picked))

    print(f"Market news {today}: {len(picked)} headline(s) to review from the last {args.days} days.")
    for r in report:
        status = f"couldn't read ({r['error']})" if r["error"] else r.get("note") or f"{r['read']} headlines read"
        print(f"  {r['source']:<26} {status}")
    print(f"Review page: {run / 'review.html'}")


if __name__ == "__main__":
    main()
