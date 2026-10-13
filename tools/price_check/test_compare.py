"""Checks that the accuracy guards catch the mistakes an agent could make.  Run: python3 tools/price_check/test_compare.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from compare import as_plan, sanity, cross_check, in_quote

def finding(**kw):
    base = {"type": "fixed", "contractMonths": 24, "rate_incl_gst": 29.0, "rate_excl_gst": 26.61, "discount": None,
            "dailyCharge_incl_gst": None, "tou": None, "tiers": None, "evidence": "Fixed Rate 29.00¢/kWh (w/GST) 26.61¢ (w/o GST)"}
    base.update(kw)
    return base

cur = {"pricingType": "fixed", "rate": 29.8}
cases = [
    ("clean finding passes", finding(), False),
    ("number not in its own quote (invented)", finding(rate_incl_gst=27.5, rate_excl_gst=None), True),
    ("GST pair inconsistent (read the wrong column)", finding(rate_excl_gst=27.0), True),
    ("implausible rate (decimal slip)", finding(rate_incl_gst=2.9, rate_excl_gst=None, evidence="2.9"), True),
    ("too-large weekly jump", finding(rate_incl_gst=22.0, rate_excl_gst=None, evidence="22.00"), True),
    ("dollar-format quote accepted", finding(rate_incl_gst=30.9, rate_excl_gst=None, evidence="(with GST) $0.3090 /kWh"), False),
]
fails = 0
for name, f, expect_flag in cases:
    got = bool(sanity(f, as_plan(f), cur))
    ok = got == expect_flag
    fails += not ok
    print(("PASS" if ok else "FAIL"), name)
a, b = finding(), finding(rate_incl_gst=29.5)
r = cross_check(as_plan(a), b)
print(("PASS" if r else "FAIL"), "two reads that disagree are caught"); fails += not r
r = cross_check(as_plan(a), finding())
print(("PASS" if r == [] else "FAIL"), "two reads that agree pass"); fails += r != []
print(("PASS" if not in_quote(29.0, "129.00") else "FAIL"), "no partial-number matches"); fails += in_quote(29.0, "129.00")
sys.exit(1 if fails else 0)
