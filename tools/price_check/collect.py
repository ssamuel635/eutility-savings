#!/usr/bin/env python3
"""
Weekly price check, step 1 for the retailers a plain script can read (no browser, no AI):

  keppel     Keppel Electric's plan feed (/api/AccountPlan/GetAllPlans), the list its own page loads
  senoko     Senoko Energy's EMA fact sheets, found from its price plans page
  sp-group   SP Group's tariff page
  tuas       Tuas Power's EMA fact sheets (PDFs), found from its plans page
  pacificlight  PacificLight's EMA fact sheets (web pages), found from its fact sheet index

It writes price-checks/<date>/raw/<key>.json in the format PROCEDURE.md describes, so
compare.py, the report, approvals and publishing work unchanged. Every number comes with
the exact source text in `evidence`, and compare.py rejects any number not in it.

Prices only. Promotions and contract wording are left out of the files (compare.py then
leaves them as they are); each plan still carries its fact sheet date, so a newer fact
sheet shows in the report for a person to check. The other retailers (Geneco, Sembcorp)
stay with the weekly Claude check or a person.

Each site's robots.txt is respected, and each page is read once.

Usage:
  python tools/price_check/collect.py                        # today (Singapore time), every retailer above
  python tools/price_check/collect.py --only keppel,sp-group
  python tools/price_check/collect.py --folder price-checks-script   # a side copy (not the real run folder)
  python tools/price_check/collect.py --force                # replace files already in raw/
"""
import argparse
import html
import io
import json
import re
import sys
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import ROOT, load_current  # noqa: E402

SGT = timezone(timedelta(hours=8))
UA = "Mozilla/5.0 (compatible; EutilityPriceCheck/1.0; +https://eutility.com.sg)"
KEPPEL_FEED = "https://www.keppelelectric.com/api/AccountPlan/GetAllPlans"
KEPPEL_PAGE = "https://www.keppelelectric.com/residential-price-plan"
SENOKO_PAGE = "https://www.senokoenergy.com/households/price-plans"
SENOKO_FS = "https://www.senokoenergy.com/custom/document/FS?plancode={}"
SP_PAGE = "https://www.spgroup.com.sg/our-services/utilities/tariff-information"
TUAS_PAGE = "https://savewithtuas.com/our-electricity-plans/"
PL_INDEX = "https://www.pacificlight.com.sg/support/factsheet"
PL_FS = "https://www.pacificlight.com.sg/support/factsheet-detail/{}"
MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


# ── Reading ──────────────────────────────────────────────────────────────────
def allowed(url):
    """robots.txt says we may read this. A missing robots.txt allows everything."""
    p = urlsplit(url)
    rp = urllib.robotparser.RobotFileParser()
    try:
        req = urllib.request.Request(f"{p.scheme}://{p.netloc}/robots.txt", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code in (404, 410)  # no robots.txt: allowed; 401/403: treat as a no
    if "<html" in body[:500].lower():  # some sites answer robots.txt with their 404 page
        return True
    rp.parse(body.splitlines())
    return rp.can_fetch(UA, url)


def fetch(url, binary=False):
    if not allowed(url):
        raise PermissionError(f"robots.txt doesn't allow reading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def pdf_text(data):
    from pypdf import PdfReader  # pip install pypdf
    return re.sub(r"\s+", " ", " ".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages))


def page_text(raw_html):
    t = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", raw_html)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))


# ── Small helpers ────────────────────────────────────────────────────────────
def num(s):
    return round(float(s), 3) if s not in (None, "") else None  # PacificLight quotes 26.605¢ before GST


def clock(s):
    """'7am' -> '07:00', '11pm' -> '23:00', '9pm' -> '21:00'."""
    m = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", s.strip().lower())
    if not m:
        return s.strip()
    h = int(m.group(1)) % 12 + (12 if m.group(3) == "pm" else 0)
    return f"{h:02d}:{m.group(2) or '00'}"


def fs_date(s):
    """'22 Oct 26' / '20 August 2026' / '06/Oct/2026' -> '2026-10-22' etc.; None if it doesn't look like a date."""
    m = re.search(r"(\d{1,2})[\s/-]+([A-Za-z]{3})[a-z]*[\s/-]+(\d{2,4})", s or "")
    if not m or m.group(2).lower() not in MONTHS:
        return None
    y = int(m.group(3))
    return f"{y + 2000 if y < 100 else y}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"


def plan(name, ours, **kw):
    """One plan in PROCEDURE.md's format (no promo or contract wording: see the module notes)."""
    base = {"name": name, "matches_id": ours, "type": None, "contractMonths": None, "rate_incl_gst": None,
            "rate_excl_gst": None, "discount": None, "dailyCharge_incl_gst": None, "tou": None, "tiers": None,
            "category": "Standard", "source_url": None, "evidence": "", "confidence": "high", "notes": "Read by script."}
    base.update(kw)
    return base


def our_ids(current, retailer):
    """{lower-case plan name: our id} for the retailer's plans on sale."""
    return {p["name"].lower(): pid for pid, p in current.items() if p["retailer"] == retailer and p.get("available")}


def category(current, pid, name):
    """Green or Standard: our sheet's choice for a plan we have, else a guess from the name."""
    if pid in current and current[pid].get("category"):
        return current[pid]["category"]
    return "Green" if re.search(r"green|G\+", name, re.I) else "Standard"


def finding(retailer, sources, plans, ours, issues=""):
    """The retailer's file. Our plans missing from a complete source list go in not_found."""
    seen = {p["matches_id"] for p in plans}
    return {"retailer": retailer, "checked_at": datetime.now(SGT).date().isoformat(), "gst_basis_on_site": "both",
            "method": "script (tools/price_check/collect.py)", "sources": sources, "plans": plans,
            "not_found": sorted(pid for pid in ours.values() if pid not in seen), "issues": issues}


# ── Keppel Electric: its plan feed ───────────────────────────────────────────
def parse_keppel(feed, current):
    ours = our_ids(current, "Keppel Electric")
    plans = []
    for p in feed["result"]["data"]:
        name = p["planName"].strip()
        months = int(re.search(r"\d+", p.get("contractDuration") or "0").group())
        fs = re.search(r"(\d{4})\s?(\d{2})(\d{2})", p.get("factSheetName") or "")
        common = dict(contractMonths=months, source_url=KEPPEL_FEED,
                      category="Green" if "green" in (name + (p.get("planCategory") or "")).lower() else "Standard",
                      terms={"factsheet_date": f"{fs.group(1)}-{fs.group(2)}-{fs.group(3)}" if fs else None, "changed": False})
        benefits = p.get("benefits") or ""
        if "weekend" in name.lower():
            # The card text customers see: "Weekend all day (off-peak): 27.90¢/kWh (w/GST), Weekdays 9am – 9pm (peak): 39.90¢/kWh (w/GST), …"
            peak = re.search(r"Weekdays (\S+)\s*[–-]\s*(\S+) \(peak\): ([\d.]+)¢/kWh \(w/GST\)", benefits)
            off = re.search(r"Weekend all day \(off-peak\): ([\d.]+)¢/kWh \(w/GST\)", benefits)
            if not (peak and off):
                plans.append(plan(name, ours.get(name.lower()), type="tou", confidence="low", **common,
                                  notes="Couldn't find the peak and off-peak rates in the plan text."))
                continue
            plans.append(plan(name, ours.get(name.lower()), type="tou", **common, evidence=benefits,
                              tou={"offPeak": {"window": "Nights + Weekends", "rate_incl_gst": num(off.group(1))},
                                   "peak": {"window": f"{clock(peak.group(1))}–{clock(peak.group(2))} (weekdays only)",
                                            "rate_incl_gst": num(peak.group(3))}}))
            continue
        incl, excl = p.get("rateWithGSTDesc") or "", p.get("rateWithoutGSTDesc") or ""
        a, b = re.search(r"([\d.]+)¢/kWh", incl), re.search(r"([\d.]+)¢/kWh", excl)
        plans.append(plan(name, ours.get(name.lower()), type="fixed", **common,
                          rate_incl_gst=num(a.group(1)) if a else None, rate_excl_gst=num(b.group(1)) if b else None,
                          evidence=f"{name} {p.get('contractDuration')} {incl} {excl}",
                          confidence="high" if a and b else "low"))
    sources = [{"url": KEPPEL_FEED, "what": "Keppel's plan feed, the list its residential price plan page loads"}]
    return finding("Keppel Electric", sources, plans, ours)


# ── Senoko Energy: EMA fact sheets ───────────────────────────────────────────
def senoko_codes(page):
    """Fact sheet plan codes linked from the price plans page, in page order, no repeats."""
    return list(dict.fromkeys(re.findall(r"plancode=([A-Za-z0-9-]+)", page)))


def parse_senoko_factsheet(text, code, ours):
    url = SENOKO_FS.format(code)
    name = re.search(r"Name of Price Plan:\s*(\S+)", text)
    months = re.search(r"Contract Duration:\s*(\d+)\s*Months", text, re.I)
    if not name or not months:
        return plan(code, None, confidence="low", source_url=url, notes="Couldn't read the plan name or contract length.")
    name = name.group(1)
    common = dict(contractMonths=int(months.group(1)), source_url=url,
                  category="Green" if "green" in name.lower() else "Standard",
                  terms={"factsheet_date": fs_date((re.search(r"Version Date:\s*([\w ]{6,12})", text) or [None, ""])[1]),
                         "changed": False})
    fixed = re.search(r"Fixed Price Plan\s*:\s*([\d.]+)¢/kWh within the contractual period \(([\d.]+)¢/kWh before GST\)", text)
    dot = re.search(r"Discount Off the Regulated Tariff Plan\s*:\s*([\d.]+)\s*(%|¢/kWh) within the contractual period "
                    r"\(([\d.]+)\s*(?:%|¢/kWh) before GST\)", text)
    tou = re.search(r"Peak Period \((\S+) to (\S+)\): ([\d.]+)¢/kWh within the contractual period \(([\d.]+)¢/kWh before GST\) "
                    r"Off-Peak Period \((\S+) to (\S+)\): ([\d.]+)¢/kWh within the contractual period \(([\d.]+)¢/kWh before GST\)", text)
    pid = ours.get(name.lower())
    if fixed:
        return plan(name, pid, type="fixed", **common, rate_incl_gst=num(fixed.group(1)),
                    rate_excl_gst=num(fixed.group(2)), evidence=fixed.group(0))
    if dot:
        kind = "percent" if dot.group(2) == "%" else "cents"
        return plan(name, pid, type="dot", **common, discount={"value": num(dot.group(1)), "kind": kind},
                    evidence=dot.group(0), notes=f"Read by script. Before GST: {dot.group(3)}.")
    if tou:
        g = tou.groups()
        return plan(name, pid, type="tou", **common, evidence=tou.group(0),
                    tou={"peak": {"window": f"{clock(g[0])}–{clock(g[1])}", "rate_incl_gst": num(g[2])},
                         "offPeak": {"window": f"{clock(g[4])}–{clock(g[5])}", "rate_incl_gst": num(g[6])}})
    return plan(name, pid, confidence="low", **common, notes="The fact sheet's price wording wasn't recognised.")


def collect_senoko(current):
    ours = our_ids(current, "Senoko Energy")
    codes = senoko_codes(fetch(SENOKO_PAGE))
    if not codes:
        raise ValueError("no fact sheet links found on the price plans page")
    plans = [parse_senoko_factsheet(pdf_text(fetch(SENOKO_FS.format(c), binary=True)), c, ours) for c in codes]
    sources = [{"url": SENOKO_PAGE, "what": "Price plans page (which fact sheets are current)"}] + \
              [{"url": SENOKO_FS.format(c), "what": f"EMA fact sheet {c}"} for c in codes]
    return finding("Senoko Energy", sources, plans, ours)


# ── Tuas Power: EMA fact sheets (PDFs) ───────────────────────────────────────
def tuas_factsheets(page):
    """Fact sheet PDF links on the plans page, in page order, no repeats (T&C PDFs left out)."""
    links = re.findall(r'href="([^"]+\.pdf)"', page, re.I)
    return list(dict.fromkeys(urljoin(TUAS_PAGE, u) for u in links if "tnc" not in u.lower()))


def parse_tuas_factsheet(text, url, current):
    ours = our_ids(current, "Tuas Power")
    name = re.search(r"Name of Price Plan:\s*(.+?)\s+Type of Price Plan", text)
    months = re.search(r"Contract Duration:\s*(\d+)\s*months", text, re.I)
    if not name or not months:
        return plan(url.rsplit("/", 1)[-1], None, confidence="low", source_url=url,
                    notes="Couldn't read the plan name or contract length.")
    name = name.group(1)
    short = re.sub(r"\s+Bill Rebate$", "", name, flags=re.I)  # "PowerFIX 24 Bill Rebate" is our "PowerFIX 24"
    pid = ours.get(name.lower()) or ours.get(short.lower())
    common = dict(contractMonths=int(months.group(1)), source_url=url, category=category(current, pid, name),
                  terms={"factsheet_date": fs_date((re.search(r"Version Date:\s*(\S+)", text) or [None, ""])[1]),
                         "changed": False})
    fixed = re.search(r"Fixed rate plan: Duration Rates \(before GST\) Rates \(after GST\) \d+ month/s "
                      r"([\d.]+) cents/kWh ([\d.]+) cents/kWh", text)
    if fixed:
        return plan(short, pid, type="fixed", **common, rate_incl_gst=num(fixed.group(2)),
                    rate_excl_gst=num(fixed.group(1)), evidence=fixed.group(0))
    return plan(short, pid, confidence="low", **common, notes="The fact sheet's price wording wasn't recognised.")


def collect_tuas(current):
    urls = tuas_factsheets(fetch(TUAS_PAGE))
    if not urls:
        raise ValueError("no fact sheet links found on the plans page")
    texts = {u: pdf_text(fetch(u, binary=True)) for u in urls}
    texts = {u: t for u, t in texts.items() if "Fact Sheet Version Date" in t}  # skip any other PDF
    plans = [parse_tuas_factsheet(t, u, current) for u, t in texts.items()]
    sources = [{"url": TUAS_PAGE, "what": "Plans page (which fact sheets are current)"}] + \
              [{"url": u, "what": "EMA fact sheet"} for u in texts]
    return finding("Tuas Power", sources, plans, our_ids(current, "Tuas Power"))


# ── PacificLight: EMA fact sheets (web pages) ────────────────────────────────
def pl_slugs(page):
    """Fact sheet pages linked from the index, in page order, no repeats."""
    return list(dict.fromkeys(re.findall(r"factsheet-detail/([A-Za-z0-9-]+)", page)))


def parse_pl_factsheet(text, url, current):
    ours = our_ids(current, "PacificLight")
    name = re.search(r"Name of Price Plan:\s*(.+?)\s+Type of Price Plan", text)
    months = re.search(r"Contract Duration:\s*(\d+\s*months|Not applicable)", text, re.I)
    # Most sheets say "This is a … Price Plan. The electricity rate to be paid by you is: …"; Easy Peasy goes straight to the price
    rates = re.search(r"Type of Price Plan \(see footnote 1\):\s*(?:Non-)?Standard\s*(?:This is a [\w-]+ Price Plan\.\s*)?"
                      r"(?:The electricity rate to be paid by you is:\s*)?(.+?)\s*The electricity retailer must", text)
    if not name or not months or not rates:
        return plan(url.rsplit("/", 1)[-1], None, confidence="low", source_url=url,
                    notes="Couldn't read the plan name, contract length or price section.")
    name, quote = name.group(1), rates.group(1)
    pid = ours.get(name.lower())
    m = re.match(r"\d+", months.group(1))
    daily = re.search(r"Daily Charge (?:of )?(?:\$([\d.]+)|([\d.]+)¢)/day", quote)
    common = dict(contractMonths=int(m.group()) if m else 0, source_url=url, category=category(current, pid, name),
                  evidence=quote, dailyCharge_incl_gst=num(daily.group(1)) if daily and daily.group(1)
                  else (round(float(daily.group(2)) / 100, 2) if daily else None),
                  terms={"factsheet_date": fs_date((re.search(r"Version Date:\s*(\d{1,2} \w+ \d{4})", text) or [None, ""])[1]),
                         "changed": False})
    dot = re.search(r"([\d.]+)% (?:Discount )?Off (?:SP Regulated )?Tariff", quote, re.I)
    stacks = re.findall(r"Stack \d - (?:First (\d+) kWh|Usage between (\d+) to (\d+) kWh|Above (\d+) kWh) @([\d.]+)¢/kWh", quote)
    bands = re.findall(r"([\d.]+)¢/kWh (?:during (?:off-)?peak periods )?from (\d[^;()]*?[ap]m) to (\d[^;()]*?[ap]m)", quote)
    fixed = re.search(r"Fixed[- ]price plan: ([\d.]+)¢/kWh.*?Rate excl\. 9% GST is ([\d.]+)¢/kWh", quote)
    if dot and quote.lower().startswith("discount"):
        extra = " Plus a prompt payment discount (see the fact sheet)." if "Prompt Payment" in quote else ""
        return plan(name, pid, type="dot", **common, discount={"value": num(dot.group(1)), "kind": "percent"},
                    notes="Read by script." + extra)
    if stacks:
        tiers = []
        for first, lo, hi, above, rate in stacks:
            frm, to = (0, int(first)) if first else (int(lo) - 1, int(hi)) if lo else (int(above), None)
            tiers.append({"from": frm, "to": to, "rate_incl_gst": num(rate)})
        return plan(name, pid, type="tiered", **common, tiers=tiers)
    if len(bands) == 2:
        (r1, *w1), (r2, *w2) = sorted(bands, key=lambda b: float(b[0]), reverse=True)  # dearer band is peak
        return plan(name, pid, type="tou", **common,
                    tou={"peak": {"window": f"{clock(w1[0])}–{clock(w1[1])}", "rate_incl_gst": num(r1)},
                         "offPeak": {"window": f"{clock(w2[0])}–{clock(w2[1])}", "rate_incl_gst": num(r2)}})
    if fixed:
        return plan(name, pid, type="fixed", **common, rate_incl_gst=num(fixed.group(1)), rate_excl_gst=num(fixed.group(2)))
    return plan(name, pid, confidence="low", **common, notes="The fact sheet's price wording wasn't recognised.")


def collect_pacificlight(current):
    slugs = pl_slugs(fetch(PL_INDEX))
    if not slugs:
        raise ValueError("no fact sheet links found on the fact sheet index")
    plans = [parse_pl_factsheet(page_text(fetch(PL_FS.format(s))), PL_FS.format(s), current) for s in slugs]
    sources = [{"url": PL_INDEX, "what": "Fact sheet index (which fact sheets are current)"}] + \
              [{"url": PL_FS.format(s), "what": "EMA fact sheet"} for s in slugs]
    return finding("PacificLight", sources, plans, our_ids(current, "PacificLight"))


# ── SP Group: the regulated tariff ───────────────────────────────────────────
def parse_sp(page, current):
    ours = our_ids(current, "SP Group")
    t = page_text(page)
    m = re.search(r"([\d.]+) cents/kWh ([\d.]+) cents/kWh \(w/o GST\) ELECTRICITY TARIFF \(wef ([^)]+)\)", t)
    if not m:
        p = plan("Regulated Tariff", ours.get("regulated tariff"), type="regulated", contractMonths=0, confidence="low",
                 source_url=SP_PAGE, notes="Couldn't find the electricity tariff on the page.")
    else:
        p = plan("Regulated Tariff", ours.get("regulated tariff"), type="regulated", contractMonths=0, source_url=SP_PAGE,
                 rate_incl_gst=num(m.group(1)), rate_excl_gst=num(m.group(2)), dailyCharge_incl_gst=0,
                 evidence=m.group(0), notes=f"Read by script. Period: {m.group(3)}.")
    return finding("SP Group", [{"url": SP_PAGE, "what": "SP Group tariff information page"}], [p], ours)


# ── Run ──────────────────────────────────────────────────────────────────────
COLLECTORS = {
    "keppel": lambda cur: parse_keppel(json.loads(fetch(KEPPEL_FEED)), cur),
    "senoko": collect_senoko,
    "sp-group": lambda cur: parse_sp(fetch(SP_PAGE), cur),
    "tuas": collect_tuas,
    "pacificlight": collect_pacificlight,
}
RETAILER = {"keppel": "Keppel Electric", "senoko": "Senoko Energy", "sp-group": "SP Group",
            "tuas": "Tuas Power", "pacificlight": "PacificLight"}
PRICE_FIELDS = ("type", "contractMonths", "rate_incl_gst", "rate_excl_gst", "discount", "dailyCharge_incl_gst")


def prices(p):
    """A plan's price fields, peak/off-peak and tier rates included, for comparing two reads."""
    out = {f: p.get(f) for f in PRICE_FIELDS}
    for band in ("peak", "offPeak"):
        out[band] = ((p.get("tou") or {}).get(band) or {}).get("rate_incl_gst")
    out["tiers"] = [b.get("rate_incl_gst") for b in p.get("tiers") or []] or None
    return out


def against(mine, other):
    """Differences between this script's read and another read of the same retailer (e.g. the agent's)."""
    a = {p["matches_id"]: prices(p) for p in mine.get("plans", []) if p.get("matches_id")}
    b = {p["matches_id"]: prices(p) for p in other.get("plans", []) if p.get("matches_id")}
    out = []
    for pid in sorted(set(a) | set(b)):
        if pid not in a or pid not in b:
            out.append(f"{pid}: only in the {'script' if pid in a else 'other'} read")
            continue
        diff = {f: (b[pid][f], a[pid][f]) for f in a[pid] if a[pid][f] != b[pid][f] and b[pid][f] is not None}
        if diff:
            out.append(f"{pid}: " + ", ".join(f"{f} other {o} / script {s}" for f, (o, s) in diff.items()))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=datetime.now(SGT).date().isoformat())
    ap.add_argument("--only", default=",".join(COLLECTORS), help="comma-separated keys: " + ", ".join(COLLECTORS))
    ap.add_argument("--folder", default="price-checks", help="where run folders go (default price-checks)")
    ap.add_argument("--force", action="store_true", help="replace a retailer file that's already there")
    ap.add_argument("--against", help="another run folder (e.g. price-checks/<date>) whose raw files to compare prices with")
    a = ap.parse_args()

    _, current = load_current()
    raw = ROOT / a.folder / a.date / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    failed = 0
    for key in [k.strip() for k in a.only.split(",") if k.strip()]:
        out = raw / f"{key}.json"
        if out.exists() and not a.force:
            print(f"  {key:10} skipped: {out.relative_to(ROOT)} already exists (use --force to replace)")
            continue
        try:
            f = COLLECTORS[key](current)
        except Exception as e:  # one retailer failing never stops the others
            failed += 1
            f = {"retailer": RETAILER[key], "checked_at": a.date, "method": "script (tools/price_check/collect.py)",
                 "sources": [], "plans": [], "not_found": [], "issues": f"Script couldn't read the source: {type(e).__name__}: {e}"}
        out.write_text(json.dumps(f, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        low = sum(1 for p in f["plans"] if p["confidence"] == "low")
        print(f"  {key:10} {len(f['plans'])} plan(s), {low} unreadable, not found: {f['not_found'] or 'none'}"
              + (f"  ISSUE: {f['issues']}" if f["issues"] else ""))
    print(f"Wrote {raw.relative_to(ROOT)}. Next: python tools/price_check/compare.py {raw.parent.relative_to(ROOT)}")
    if a.against:
        # Side-by-side: does the script read the same prices as the other run (the agent's)?
        print(f"\nScript vs {a.against}:")
        for key in [k.strip() for k in a.only.split(",") if k.strip()]:
            theirs = ROOT / a.against / "raw" / f"{key}.json"
            mine = raw / f"{key}.json"
            if not theirs.exists() or not mine.exists():
                print(f"  {key:10} not compared: {'no file in ' + a.against if not theirs.exists() else 'no script file'}")
                continue
            d = against(json.loads(mine.read_text(encoding="utf-8")), json.loads(theirs.read_text(encoding="utf-8")))
            n = len(json.loads(mine.read_text(encoding="utf-8"))["plans"])
            print(f"  {key:10} " + ("agree on all {} plan(s)".format(n) if not d else f"{len(d)} difference(s):"))
            for line in d:
                print(f"             {line}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
