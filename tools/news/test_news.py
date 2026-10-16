"""Checks the market news parsers, filter, waiting list and publishing.  Run: python tools/news/test_news.py"""
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import sources as S
from apply import merge, read_news, write_news
from collect import update_pending
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

sys.exit(1 if fails else 0)
