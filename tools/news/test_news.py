"""Checks the market news parsers, filter, waiting list and publishing.  Run: python tools/news/test_news.py"""
import json
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import sources as S
import alerts
from apply import merge, read_news, split, write_news
from collect import same_story, update_pending
from review import render

fails = 0


def check(name, ok):
    global fails
    print(("PASS " if ok else "FAIL ") + name)
    fails += not ok


NEWS_SRC = {"key": "st", "name": "The Straits Times", "kind": "news", "type": "rss", "url": "https://example.sg/rss"}
SP_SRC = S.SOURCES[0]
OEM_SRC = S.SOURCES[1]

RSS = """<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
<item><title>Electricity tariff to rise 2.1% from January</title><link>https://example.sg/a?utm_source=rss#top</link>
<pubDate>Wed, 15 Oct 2026 22:30:00 +0000</pubDate><description>&lt;p&gt;SP Group said on Thursday&lt;/p&gt;</description></item>
<item><title>Haze returns to Singapore</title><link>https://example.sg/b</link><pubDate>Thu, 16 Oct 2026 08:00:00 +0800</pubDate></item>
<item><title>No date here</title><link>https://example.sg/c</link></item>
</channel></rss>""".encode()

ATOM = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Senoko Energy launches new plan</title>
<link rel="alternate" href="https://example.sg/d"/><published>2026-10-14T09:00:00+08:00</published></entry></feed>"""

SP_PAGE = """<div class="kui-newsAndMediaReleases__item"><div class="kui-newsAndMediaReleases__item__date">29 Sep 2026</div>
<div class="kui-newsAndMediaReleases__item__content"><a class="kui-newsAndMediaReleases__item__title" href="/news/Electricity-Tariff-Revision" target="_blank">Electricity Tariff Revision for the Period 1 October to 31 December 2026</a></div></div>
<div class="kui-newsAndMediaReleases__item"><div class="kui-newsAndMediaReleases__item__date">04 Oct 2026</div>
<div class="kui-newsAndMediaReleases__item__content"><a class="kui-newsAndMediaReleases__item__title" href="/news/golf" target="_blank">SP Group Charity Golf raises S$1.1 million</a></div></div>"""

OEM_PAGE = """<script>$(".list-retailer").listRetailer({
  dataList: [
    // {
    //   title: "Sunseap Energy Pte Ltd",
    // },
    { id: "1", title: "Senoko Energy Supply Pte Ltd", star: "4.0" },
    { id: "2", title: "Geneco (by Seraya Energy Pte Ltd)", star: "4.5" },
  ],
  desktopPaginationSize: 9,
});</script>"""

# ── Parsers ──
items = S.parse_rss(NEWS_SRC, RSS)
check("RSS: items without a date are skipped", len(items) == 2)
a = items[0]
check("RSS: date is the Singapore date (22:30 UTC is the next morning here)", a["date"] == "2026-10-16")
check("RSS: tracking parameters and #fragment removed", a["url"] == "https://example.sg/a")
check("RSS: description is plain text", a["snippet"] == "SP Group said on Thursday")
check("RSS: keywords found in headline and description", a["keywords"][:1] == ["Electricity"] and "SP Group" in a["keywords"])
check("RSS: off-topic headline has no keywords", items[1]["keywords"] == [])
check("RSS: same link, same id", a["id"] == S.item_id("https://example.sg/a?utm_medium=x"))
at = S.parse_rss(NEWS_SRC, ATOM)
check("Atom: entry read with its link", len(at) == 1 and at[0]["url"] == "https://example.sg/d" and at[0]["keywords"] == ["Senoko"])

sp = S.parse_sp_group(SP_SRC, SP_PAGE)
check("SP Group: both releases read with dates", [x["date"] for x in sp] == ["2026-09-29", "2026-10-04"])
check("SP Group: links made absolute", sp[0]["url"].startswith("https://www.spgroup.com.sg/news/"))
check("SP Group: tariff release is on topic", "Electricity" in sp[0]["keywords"])
check("SP Group: its own name doesn't count as a match", sp[1]["keywords"] == [])

names = S.parse_oem_retailers(OEM_PAGE)
check("OEM: commented-out retailers skipped", names == ["Geneco (by Seraya Energy Pte Ltd)", "Senoko Energy Supply Pte Ltd"])
now = datetime(2026, 10, 16, 9, tzinfo=S.SGT)
check("OEM: no change, no headline", S.oem_change_item(OEM_SRC, names, list(names), now) is None)
ch = S.oem_change_item(OEM_SRC, names, names[:1] + ["Flo Energy Singapore Pte. Ltd."], now)
check("OEM: change becomes a headline", ch and "Flo Energy Singapore Pte. Ltd. joined" in ch["title"] and "Senoko Energy Supply Pte Ltd left" in ch["title"])
check("OEM: keyword whole words only", S.matches("SEMA4 and EMA rules") == ["EMA"])

# ── Waiting list ──
today = date(2026, 10, 16)
state = {"decided": {"gone": "rejected"}, "pending": {}, "oem_retailers": None}
old = dict(a, id="old", date="2026-10-01")
done = dict(a, id="gone")
future = dict(a, id="future", date="2026-10-20")
out = update_pending(state, items + at + [old, done, future], today, 7)
check("pending: on-topic, undecided, in-window headlines kept", [x["id"] for x in out] == [a["id"], at[0]["id"]])
out = update_pending(state, [], today, 7)
check("pending: kept after it drops off the feed", len(out) == 2)
state["decided"][a["id"]] = "approved"
out = update_pending(state, [], today, 7)
check("pending: decided headlines leave the list", [x["id"] for x in out] == [at[0]["id"]])
out = update_pending(state, [], date(2026, 10, 30), 7)
check("pending: headlines older than the window expire", out == [])

# ── Same story from several outlets ──
st = dict(a, id="s1", source="The Straits Times", date="2026-10-15", title="Gas supply cut from Indonesia accounts for less than 2% of S’pore’s daily gas demand: EMA")
bt = dict(a, id="s2", source="The Business Times", date="2026-10-15", title="Gas supply cut from Indonesia accounts for less than 2% of Singapore’s daily gas demand: EMA")
cna = dict(a, id="s3", source="CNA", date="2026-10-14", title="Reduction in Indonesia gas supply amounts to less than 2% of Singapore’s total daily demand: EMA")
other = dict(a, id="s4", source="CNA", date="2026-10-15", title="S’pore to drill deeper into geothermal energy after promising results of its potential: Tan See Leng")
diverse = dict(a, id="s5", source="The Straits Times", date="2026-10-15", title="S’pore to tap diverse energy sources, explore new tech, to weather resource nationalism: Tan See Leng")
check("same story: word-for-word rewrites match", same_story(st, bt) and same_story(st, cna))
check("same story: different angles stay apart", not same_story(other, diverse))
check("same story: one outlet never merges with itself", not same_story(st, dict(bt, source=st["source"])))
s2 = {"decided": {}, "pending": {}}
out = update_pending(s2, [st, bt, cna, other, diverse], today, 7)
also = lambda: sorted(x["id"] for x in s2["pending"]["s3"].get("also", []))
check("same story: repeats listed under the first report", len(out) == 3 and "s3" in s2["pending"] and also() == ["s1", "s2"])
out = update_pending(s2, [st, bt, cna], today, 7)
check("same story: repeats aren't added twice", len(out) == 3 and also() == ["s1", "s2"])
s2["decided"]["s3"] = "rejected"
out = update_pending(s2, [st, bt], today, 7)
check("same story: repeats take the decision and stay gone", s2["decided"].get("s1") == "rejected" and not {"s1", "s2"} & {x["id"] for x in out})

# ── Review page ──
page = render({"run": "2026-10-16", "collected_at": "2026-10-16T09:00:00+08:00", "days": 7, "items": [dict(a, title='<script>x</script>')],
               "sources": [{"source": "CNA", "read": 0, "error": "URLError: timed out"}]})
check("review: headline escaped", "<script>x</script>" not in page and "&lt;script&gt;" in page)
check("review: failed source shown", "Couldn’t read" in page and "timed out" in page)
check("review: approval bar present", 'id="ap-save"' in page and 'data-id="' + a["id"] + '"' in page)

# ── Publishing ──
pub = {k: a[k] for k in ("id", "date", "title", "source", "kind", "url")}
cur = [dict(pub, id="x1", date="2026-10-01", title="Older"), dict(pub, id="x2", date="2026-10-10", title="Newer")]
m = merge(cur, [pub, dict(pub, id="x2")], keep=2)
check("merge: newest first, no repeats, capped", [x["id"] for x in m] == [a["id"], "x2"])
with tempfile.TemporaryDirectory() as d:
    f = Path(d) / "news.js"
    check("news.js: missing file reads as empty", read_news(f) == [])
    write_news(m, f)
    check("news.js: written and read back", read_news(f) == m)
    check("news.js: is a JS module", "export const NEWS = [" in f.read_text(encoding="utf-8"))
    write_news([], f)
    check("news.js: empty list round-trips", read_news(f) == [])

# ── Approvals from the Review page: reject only what's rejected ──
three = [dict(pub, id=i) for i in ("p1", "p2", "p3")]
ok, no = split(three, {"p1"})
check("approvals without a rejected list: the rest is set aside", [x["id"] for x in no] == ["p2", "p3"])
ok, no = split(three, {"p1"}, ["p2", "p1"])
check("approvals with a rejected list: the rest keeps waiting", [x["id"] for x in ok] == ["p1"] and [x["id"] for x in no] == ["p2"])

# ── Alerts for the daily GitHub run ──
def run_file(folder, day, items, errors=()):
    d = Path(folder) / day
    d.mkdir(parents=True)
    srcs = [{"source": n, "read": 0, "error": "URLError: timed out" if n in errors else ""} for n in ("CNA", "SP Group")]
    (d / "candidates.json").write_text(json.dumps({"run": day, "items": items, "sources": srcs}), encoding="utf-8")

with tempfile.TemporaryDirectory() as d:
    check("alerts: no runs, nothing to say", alerts.summarise(d)["waiting"] == 0)
    run_file(d, "2026-10-20", three[:1], errors=["CNA"])
    run_file(d, "2026-10-21", three[:2], errors=["CNA", "SP Group"])
    run_file(d, "2026-10-22", three, errors=["CNA"])
    (Path(d) / "state.json").write_text(json.dumps({"decided": {"p1": "approved"}}), encoding="utf-8")
    s = alerts.summarise(d, "https://x.test/review")
    check("alerts: decided headlines aren't waiting", s["waiting"] == 2 and s["run"] == "2026-10-22")
    check("alerts: only today's first sightings count as new", s["new"] == 1)
    check("alerts: a source failing 3 runs in a row is reported", [f["source"] for f in s["failing"]] == ["CNA"] and s["failing"][0]["since"] == "2026-10-20")
    check("alerts: issue text links the Review page and the headlines", "https://x.test/review" in s["waiting_md"] and "[Headline" not in s["waiting_md"] and three[1]["url"] in s["waiting_md"])
    (Path(d) / "2026-10-19").mkdir()  # a folder without candidates.json is ignored
    check("alerts: failing text names the source", "**CNA** since 2026-10-20" in alerts.summarise(d)["failing_md"])
check("alerts: fewer than 3 runs never counts as failing", alerts.failing_sources([{"run": "x", "sources": [{"source": "CNA", "error": "e"}]}]) == [])

sys.exit(1 if fails else 0)
