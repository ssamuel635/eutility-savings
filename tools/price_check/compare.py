#!/usr/bin/env python3
"""
Weekly price check — step 2 of 3 (compare).

  Step 1 (agent): read each retailer's official site and write one JSON file per
          retailer into price-checks/<date>/raw/  (format: see PROCEDURE.md).
  Step 2 (this script): compare those findings with the data the site uses today
          (assets/js/data/plans.js), and write:
            price-checks/<date>/report.html   — for a person to review and approve
            price-checks/<date>/changes.json  — the proposed edits, machine-readable
  Step 3 (person): approve or reject each change. Approved changes are then applied
          to data/price-comparison-sheet.xlsx and the site is rebuilt.

Nothing here edits the sheet or the website.

Usage:  python3 tools/price_check/compare.py price-checks/2026-10-12
"""
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TYPICAL_KWH = 450          # HDB 4-room-ish, the site's default
OFFPEAK_SHARE = 0.30       # same default as the website
DAYS = 30.4
TOL = 0.005                # ¢/kWh differences smaller than this are rounding


# ── Load what the site uses today ────────────────────────────────────────────
def load_current():
    js = (ROOT / "assets/js/data/plans.js").read_text(encoding="utf-8")
    meta = json.loads(re.search(r"export const META = (\{.*?\});", js, re.S).group(1))
    plans = json.loads(re.search(r"export const PLANS = (\[.*\]);", js, re.S).group(1))
    return meta, {p["id"]: p for p in plans}


# ── The same maths as assets/js/calc.js (kept deliberately simple) ──────────
def monthly(p, tariff, kwh=TYPICAL_KWH):
    t = p.get("type") or p.get("pricingType")
    daily = (p.get("dailyCharge") or 0) * DAYS
    if t in ("fixed", "regulated"):
        if p.get("rate") is None:
            return None
        cents = kwh * p["rate"]
    elif t == "dot":
        d = p.get("discount")
        if not d:
            return None
        rate = tariff - d["value"] if d["kind"] == "cents" else tariff * (1 - d["value"] / 100)
        cents = kwh * rate
    elif t == "tou":
        tou = p.get("tou") or {}
        try:
            off, peak = tou["offPeak"]["rate"], tou["peak"]["rate"]
        except (KeyError, TypeError):
            return None
        if off is None or peak is None:
            return None
        share = 1 - (1 - OFFPEAK_SHARE) * (5 / 7) if tou.get("weekendOffPeak") else OFFPEAK_SHARE
        cents = kwh * share * off + kwh * (1 - share) * peak
    elif t == "tiered":
        cents = 0
        for b in p.get("tiers") or []:
            lo, hi = b.get("from") or 0, b.get("to") or float("inf")
            if b.get("rate") is None:
                return None
            cents += max(0, min(kwh, hi) - lo) * b["rate"]
    else:
        return None
    return round(cents / 100 + daily, 2)


# ── Turn a finding into the same shape as our data ──────────────────────────
def as_plan(f):
    p = {"type": f.get("type"), "contractMonths": f.get("contractMonths"), "category": f.get("category"),
         "rate": f.get("rate_incl_gst"), "discount": f.get("discount"),
         "dailyCharge": f.get("dailyCharge_incl_gst"), "tou": None, "tiers": None}
    if f.get("tou"):
        t = f["tou"]
        p["tou"] = {"offPeak": {"window": t["offPeak"].get("window"), "rate": t["offPeak"].get("rate_incl_gst")},
                    "peak": {"window": t["peak"].get("window"), "rate": t["peak"].get("rate_incl_gst")}}
    if f.get("tiers"):
        p["tiers"] = [{"from": b.get("from"), "to": b.get("to"), "rate": b.get("rate_incl_gst")} for b in f["tiers"]]
    return p


def num_diff(a, b):
    return a is not None and b is not None and abs(float(a) - float(b)) >= TOL


def price_changes(cur, new):
    """List of (field, old, new) for pricing fields the finding actually states."""
    out = []
    t = cur.get("pricingType")
    if t in ("fixed", "regulated") and new["rate"] is not None and num_diff(cur.get("rate"), new["rate"]):
        out.append(("Rate (¢/kWh)", cur.get("rate"), new["rate"]))
    if t == "dot" and new["discount"]:
        cd, nd = cur.get("discount") or {}, new["discount"]
        if cd.get("kind") != nd.get("kind") or num_diff(cd.get("value"), nd.get("value")):
            fmt = lambda d: f"{d.get('value')}{'%' if d.get('kind') == 'percent' else '¢'} off tariff" if d else "—"
            out.append(("Discount", fmt(cd), fmt(nd)))
    if t == "tou" and new["tou"]:
        for band, label in (("offPeak", "Off-peak (¢/kWh)"), ("peak", "Peak (¢/kWh)")):
            o = ((cur.get("tou") or {}).get(band) or {}).get("rate")
            n = new["tou"][band]["rate"]
            if n is not None and num_diff(o, n):
                out.append((label, o, n))
    if t == "tiered" and new["tiers"]:
        ct = cur.get("tiers") or []
        for i, b in enumerate(new["tiers"]):
            o = ct[i]["rate"] if i < len(ct) else None
            if b["rate"] is not None and num_diff(o, b["rate"]):
                rng = f"{b['from']}–{b['to'] if b['to'] is not None else '∞'} kWh"
                out.append((f"Tier {rng} (¢/kWh)", o, b["rate"]))
    if new["dailyCharge"] is not None and num_diff(cur.get("dailyCharge") or 0, new["dailyCharge"]):
        out.append(("Daily charge (S$/day)", cur.get("dailyCharge"), new["dailyCharge"]))
    if new["contractMonths"] is not None and (cur.get("contractMonths") or 0) != (new["contractMonths"] or 0):
        out.append(("Contract (months)", cur.get("contractMonths") or 0, new["contractMonths"]))
    return out


def has_price(new):
    """Did the retailer page actually give us a price for this plan?"""
    if new["rate"] is not None or new["discount"]:
        return True
    if new["tou"] and new["tou"]["offPeak"]["rate"] is not None and new["tou"]["peak"]["rate"] is not None:
        return True
    if new["tiers"] and all(b["rate"] is not None for b in new["tiers"]):
        return True
    return False


# ── Accuracy guards ──────────────────────────────────────────────────────────
# An agent reading web pages can misread or invent a number. These checks don't
# trust the agent: they look for internal contradictions, implausible values and
# disagreement between two independent reads, and block approval when they find one.
RATE_MIN, RATE_MAX = 15.0, 45.0     # ¢/kWh incl. GST; anything outside is almost surely a misread
MAX_JUMP = 0.15                     # >15% move in one week gets flagged
GST = 1.09
STALE_DAYS = 21                     # a plan unverified for 3+ weeks should be checked by hand or hidden


def price_numbers(new):
    """Every number the finding claims, for quote and cross-checks."""
    out = []
    if new["rate"] is not None:
        out.append(("rate", new["rate"]))
    if new["discount"]:
        out.append(("discount", new["discount"]["value"]))
    if new["tou"]:
        for b in ("offPeak", "peak"):
            if new["tou"][b]["rate"] is not None:
                out.append((b, new["tou"][b]["rate"]))
    for i, b in enumerate(new["tiers"] or []):
        if b["rate"] is not None:
            out.append((f"tier{i + 1}", b["rate"]))
    return out


def in_quote(value, quote):
    """Does the number appear in the copied source text? Accepts 29 / 29.0 / 29.00 / $0.2900."""
    q = quote.replace(",", "")
    v = float(value)
    forms = {f"{v:.2f}", f"{v:.1f}", f"{v:g}", f"0.{int(round(v * 100)):04d}"}
    return any(re.search(rf"(?<![\d.]){re.escape(f)}(?!\d)", q) for f in forms)


def sanity(pl, new, cur):
    """Implausible values and internal contradictions in one finding."""
    flags = []
    for name, v in price_numbers(new):
        if name != "discount" and not (RATE_MIN <= v <= RATE_MAX):
            flags.append(f"{name} {v}¢ is outside {RATE_MIN:g}–{RATE_MAX:g}¢")
    d = new["discount"]
    if d and ((d["kind"] == "percent" and d["value"] > 25) or (d["kind"] == "cents" and d["value"] > 8)):
        flags.append(f"discount {d['value']}{'%' if d['kind'] == 'percent' else '¢'} is unusually large")
    inc, exc = pl.get("rate_incl_gst"), pl.get("rate_excl_gst")
    if inc is not None and exc is not None and abs(exc * GST - inc) > 0.015:
        flags.append(f"GST mismatch: {exc}¢ × 1.09 = {exc * GST:.2f}¢, not {inc}¢")
    o = cur.get("rate")
    if new["rate"] is not None and o and abs(new["rate"] - o) / o > MAX_JUMP:
        flags.append(f"rate moved {abs(new['rate'] - o) / o:.0%} in one check")
    quote = pl.get("evidence")
    if quote:
        missing = [f"{n} {v}" for n, v in price_numbers(new) if not in_quote(v, quote)]
        if missing:
            flags.append("not in the copied source text: " + ", ".join(missing))
    return flags


def cross_check(new, ver):
    """Compare two independent reads of the same plan. Returns list of disagreements."""
    if ver is None:
        return None
    a, b = dict(price_numbers(new)), dict(price_numbers(as_plan(ver)))
    if not b:
        return None
    return [f"{k}: {a.get(k)} vs {b.get(k)}" for k in set(a) | set(b)
            if a.get(k) is None or b.get(k) is None or num_diff(a[k], b[k])]


def last_verified(run_dir):
    """id -> date of the latest earlier run that confirmed a price for it."""
    seen = {}
    for prev in sorted(run_dir.parent.glob("*/changes.json")):
        if prev.parent.name >= run_dir.name:
            continue
        try:
            for r in json.loads(prev.read_text(encoding="utf-8")).get("plans", []):
                if r.get("id") and r.get("kind") in ("changed", "same") and not (r.get("trust") or {}).get("blocked"):
                    seen[r["id"]] = prev.parent.name
        except (OSError, ValueError):
            pass
    return seen


def days_between(a, b):
    try:
        return (date.fromisoformat(b) - date.fromisoformat(a)).days
    except (TypeError, ValueError):
        return None


def promo_key(pr):
    if not pr:
        return None
    return (str(pr.get("code") or "").replace(" ", "").upper(), str(pr.get("value") or "").strip(), pr.get("expires"))


# ── Compare ──────────────────────────────────────────────────────────────────
def compare(run_dir):
    meta, current = load_current()
    findings = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((run_dir / "raw").glob("*.json"))]
    # Optional second, independent read (different agent / method) of the high-impact items.
    verify = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((run_dir / "verify").glob("*.json"))]
    ver_plan = {pl["matches_id"]: pl for v in verify for pl in v.get("plans", []) if pl.get("matches_id")}
    ver_gone = {pid for v in verify for pid in v.get("not_found", [])}
    ver_seen = {pid for v in verify for pid in [pl.get("matches_id") for pl in v.get("plans", [])]}
    prior = last_verified(run_dir)

    sp = next((f for f in findings if f["retailer"] == "SP Group"), None)
    tariff_now = meta["regulatedTariff"]
    tariff_new = next((pl["rate_incl_gst"] for pl in (sp or {}).get("plans", []) if pl.get("rate_incl_gst")), tariff_now)

    rows, promo_rows, retailers = [], [], []
    seen = set()
    for f in findings:
        r = f["retailer"]
        ours = [p for p in current.values() if p["retailer"] == r and p.get("available")]
        stat = {"retailer": r, "checked": 0, "changed": 0, "unverified": 0, "removed": 0, "new": 0,
                "issues": f.get("issues", ""), "sources": f.get("sources", []), "gst": f.get("gst_basis_on_site")}
        for pl in f.get("plans", []):
            new = as_plan(pl)
            pid = pl.get("matches_id")
            if not pid or pid not in current:
                stat["new"] += 1
                rows.append({"kind": "new", "retailer": r, "plan": pl["name"], "id": None, "changes": [],
                             "confidence": pl.get("confidence"), "source": pl.get("source_url"), "notes": pl.get("notes", ""),
                             "old_bill": None, "new_bill": monthly(new, tariff_new)})
                continue
            seen.add(pid)
            cur = current[pid]
            stat["checked"] += 1
            if not has_price(new) or pl.get("confidence") == "low":
                stat["unverified"] += 1
                rows.append({"kind": "unverified", "retailer": r, "plan": cur["name"], "id": pid, "changes": [],
                             "confidence": pl.get("confidence"), "source": pl.get("source_url"), "notes": pl.get("notes", ""),
                             "old_bill": monthly(cur, tariff_now), "new_bill": None})
            else:
                ch = price_changes(cur, new)
                merged = {**cur, **{k: v for k, v in new.items() if v is not None}}
                merged["pricingType"] = cur["pricingType"]
                if new["tou"] and cur.get("tou", {}).get("weekendOffPeak"):
                    merged["tou"]["weekendOffPeak"] = True
                kind = "changed" if ch else "same"
                if ch:
                    stat["changed"] += 1
                flags = sanity(pl, new, cur)
                xc = cross_check(new, ver_plan.get(pid))
                trust = {"flags": flags, "second_read": "agrees" if xc == [] else ("disagrees" if xc else "none"),
                         "disagreements": xc or [], "quote": bool(pl.get("evidence")),
                         "verified_by": (ver_plan.get(pid) or {}).get("method")}
                trust["blocked"] = bool(flags) or bool(xc)
                rows.append({"kind": kind, "retailer": r, "plan": cur["name"], "id": pid, "changes": ch,
                             "confidence": pl.get("confidence"), "source": pl.get("source_url"), "notes": pl.get("notes", ""),
                             "old_bill": monthly(cur, tariff_now), "new_bill": monthly(merged, tariff_new), "trust": trust,
                             "proposed": {k: merged.get(k) for k in ("rate", "discount", "dailyCharge", "tou", "tiers", "contractMonths")}})
            # promotions
            old_p = cur.get("promo")
            if promo_key(old_p) != promo_key(pl.get("promo")):
                promo_rows.append({"retailer": r, "plan": cur["name"], "id": pid, "old": old_p, "new": pl.get("promo"),
                                   "source": pl.get("source_url")})
        for pid in f.get("not_found", []):
            if pid in current:
                seen.add(pid)
                stat["removed"] += 1
                second = "agrees" if pid in ver_gone else ("disagrees" if pid in ver_seen else "none")
                rows.append({"kind": "removed", "retailer": r, "plan": current[pid]["name"], "id": pid, "changes": [],
                             "confidence": "high", "source": None, "notes": "Not offered on the retailer's site any more.",
                             "old_bill": monthly(current[pid], tariff_now), "new_bill": None,
                             "trust": {"flags": [], "second_read": second, "disagreements": [] if second != "disagrees"
                                       else ["second read still found this plan"], "quote": False,
                                       "blocked": second == "disagrees"}})
        for p in ours:
            if p["id"] not in seen and r != "SP Group":
                stat["unverified"] += 1
                rows.append({"kind": "unverified", "retailer": r, "plan": p["name"], "id": p["id"], "changes": [],
                             "confidence": None, "source": None, "notes": "Could not be checked this run.",
                             "old_bill": monthly(p, tariff_now), "new_bill": None})
        retailers.append(stat)

    # Ranking impact at typical usage: what the calculator would recommend before vs after.
    def ranked(use_new, respect_blocks=True):
        cands = []
        for p in current.values():
            if not p.get("available") or p["pricingType"] == "regulated" or p.get("referralOnly"):
                continue
            row = next((x for x in rows if x["id"] == p["id"]), None)
            ok = row and not (respect_blocks and (row.get("trust") or {}).get("blocked"))
            if use_new and ok and row["kind"] == "removed":
                continue
            bill = row["new_bill"] if (use_new and ok and row["kind"] == "changed") else monthly(p, tariff_new if use_new else tariff_now)
            if bill is not None and (p.get("contractMonths") or 0) <= 24:
                cands.append((bill, p["contractMonths"] or 0, p["retailer"], p["name"], p["id"]))
        return sorted(cands)

    def best(use_new):
        r = ranked(use_new)
        return r[0][:4] if r else None

    # High-impact items (would move the top 3, or change a typical bill by S$5+/month) need a
    # second independent read before they can be approved.
    top = {c[4] for c in ranked(False)[:3]} | {c[4] for c in ranked(True, respect_blocks=False)[:3]}
    for x in rows:
        t = x.get("trust")
        if not t or x["kind"] not in ("changed", "removed"):
            continue
        big = x["id"] in top or (x["old_bill"] is not None and x["new_bill"] is not None and abs(x["new_bill"] - x["old_bill"]) >= 5)
        x["high_impact"] = big
        if big and t["second_read"] == "none":
            t["flags"].append("high impact: needs a second, independent read before approval")
            t["blocked"] = True

    # Gaps: how long has each unverified plan gone without a confirmed price?
    for x in rows:
        if x["kind"] == "unverified":
            lv = prior.get(x["id"]) or meta.get("ratesAsAt")
            x["last_verified"], x["age_days"] = lv, days_between(lv, run_dir.name)
            x["stale"] = (x["age_days"] or 0) >= STALE_DAYS
    total = sum(1 for p in current.values() if p.get("available") and p["pricingType"] != "regulated")
    confirmed = sum(1 for x in rows if x["kind"] in ("changed", "same", "removed") and not x["trust"]["blocked"]
                    and current.get(x["id"], {}).get("pricingType") != "regulated")

    sp_bill_now = round(TYPICAL_KWH * tariff_now / 100, 2)
    sp_bill_new = round(TYPICAL_KWH * tariff_new / 100, 2)
    summary = {
        "run_date": run_dir.name, "data_rates_as_at": meta.get("ratesAsAt"),
        "tariff_now": tariff_now, "tariff_new": tariff_new,
        "best_now": best(False), "best_new": best(True),
        "saving_now": round((sp_bill_now - best(False)[0]) * 12) if best(False) else None,
        "saving_new": round((sp_bill_new - best(True)[0]) * 12) if best(True) else None,
        "counts": {k: sum(1 for x in rows if x["kind"] == k) for k in ("changed", "same", "unverified", "removed", "new")},
        "promo_changes": len(promo_rows),
        "coverage": {"confirmed": confirmed, "total": total, "pct": round(100 * confirmed / total) if total else 0},
        "blocked": sum(1 for x in rows if (x.get("trust") or {}).get("blocked")),
        "double_checked": sum(1 for x in rows if (x.get("trust") or {}).get("second_read") == "agrees"),
        "stale": [x["plan"] for x in rows if x.get("stale")],
    }
    return summary, rows, promo_rows, retailers


# ── Report ───────────────────────────────────────────────────────────────────
def esc(s):
    return html.escape("" if s is None else str(s))


def fmt(v):
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:.2f}".rstrip("0").rstrip(".") if v != int(v) else f"{v:.2f}"
    return esc(v)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to cp1252
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    run_dir = (ROOT / sys.argv[1]).resolve() if not Path(sys.argv[1]).is_absolute() else Path(sys.argv[1])
    from report import render  # the HTML report lives in report.py
    from runlog import from_summary, record
    summary, rows, promo_rows, retailers = compare(run_dir)
    (run_dir / "report.html").write_text(render(summary, rows, promo_rows, retailers), encoding="utf-8")
    (run_dir / "changes.json").write_text(json.dumps({"summary": summary, "plans": rows, "promotions": promo_rows},
                                                     ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    record(run_dir.parent, run_dir.name, **from_summary(summary))
    c = summary["counts"]
    print(f"{run_dir.name}: {c['changed']} changed, {c['removed']} withdrawn, {c['new']} new, "
          f"{c['unverified']} unverified, {c['same']} unchanged, {summary['promo_changes']} promo updates")
    if summary["best_now"] and summary["best_new"]:
        print(f"  recommended at {TYPICAL_KWH} kWh: {summary['best_now'][2]} {summary['best_now'][3]} "
              f"(~S${summary['saving_now']}/yr) -> {summary['best_new'][2]} {summary['best_new'][3]} (~S${summary['saving_new']}/yr)")


if __name__ == "__main__":
    main()
