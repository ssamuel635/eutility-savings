"""Checks that the script collector reads each source's wording right, and passes the accuracy guards.
Run: python3 tools/price_check/test_collect.py   (no network: the samples below are copied from the sources, 28 Oct 2026)"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from collect import (against, clock, fs_date, parse_keppel, parse_pl_factsheet, parse_senoko_factsheet, parse_sp,
                     parse_tuas_factsheet, pl_slugs, senoko_codes, tuas_factsheets)
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
    "tuas-power-powerfix-24": {"retailer": "Tuas Power", "name": "PowerFIX 24", "available": True, "category": "Standard"},
    "tuas-power-powerfix-25-g": {"retailer": "Tuas Power", "name": "PowerFIX 25 G+", "available": True, "category": "Green"},
    "pacificlight-savvy-saver-24": {"retailer": "PacificLight", "name": "Savvy Saver 24", "available": True},
    "pacificlight-sunny-side-up-12": {"retailer": "PacificLight", "name": "Sunny Side-Up 12", "available": True, "category": "Green"},
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

# ── Tuas Power's fact sheets (PDF text) ──
tuas_head = "A. General Information Name of Electricity Retailer: Tuas Power Supply Pte Ltd Fact Sheet Version Date: 06/Oct/2026 " \
            "B. Electricity Price Plan Information Name of Price Plan: {} Type of Price Plan (see footnote 1): Standard "
tuas_rate = "Fixed rate plan: Duration Rates (before GST) Rates (after GST) 24 month/s 28.35 cents/kWh 30.90 cents/kWh " \
            "The electricity retailer must clearly state any incentives ... Contract Duration: 24 months Automatic Renewal"
tu = parse_tuas_factsheet(tuas_head.format("PowerFIX 24 Bill Rebate") + tuas_rate, "https://x/fs/powerfix_24.pdf", current)
check("tuas: 'PowerFIX 24 Bill Rebate' is our PowerFIX 24, both GST figures, fact sheet date",
      (tu["name"], tu["matches_id"], tu["rate_incl_gst"], tu["rate_excl_gst"], tu["contractMonths"], tu["terms"]["factsheet_date"])
      == ("PowerFIX 24", "tuas-power-powerfix-24", 30.9, 28.35, 24, "2026-10-06"))
tg = parse_tuas_factsheet(tuas_head.format("PowerFIX 25 G+ Bill Rebate") + tuas_rate.replace("24 months", "25 months"), "x", current)
check("tuas: green plan keeps our sheet's category", (tg["matches_id"], tg["category"]) == ("tuas-power-powerfix-25-g", "Green"))
check("tuas: unrecognised price wording is low confidence, no price",
      parse_tuas_factsheet(tuas_head.format("PowerFIX 12") + "Rates: see table. Contract Duration: 12 months", "x", current)["confidence"] == "low")
check("tuas: fact sheet PDFs from the plans page, T&C PDFs left out",
      tuas_factsheets('<a href="/assets/pdf/2026/fs/powerfix_24.pdf"></a><a href="/assets/pdf/2026/standard_tnc_v190626.pdf"></a>'
                      '<a href="/assets/pdf/2026/fs/powerfix_24.pdf"></a>') == ["https://savewithtuas.com/assets/pdf/2026/fs/powerfix_24.pdf"])


# ── PacificLight's fact sheets (web page text) ──
def pl(name, rate_text, months="24 months"):
    text = f"Fact Sheet Version Date: 8 October 2026 B. Electricity Price Plan Information Name of Price Plan: {name} " \
           f"Type of Price Plan (see footnote 1): Standard This is a Standard Price Plan. The electricity rate to be paid by you is: " \
           f"{rate_text} The electricity retailer must clearly state any incentives ... Contract Duration: {months} Automatic Renewal"
    return parse_pl_factsheet(text, "https://x/" + name, current)


ss = pl("Savvy Saver 24", "Fixed price plan: 29.00¢/kWh (Rate excl. 9% GST is 26.605¢/kWh)")
check("pacificlight: fixed plan, before-GST rate to 3 decimals, fact sheet date",
      (ss["matches_id"], ss["type"], ss["rate_incl_gst"], ss["rate_excl_gst"], ss["dailyCharge_incl_gst"], ss["terms"]["factsheet_date"])
      == ("pacificlight-savvy-saver-24", "fixed", 29.0, 26.605, None, "2026-10-08"))
ep = parse_pl_factsheet("Name of Price Plan: Easy Peasy Type of Price Plan (see footnote 1): Non-Standard Fixed price plan: 27.00¢/kWh "
                        "+ Daily Charge 55¢/day (Rate excl. 9% GST is 24.77¢/kWh + Daily Charge is 50¢/day). The electricity retailer "
                        "must clearly state ... Contract Duration: Not applicable Automatic", "x", current)
check("pacificlight: sheet without the 'rate to be paid' line, no contract, daily charge in cents",
      (ep["type"], ep["rate_incl_gst"], ep["contractMonths"], ep["dailyCharge_incl_gst"]) == ("fixed", 27.0, 0, 0.55))
sw = pl("Save While Sleeping 24", "Peak/off-peak fixed-rate plan: (i) 33.00¢/kWh during peak periods from 7 am to 11 pm (Day) "
        "(ii) 23.00¢/kWh during off-peak periods from 11 pm to 7 am (Night) (Rates excl. 9% GST are 30.275¢/kWh and 21.10¢/kWh).")
check("pacificlight: peak and off-peak rates and windows",
      sw["tou"] == {"peak": {"window": "07:00–23:00", "rate_incl_gst": 33.0}, "offPeak": {"window": "23:00–07:00", "rate_incl_gst": 23.0}})
nn = pl("9 to 9", "Two-tiered fixed-rate plan: (i) 36.95¢/kWh from 9 am to 9 pm; (ii) 20.05¢/kWh from 9 pm to 9 am; and Daily Charge "
        "of $1.01/day applies. (Rates excl. 9% GST are 33.899¢/kWh and 18.394¢/kWh, with a Daily Charge of 92.52¢/day).", "Not applicable")
check("pacificlight: 9am-9pm plan, the dearer band is peak, daily charge in dollars",
      (nn["type"], nn["tou"]["peak"]["rate_incl_gst"], nn["tou"]["peak"]["window"], nn["tou"]["offPeak"]["rate_incl_gst"], nn["dailyCharge_incl_gst"])
      == ("tou", 36.95, "09:00–21:00", 20.05, 1.01))
st = pl("Stack It Up 24", "Fixed-price plan based on usage per billing period: (i) Stack 1 - First 300 kWh @29.20¢/kWh (ii) Stack 2 - "
        "Usage between 301 to 600 kWh @28.60¢/kWh (iii) Stack 3 - Above 600 kWh @27.60¢/kWh (Rates excl. 9% GST are 26.788¢/kWh)")
check("pacificlight: usage stacks become tiers 0-300, 300-600, 600+",
      st["tiers"] == [{"from": 0, "to": 300, "rate_incl_gst": 29.2}, {"from": 300, "to": 600, "rate_incl_gst": 28.6},
                      {"from": 600, "to": None, "rate_incl_gst": 27.6}])
es = pl("Easy Save", "Discount-off Regulated Tariff Plan: 18% Discount Off Tariff + Daily Charge 55¢/day (Rate excl. 9% GST for Daily "
        "Charge is 50¢/day).", "Not applicable")
check("pacificlight: discount off tariff with a daily charge", (es["type"], es["discount"], es["dailyCharge_incl_gst"])
      == ("dot", {"value": 18.0, "kind": "percent"}, 0.55))
c60 = pl("Classic 60", "Discount off SP Regulated Tariff plan: Up to 8% off ( 3% off SP Regulated Tariff + 5% Prompt Payment Discount*)",
         "60 months")
check("pacificlight: 'up to 8%' plan stores the 3% off tariff and notes the prompt payment discount",
      c60["discount"] == {"value": 3.0, "kind": "percent"} and "prompt payment" in c60["notes"] and c60["contractMonths"] == 60)
check("pacificlight: unrecognised price wording is low confidence, no price",
      pl("Savvy Saver 24", "Please call us for today's rate.")["confidence"] == "low")
check("pacificlight: green plan keeps our sheet's category", pl("Sunny Side-Up 12", "Fixed price plan: 31.00¢/kWh "
      "(Rate excl. 9% GST is 28.44¢/kWh)", "12 months")["category"] == "Green")
check("pacificlight: fact sheet pages from the index, no repeats",
      pl_slugs('<a href="/support/factsheet-detail/06-savvy-saver-24-8-oct-2026">x</a><a href="factsheet-detail/1-easy-save">'
               '<a href="/support/factsheet-detail/06-savvy-saver-24-8-oct-2026">') == ["06-savvy-saver-24-8-oct-2026", "1-easy-save"])

# ── The script's reads pass the same accuracy guards as the agent's ──
for f in [p["FIXED24"], fixed, tu, ss, ep]:
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
st2 = dict(st, matches_id="pacificlight-stack-it-up-24", tiers=[dict(b) for b in st["tiers"]])
st2["tiers"][1]["rate_incl_gst"] = 28.9
check("side-by-side: a different tier rate is reported", len(against({"plans": [dict(st, matches_id="pacificlight-stack-it-up-24")]},
                                                                      {"plans": [st2]})) == 1)
for f in (sw, st):
    check(f"guards: {f['name']} passes (every rate in its quote)", not sanity(f, as_plan(f), {"pricingType": f["type"]}))

# ── Helpers ──
check("clock: 7am, 11pm, 12am, 9:30pm", [clock(x) for x in ("7am", "11pm", "12am", "9:30pm")] == ["07:00", "23:00", "00:00", "21:30"])
check("fact sheet dates: '22 Oct 26', '16 June 2026' and '06/Oct/2026'",
      (fs_date("22 Oct 26"), fs_date("16 June 2026"), fs_date("06/Oct/2026")) == ("2026-10-22", "2026-06-16", "2026-10-06"))

sys.exit(1 if fails else 0)
