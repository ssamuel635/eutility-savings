"""Open a price-check report for approval; "Save approvals" saves straight into the run folder.

    python tools/price_check/review_server.py                      (the newest run)
    python tools/price_check/review_server.py price-checks/<date>

It opens the report in your browser at http://127.0.0.1:8765/ (this PC only). Tick what's
right, type your name and press Save approvals: approved-<date>.json is written into the run
folder, the first place apply.py looks. Press Ctrl+C here when you're done.

Only ticks that exist in this report are accepted, so a stray or edited file can't approve
anything the report didn't show.
"""
import argparse
import html
import json
import re
import sys
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from report import APPROVE_JS  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RUN_NAME = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_BODY = 256 * 1024
KINDS = {"plans": "plan", "promotions": "promo", "terms": "terms"}


class Invalid(ValueError):
    pass


def newest_run(base):
    runs = sorted(p for p in Path(base).iterdir() if p.is_dir() and RUN_NAME.match(p.name))
    if not runs:
        raise SystemExit(f"No runs in {base}")
    return runs[-1]


def page(run):
    """The report, with the current approval script (older reports carry the old "Save as" one)."""
    text = (run / "report.html").read_text(encoding="utf-8")
    if 'id="ap-save"' in text and "<script>" in text:
        text = text[:text.rindex("<script>")] + APPROVE_JS + "</body></html>"
    return text


def known_ids(report_html):
    """{'plan': {...}, 'promo': {...}, 'terms': {...}}: the ticks this report offers."""
    out = {k: set() for k in KINDS.values()}
    for kind, i in re.findall(r"data-kind='(\w+)' data-id='([^']*)'", report_html):
        out.setdefault(kind, set()).add(html.unescape(i))
    return out


def validate(data, run_name, known):
    """The approvals to save, or Invalid with a reason a person can act on."""
    if not isinstance(data, dict):
        raise Invalid("not an approvals object")
    if data.get("run") != run_name:
        raise Invalid(f"these approvals are for {data.get('run')!r}, not this run ({run_name})")
    who = data.get("approved_by")
    if not isinstance(who, str) or not who.strip() or len(who) > 80 or re.search(r"[\x00-\x1f\x7f]", who):
        raise Invalid("type your name (up to 80 characters)")
    out = {"run": run_name, "approved_by": who.strip(),
           "approved_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")}
    total = 0
    for key, kind in KINDS.items():
        ids = data.get(key, [])
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise Invalid(f"{key} must be a list of ids")
        unknown = [i for i in ids if i not in known.get(kind, set())]
        if unknown:
            raise Invalid(f"not in this report: {', '.join(unknown[:3])}")
        out[key] = sorted(set(ids))
        total += len(out[key])
    if not total:
        raise Invalid("nothing is ticked")
    return out, total


def make_handler(run, port):
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}

    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, body, ctype):
            data = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _json(self, status, obj):
            self._send(status, json.dumps(obj), "application/json; charset=utf-8")

        def _local(self):
            # Only this page, on this PC: blocks other sites (and DNS rebinding) from posting approvals.
            origin = self.headers.get("Origin")
            return self.headers.get("Host") in allowed_hosts and (origin is None or origin.split("://", 1)[-1] in allowed_hosts)

        def do_GET(self):
            if self.headers.get("Host") not in allowed_hosts:
                return self._send(403, "Forbidden", "text/plain")
            if self.path in ("/", "/report.html"):
                return self._send(200, page(run), "text/html; charset=utf-8")
            self._send(404, "Not found", "text/plain")

        def do_POST(self):
            if self.path != "/save":
                return self._json(404, {"error": "not found"})
            if not self._local():
                return self._json(403, {"error": "only the report opened on this PC can save"})
            size = int(self.headers.get("Content-Length") or 0)
            if not 0 < size <= MAX_BODY:
                return self._json(413, {"error": "approvals too large"})
            try:
                data = json.loads(self.rfile.read(size).decode("utf-8"))
                approvals, count = validate(data, run.name, known_ids(page(run)))
            except (ValueError, UnicodeDecodeError) as e:
                return self._json(400, {"error": str(e) if isinstance(e, Invalid) else "not valid approvals"})
            name = f"approved-{run.name}.json"
            (run / name).write_text(json.dumps(approvals, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"Saved {run / name}: {count} approved by {approvals['approved_by']}", flush=True)
            self._json(200, {"file": name, "count": count})

        def log_message(self, *args):  # keep the console to the lines that matter
            pass

    return Handler


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to cp1252
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run_dir", nargs="?", help="price-checks/<date> (default: the newest run)")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()
    run = Path(a.run_dir) if a.run_dir else newest_run(ROOT / "price-checks")
    run = (run if run.is_absolute() else ROOT / run).resolve()
    if not RUN_NAME.match(run.name) or not (run / "report.html").exists():
        raise SystemExit(f"No report.html in {run}")
    server = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(run, a.port))
    url = f"http://127.0.0.1:{a.port}/"
    print(f"Report for {run.name}: {url}  (Ctrl+C to stop)", flush=True)
    if not a.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
