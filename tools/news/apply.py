#!/usr/bin/env python3
"""
Market news, step 2: publish the approved headlines.

Reads news-checks/<date>/candidates.json and the approvals saved from
review.html (approved-news-<date>.json, looked for in the run folder, then
Downloads) or by the staff Review page on the website (which passes --approved).
Approved headlines are added to assets/js/data/news.js, which the Market news
page and the homepage read. If the approvals list "rejected" headlines (the
Review page does), only those are set aside and the rest keep waiting;
otherwise (review.html) everything not approved is set aside for good. A copy
of the approvals is kept in the run folder as the record.
Then the pages are rewritten (tools/prerender.mjs) so the news is in the HTML.

Usage:
  python tools/news/apply.py news-checks/2026-10-16
  python tools/news/apply.py news-checks/2026-10-16 --approved FILE
  python tools/news/apply.py news-checks/2026-10-16 --dry-run     # show what would change, save nothing

Then: npm test, commit and deploy.
To take a headline down later: delete its line in assets/js/data/news.js and run `npm run seo`.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from state import ROOT, load_state, record, save_state

NEWS_JS = ROOT / "assets" / "js" / "data" / "news.js"
SGT = timezone(timedelta(hours=8))
KEEP = 100  # newest headlines kept on the site
FIELDS = ("id", "date", "title", "source", "kind", "url")

HEADER = """// Market news: the headlines on news.html and the homepage, newest first.
// Written by tools/news/apply.py from headlines approved in the review page.
// To take one down, delete its line and run `npm run seo` (rewrites the pages).
"""


def read_news(path=NEWS_JS):
    if not Path(path).exists():
        return []
    s = Path(path).read_text(encoding="utf-8")
    m = re.search(r"export const NEWS = (\[.*?\]);", s, re.S)
    return json.loads(m.group(1)) if m else []


def write_news(items, path=NEWS_JS):
    lines = ",\n".join("  " + json.dumps({k: it[k] for k in FIELDS}, ensure_ascii=False) for it in items)
    body = f"[\n{lines}\n]" if items else "[]"
    Path(path).write_text(f"{HEADER}export const NEWS = {body};\n", encoding="utf-8")


def merge(current, approved, keep=KEEP):
    """Current headlines plus the approved ones: no repeats, newest first, at most `keep`."""
    by_id = {it["id"]: it for it in current}
    for it in approved:
        by_id.setdefault(it["id"], it)
    return sorted(by_id.values(), key=lambda x: (x["date"], x["title"]), reverse=True)[:keep]


def split(items, approved_ids, rejected_ids=None):
    """(approved, rejected). Without a rejected list, everything not approved counts as rejected."""
    approved = [it for it in items if it["id"] in approved_ids]
    if rejected_ids is None:
        return approved, [it for it in items if it["id"] not in approved_ids]
    no = set(rejected_ids) - set(approved_ids)
    return approved, [it for it in items if it["id"] in no]


def find_approvals(run, given):
    if given:
        return Path(given)
    if (run / f"approved-news-{run.name}.json").exists():
        return run / f"approved-news-{run.name}.json"
    hits = sorted((Path.home() / "Downloads").glob(f"approved-news-{run.name}*.json"), key=lambda f: f.stat().st_mtime)
    return hits[-1] if hits else None


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run_dir")
    ap.add_argument("--approved")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    run = Path(args.run_dir).resolve()
    cands = json.loads((run / "candidates.json").read_text(encoding="utf-8"))
    file = find_approvals(run, args.approved)
    if not file or not file.exists():
        sys.exit(f"No approvals file for {run.name}. Open {run / 'review.html'}, tick the headlines and press Save approvals.")
    appr = json.loads(file.read_text(encoding="utf-8"))
    if appr.get("run") != run.name:
        sys.exit(f"{file.name} is for the {appr.get('run')} run, not {run.name}.")

    ids = set(appr.get("items", []))
    approved, rejected = split(cands["items"], ids, appr.get("rejected"))
    unknown = ids - {it["id"] for it in cands["items"]}

    print(f"Approved by {appr.get('approved_by')} at {appr.get('approved_at')}")
    for it in approved:
        print(f"  + {it['date']}  {it['source']}: {it['title']}")
    waiting = len(cands["items"]) - len(approved) - len(rejected)
    print(f"  {len(rejected)} set aside" + (f", {waiting} still waiting" if waiting else "") + (f"; {len(unknown)} approved id(s) not in this run, ignored" if unknown else ""))
    if args.dry_run:
        print("Dry run: nothing saved.")
        return

    write_news(merge(read_news(), approved))
    state = load_state()
    state["decided"].update({it["id"]: "approved" for it in approved})
    state["decided"].update({it["id"]: "rejected" for it in rejected})
    save_state(state)
    if file.parent != run:
        shutil.copy2(file, run / f"approved-news-{run.name}.json")
    decided = [state["decided"].get(it["id"]) for it in cands["items"]]  # this run so far, over every batch of approvals
    record(run.name, approved_by=appr.get("approved_by"), approved_at=appr.get("approved_at"),
           approved=decided.count("approved"), rejected=decided.count("rejected"),
           applied_at=datetime.now(SGT).isoformat(timespec="seconds"))

    subprocess.run(["node", str(ROOT / "tools" / "prerender.mjs")], cwd=ROOT, check=True)
    print(f"Saved {len(approved)} headline(s) to {NEWS_JS.relative_to(ROOT)} and rewrote the pages. Next: npm test, commit, deploy.")


if __name__ == "__main__":
    main()
