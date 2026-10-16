"""
Market news: where the headlines come from, and how each source is read.

Headlines only. We keep the title, date, source and link, and never copy an
article. Every source is checked against its robots.txt before it is read.

EMA (ema.gov.sg) isn't here: its site blocks automated readers, and we don't
work around that. EMA announcements still reach the news feeds below.
"""
import email.utils
import hashlib
import html
import json
import re
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin, urlsplit, urlunsplit

SGT = timezone(timedelta(hours=8))
UA = "Mozilla/5.0 (compatible; EutilityNews/1.0; +https://eutility.com.sg)"

SOURCES = [
    # "ignore": words that don't count as a match for this source (every SP Group release says "SP Group").
    {"key": "sp-group", "name": "SP Group", "kind": "official", "type": "sp-group", "ignore": ["SP Group"],
     "url": "https://www.spgroup.com.sg/about-us/media-resources/news-and-media-releases"},
    {"key": "oem", "name": "Open Electricity Market", "kind": "official", "type": "oem-retailers",
     "url": "https://www.openelectricitymarket.sg/residential/list-of-retailers"},
    {"key": "straits-times", "name": "The Straits Times", "kind": "news", "type": "rss",
     "url": "https://www.straitstimes.com/news/singapore/rss.xml"},
    {"key": "business-times", "name": "The Business Times", "kind": "news", "type": "rss",
     "url": "https://www.businesstimes.com.sg/rss/singapore"},
    {"key": "cna", "name": "CNA", "kind": "news", "type": "rss",
     "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416"},
]

# An item is kept when its headline or the feed's short description mentions one of
# these. Whole words, any case. Broad on purpose: a person approves every item.
KEYWORDS = [
    "electricity", "power tariff", "electricity tariff", "tariff revision", "power grid",
    "SP Group", "SP Services", "Energy Market Authority", "EMA", "Open Electricity Market",
    "electricity retailer", "power retailer", "U-Save", "utilities bill", "utility bill",
    "Geneco", "Seraya", "Senoko", "Keppel Electric", "PacificLight", "Sembcorp",
    "Tuas Power", "Flo Energy", "natural gas", "LNG", "power plant", "power supply",
    "electricity prices", "energy prices", "carbon tax", "solar", "power outage", "blackout",
]
_KW = re.compile(r"(?<![\w-])(" + "|".join(re.escape(k) for k in KEYWORDS) + r")(?![\w-])", re.I)


def matches(*texts):
    """The keywords found in the texts, in the order they appear (no repeats)."""
    seen = []
    for t in texts:
        for m in _KW.finditer(t or ""):
            k = m.group(1)
            if k.lower() not in [s.lower() for s in seen]:
                seen.append(k)
    return seen


def clean_url(url):
    """The link without tracking parameters or #fragments, so repeats are recognised."""
    p = urlsplit(url.strip())
    q = "&".join(x for x in p.query.split("&") if x and not x.lower().startswith(("utm_", "cid=", "ref=")))
    return urlunsplit((p.scheme, p.netloc.lower(), p.path, q, ""))


def item_id(url):
    return hashlib.sha1(clean_url(url).encode()).hexdigest()[:12]


def text(s):
    """Plain text from a bit of HTML: tags removed, entities decoded, spaces tidied."""
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def make_item(src, title, url, published, snippet=""):
    url = clean_url(url)
    return {
        "id": item_id(url), "title": text(title), "url": url, "date": published.astimezone(SGT).date().isoformat(),
        "source": src["name"], "source_key": src["key"], "kind": src["kind"],
        "snippet": text(snippet)[:280],
        "keywords": [k for k in matches(title, snippet) if k.lower() not in [i.lower() for i in src.get("ignore", [])]],
    }


# ── Reading the web ─────────────────────────────────────────────────────────────

_robots = {}


def allowed(url):
    """True if the site's robots.txt lets us read this URL. If robots.txt can't be read, we don't read the site."""
    p = urlsplit(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
        except urllib.error.HTTPError as e:
            # No robots.txt (404) means no rules; anything else (401/403/5xx) means stay out.
            rp.parse([] if e.code == 404 else ["User-agent: *", "Disallow: /"])
        except Exception:
            rp.parse(["User-agent: *", "Disallow: /"])
        _robots[base] = rp
    return _robots[base].can_fetch(UA, url)


def fetch(url, raw=False):
    """The page as text, or as bytes with raw=True (feeds: the XML parser reads the encoding itself)."""
    if not allowed(url):
        raise PermissionError(f"robots.txt doesn't allow reading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-SG,en"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
        return body if raw else body.decode(r.headers.get_content_charset() or "utf-8", "replace")


# ── Parsers: page text in, items out. Kept free of network calls so they can be tested. ──

def parse_rss(src, xml):
    """RSS 2.0 or Atom, as bytes (or text)."""
    root = ET.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
    atom = "{http://www.w3.org/2005/Atom}"
    out = []
    for it in root.iter("item"):
        title, link = it.findtext("title") or "", (it.findtext("link") or "").strip()
        when = it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date")
        if not (title and link and when):
            continue
        try:
            dt = email.utils.parsedate_to_datetime(when)
        except (TypeError, ValueError):
            dt = datetime.fromisoformat(when.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=SGT)
        out.append(make_item(src, title, link, dt, it.findtext("description") or ""))
    for e in root.iter(atom + "entry"):
        title = e.findtext(atom + "title") or ""
        link_el = e.find(atom + "link[@rel='alternate']")
        if link_el is None:  # (an Element with no children is falsy, so no `or` here)
            link_el = e.find(atom + "link")
        when = e.findtext(atom + "published") or e.findtext(atom + "updated")
        if not (title and link_el is not None and when):
            continue
        dt = datetime.fromisoformat(when.replace("Z", "+00:00"))
        out.append(make_item(src, title, link_el.get("href", ""), dt, e.findtext(atom + "summary") or ""))
    return out


_SP_ITEM = re.compile(
    r'__item__date">\s*([^<]+?)\s*<.*?class="kui-newsAndMediaReleases__item__title"\s+href="([^"]+)"[^>]*>(.*?)</a>', re.S)


def parse_sp_group(src, page):
    """SP Group's News & Media Releases page: date, headline and link for each release."""
    out = []
    for when, href, title in _SP_ITEM.findall(page):
        try:
            dt = datetime.strptime(when.strip(), "%d %b %Y").replace(tzinfo=SGT)
        except ValueError:
            continue
        out.append(make_item(src, title, urljoin(src["url"], html.unescape(href)), dt))
    return out


def parse_oem_retailers(page):
    """The retailer names on OEM's List of Retailers (written into the page's script; commented-out ones skipped)."""
    start = page.find("listRetailer({")
    if start < 0:
        raise ValueError("retailer list not found on the page")
    end = page.find("desktopPaginationSize", start)
    block = page[start:end if end > 0 else start + 30000]
    block = "\n".join(l for l in block.splitlines() if not l.strip().startswith("//"))
    names = re.findall(r'title:\s*"([^"]+)"', block)
    if not names:
        raise ValueError("no retailers found in the list")
    return sorted(set(html.unescape(n).strip() for n in names))


def oem_change_item(src, before, after, today):
    """A headline for a change in OEM's retailer list, or None if nothing changed."""
    joined = sorted(set(after) - set(before))
    left = sorted(set(before) - set(after))
    if not (joined or left):
        return None
    bits = []
    if joined:
        bits.append(f"{', '.join(joined)} joined")
    if left:
        bits.append(f"{', '.join(left)} left")
    title = f"Open Electricity Market retailer list updated: {' and '.join(bits)}"
    item = make_item(src, title, src["url"], today)
    # Same page link each time, so the id also carries what changed.
    item["id"] = hashlib.sha1(json.dumps([joined, left]).encode()).hexdigest()[:12]
    item["keywords"] = ["retailer list"]
    return item
