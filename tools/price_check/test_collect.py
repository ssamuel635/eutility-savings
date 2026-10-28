"""Checks that the script collector reads each source's wording right, and passes the accuracy guards.
Run: python3 tools/price_check/test_collect.py   (no network: the samples below are copied from the sources, 28 Oct 2026)"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from collect import against, clock, fs_date, parse_keppel, parse_senoko_factsheet, parse_sp, senoko_codes
from compare import as_plan, sanity

fails = 0


def check(name, ok):
    global fails
    print(("PASS " if ok else "FAIL ") + name)
    fails += not ok


current = {
    "keppel-electric-fixed24": {"retailer": "Keppel Electric", "name": "FIXED24", "available": True, "pricingType": "fixed", "rate": 30.9},
    "keppel-electric-weekend-saver": {"retailer": "Keppel Electric", "name": "WEEKEND SAVER", "available": True, "pricingType": "tou"},
    "keppel-electric-gone": {"retailer": "Keppel Electric", "name": "FIXED6", "available": True, "pricingType": "fixed", "rate": 31.0},
    "senoko-energy-lifepower36": {"retailer": "Senoko Energy", "name": "LifePower36", "available": True},
    "sp-group-regulated-tariff": {"retailer": "SP Group", "name": "Regulated Tariff", "available": True},
}

# ── Keppel's plan feed ──
feed = {"result": {"data": [
    {"planName": "FIXED24", "planCategory": "Limited Time Offer", "contractDuration": "24 Months",
     "factSheetName": "Fact Sheet_FIXED24 v42_2026 1019_ NonStandard.pdf",
     "rateWithGSTDesc": "Fixed Rate 30.90¢/kWh (w/GST)", "rateWithoutGSTDesc": "Fixed Rate 28.35¢/kWh (w/o GST)"},
    {"planName": "ecoGreen24", "planCategory": "Greener Together", "contractDuration": "24 Months",
     "rateWithGSTDesc": "Fixed Rate 38.80¢/kWh (w/GST)", "rateWithoutGSTDesc": "Fixed Rate 35.60¢/kWh (w/o GST)"},
    {"planName": "WEEKEND SAVER", "contractDuration": "24 Months", "rateWithGSTDesc": "Rate as low as 39.89¢/kWh (w/GST)",
     "benefits": "ACTIVE, 24 Months, Weekend all day (off-peak): 27.90¢/kWh (w/GST), Weekdays 9am – 9pm (peak): 39.90¢/kWh (w/GST), "
                 "Weekdays 9pm – 9am (off-peak): 27.90¢/kWh (w/GST)"},
]}}
k = parse_keppel(feed, current)
p = {x["name"]: x for x in k["plans"]}
check("keppel: fixed rate with and without GST, matched to our plan",
      p["FIXED24"]["rate_incl_gst"] == 30.9 and p["FIXED24"]["rate_excl_gst"] == 28.35 and p["FIXED24"]["matches_id"] == "keppel-electric-fixed24")
check("keppel: fact sheet date from the file name", p["FIXED24"]["terms"]["factsheet_date"] == "2026-10-19")
check("keppel: a plan we don't have comes back unmatched, Green", p["ecoGreen24"]["matches_id"] is None and p["ecoGreen24"]["category"] == "Green")
ws = p["WEEKEND SAVER"]["tou"]
check("keppel: weekend saver uses the customer-facing rates (39.90 peak, 27.90 off-peak)",
      ws["peak"]["rate_incl_gst"] == 39.9 and ws["offPeak"]["rate_incl_gst"] == 27.9 and ws["peak"]["window"].startswith("09:00–21:00"))
check("keppel: our plan missing from the feed is listed as not found", k["not_found"] == ["keppel-electric-gone"])
check("keppel: no promo field, so compare.py leaves promotions alone", all("promo" not in x for x in k["plans"]))

# ── Senoko's fact sheets ──
head = "Fact Sheet Version Date: 22 Oct 26 B. ELECTRICITY PRICE PLAN INFORMATION Name of Price Plan: LifePower36 Type of Price Plan " \
       "Plan ID: HH-GMOFIXPG-36av1 Contract Duration: 36 Months Automatic renewal "
fixed = parse_senoko_factsheet(head + "Fixed Price Plan: 29.95¢/kWh within the contractual period (27.48¢/kWh before GST) "
                               "Discount Off the Regulated Tariff Plan: _____________ % or _____ cents/kWh discount", "HH-GMOFIXPG-36av1",
                               {"lifepower36": "senoko-energy-lifepower36"})
check("senoko: fixed plan, both GST figures, plan and fact sheet date",
      (fixed["type"], fixed["rate_incl_gst"], fixed["rate_excl_gst"], fixed["matches_id"], fixed["contractMonths"], fixed["terms"]["factsheet_date"])
      == ("fixed", 29.95, 27.48, "senoko-energy-lifepower36", 36, "2026-10-22"))
dot = parse_senoko_factsheet(head.replace("LifePower36", "LifeSteady24") + "Fixed Price Plan: ______________¢/kWh within the contractual period "
                             "Discount Off the Regulated Tariff Plan: 1.64¢/kWh within the contractual period (1.50¢/kWh before GST)", "x", {})
check("senoko: discount-off-tariff plan in cents (the blank fixed line is ignored)",
      dot["type"] == "dot" and dot["discount"] == {"value": 1.64, "kind": "cents"})
tou = parse_senoko_factsheet(head + "Peak Period (7am to 11pm): 37.95¢/kWh within the contractual period (34.82¢/kWh before GST) "
                             "Off-Peak Period (11pm to 7am): 21.05¢/kWh within the contractual period (19.31¢/kWh before GST)", "x", {})
check("senoko: peak and off-peak rates and windows",
      tou["tou"] == {"peak": {"window": "07:00–23:00", "rate_incl_gst": 37.95}, "offPeak": {"window": "23:00–07:00", "rate_incl_gst": 21.05}})
odd = parse_senoko_factsheet(head + "Price: see the table overleaf", "x", {})
check("senoko: unrecognised wording is marked low confidence with no price (never guessed)",
      odd["confidence"] == "low" and odd["rate_incl_gst"] is None)
check("senoko: fact sheet links in page order, no repeats",
      senoko_codes('<a href="/custom/document/FS?plancode=A-36av1">x</a><a href="?plancode=B-24av1"></a><a href="?plancode=A-36av1">') == ["A-36av1", "B-24av1"])

# ── SP Group's tariff page ──
sp = parse_sp("<p>stations.</p><td>31.16 cents/kWh</td><td>28.59 cents/kWh (w/o GST)</td><th>ELECTRICITY TARIFF (wef 1 Oct - 31 Dec 26)</th>", current)
check("sp: tariff with and without GST", sp["plans"][0]["rate_incl_gst"] == 31.16 and sp["plans"][0]["rate_excl_gst"] == 28.59)
check("sp: a changed page layout gives a low-confidence read, not a guess",
      parse_sp("<p>Tariff coming soon</p>", current)["plans"][0]["confidence"] == "low")

# ── The script's reads pass the same accuracy guards as the agent's ──
for f in [p["FIXED24"], fixed]:
    flags = sanity(f, as_plan(f), {"pricingType": f["type"], "rate": f["rate_incl_gst"]})
    check(f"guards: {f['name']} passes (number in its quote, GST pair consistent)", not flags)
bad = dict(fixed, rate_incl_gst=29.59)
check("guards: a number not in the copied text is still caught", bool(sanity(bad, as_plan(bad), {"pricingType": "fixed", "rate": 29.95})))

# ── Side-by-side with the agent's read ──
agent = {"plans": [dict(p["FIXED24"], rate_incl_gst=31.4, rate_excl_gst=28.81), p["WEEKEND SAVER"]]}
d = against(k, agent)
check("side-by-side: a different rate is reported, matching plans aren't",
      len(d) == 1 and d[0].startswith("keppel-electric-fixed24:") and "31.4" in d[0])
check("side-by-side: two identical reads agree", against(k, k) == [])

# ── Helpers ──
check("clock: 7am, 11pm, 12am, 9:30pm", [clock(x) for x in ("7am", "11pm", "12am", "9:30pm")] == ["07:00", "23:00", "00:00", "21:30"])
check("fact sheet dates: '22 Oct 26' and '16 June 2026'", (fs_date("22 Oct 26"), fs_date("16 June 2026")) == ("2026-10-22", "2026-06-16"))

sys.exit(1 if fails else 0)
