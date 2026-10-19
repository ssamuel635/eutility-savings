"""
Weekly price check: contract terms (security deposit and early termination fee).

Prices aren't the only thing that changes. Keppel's deposit and ETF changed in
Oct 2026 and sat stale on the site for two weeks because the check only read
prices. So the agent now also reads each plan's deposit and ETF from its fact
sheet and reports them per plan in raw/<key>.json (see PROCEDURE.md):

  "terms": {"factsheet_date": "YYYY-MM-DD",
            "deposit_source": "exact text copied from the fact sheet",
            "etf_source": "exact text copied from the fact sheet",
            "changed": true,
            "deposit": "proposed site wording, or null if ours still matches",
            "etf": "proposed site wording, or null if ours still matches"}

Guards (a terms change that fails any is blocked, like a price):
  - every number in the proposed wording must appear in the copied source text
  - a change needs a second, independent read with the same dollar amounts and percentages
A plan whose fact sheet is newer than last time, but where no change was found,
is listed for a quick look (no approval needed).
"""
import json
import re

FIELDS = (("deposit", "Deposit"), ("etf", "Early termination fee"))


def numbers(text):
    """The numbers a customer would rely on: amounts, percentages, months, room counts."""
    q = str(text or "").replace(",", "")
    return {float(n) for n in re.findall(r"(?<![\w.])\d+(?:\.\d+)?", q)}


def in_source(value, source):
    """Is the number in the copied text? 50 matches '$50', '50.00' or '50 '; not '150'."""
    q = str(source or "").replace(",", "")
    forms = {f"{value:g}", f"{value:.2f}", f"{value:.1f}"}
    return any(re.search(rf"(?<![\d.]){re.escape(f)}(?![\d])", q) for f in forms)


def flags_for(t):
    """What's wrong with one read's proposed terms (empty list = passes)."""
    out = []
    for key, label in FIELDS:
        new = t.get(key)
        if not new:
            continue
        src = t.get(f"{key}_source")
        if not src:
            out.append(f"{label}: no source text copied")
            continue
        missing = sorted(n for n in numbers(new) if not in_source(n, src))
        if missing:
            out.append(f"{label}: not in the copied source text: " + ", ".join(f"{n:g}" for n in missing))
    return out


def amounts(text):
    """Dollar amounts and percentages only: the figures two reads must agree on.
    (Other numbers depend on phrasing — "year 1" vs "first 12 months" — and are
    checked against the fact sheet text instead.)"""
    q = str(text or "").replace(",", "")
    money = {float(n) for n in re.findall(r"\$\s?(\d+(?:\.\d+)?)", q)}
    pct = {float(n) for n in re.findall(r"(\d+(?:\.\d+)?)\s?%", q)}
    return money, pct


def agree(a, b):
    """Two independent reads agree if they propose the same amounts and percentages for each field."""
    return all(amounts(a.get(k)) == amounts(b.get(k)) for k, _ in FIELDS if a.get(k) or b.get(k))


def previous_factsheet_dates(run_dir):
    """id -> the latest fact sheet date seen in an earlier run."""
    seen = {}
    for prev in sorted(run_dir.parent.glob("*/changes.json")):
        if prev.parent.name >= run_dir.name:
            continue
        try:
            for r in json.loads(prev.read_text(encoding="utf-8")).get("terms", []):
                if r.get("id") and r.get("factsheet_date"):
                    seen[r["id"]] = r["factsheet_date"]
        except (OSError, ValueError):
            pass
    return seen


def compare_terms(findings, verify, current, run_dir):
    """Rows for the report's "Contract terms" section, plus every plan's fact sheet date for next week."""
    ver = {pl["matches_id"]: pl.get("terms") for v in verify for pl in v.get("plans", []) if pl.get("matches_id")}
    before = previous_factsheet_dates(run_dir)
    rows = []
    for f in findings:
        for pl in f.get("plans", []):
            pid, t = pl.get("matches_id"), pl.get("terms")
            if not t or pid not in current:
                continue
            cur = current[pid]
            row = {"id": pid, "retailer": f["retailer"], "plan": cur["name"], "source": pl.get("source_url"),
                   "factsheet_date": t.get("factsheet_date"), "prev_factsheet_date": before.get(pid),
                   "old": {k: cur.get(k) for k, _ in FIELDS},
                   "new": {k: t.get(k) for k, _ in FIELDS},
                   "evidence": {k: t.get(f"{k}_source") for k, _ in FIELDS}}
            changed = bool(t.get("changed")) and any(t.get(k) and t.get(k) != cur.get(k) for k, _ in FIELDS)
            newer = bool(row["prev_factsheet_date"] and row["factsheet_date"] and row["factsheet_date"] > row["prev_factsheet_date"])
            row["kind"] = "changed" if changed else ("newer_factsheet" if newer else "same")
            if changed:
                flags = flags_for(t)
                second = ver.get(pid)
                if second is None:
                    sr = "none"
                    flags.append("terms change: needs a second, independent read before approval")
                elif agree(t, second):
                    sr = "agrees"
                else:
                    sr = "disagrees"
                    flags.append("the second read found different numbers")
                row["trust"] = {"flags": flags, "second_read": sr, "blocked": bool(flags)}
            rows.append(row)
    return rows
