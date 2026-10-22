#!/usr/bin/env python3
"""
Publish approved changes: the one path for the market news and the weekly price check.

  1. apply the approvals   news:  tools/news/apply.py news-checks/<run> --approved FILE
                           price: tools/price_check/apply.py price-checks/<run> --approved FILE,
                                  then tools/build_data.py --rates-date <run>
  2. npm run seo, npm run preload (rewrite the pages)
  3. npm test                     (a failure stops here: exit code 1, nothing to deploy)

Deploying is left to the caller: .github/workflows/publish.yml commits and runs
`vercel deploy --prod` after this succeeds; on this computer, `npx vercel --prod`.

Usage:
  python tools/publish.py news 2026-10-22 --approved news-checks/2026-10-22/approved-news-2026-10-22-0915.json
  python tools/publish.py price 2026-10-26 --approved price-checks/2026-10-26/approved-2026-10-26.json
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KINDS = {
    "news": {"folder": "news-checks", "apply": "tools/news/apply.py", "file": "approved-news-"},
    "price": {"folder": "price-checks", "apply": "tools/price_check/apply.py", "file": "approved-"},
}


def approvals_path(kind, run, given):
    """The approvals file, which must sit in that run's own folder and be named for it."""
    k = KINDS[kind]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", run):
        raise ValueError(f"run must be a date like 2026-10-22, not {run!r}")
    folder = (ROOT / k["folder"] / run).resolve()
    f = (ROOT / given).resolve()
    if f.parent != folder or not f.name.startswith(k["file"] + run) or f.suffix != ".json":
        raise ValueError(f"{given} isn't an approvals file in {k['folder']}/{run}/")
    if not f.exists():
        raise ValueError(f"{given} doesn't exist")
    return folder, f


def steps(kind, run, folder, file):
    py, npm = sys.executable, shutil.which("npm") or "npm"
    out = [[py, KINDS[kind]["apply"], str(folder), "--approved", str(file)]]
    if kind == "price":
        out.append([py, "tools/build_data.py", "--rates-date", run])
    return out + [[npm, "run", "seo"], [npm, "run", "preload"], [npm, "test"]]


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=KINDS)
    ap.add_argument("run")
    ap.add_argument("--approved", required=True, help="approvals file, relative to the project folder")
    a = ap.parse_args()
    try:
        folder, file = approvals_path(a.kind, a.run, a.approved)
    except ValueError as e:
        sys.exit(f"Nothing published: {e}")
    for cmd in steps(a.kind, a.run, folder, file):
        print("\n$ " + " ".join(Path(c).name if i == 0 else c for i, c in enumerate(cmd)), flush=True)
        if subprocess.run(cmd, cwd=ROOT).returncode:
            sys.exit("Stopped: that step failed, so nothing should be deployed.")
    print(f"\nApplied the {a.kind} approvals for {a.run} and the tests pass. Ready to deploy.")


if __name__ == "__main__":
    main()
