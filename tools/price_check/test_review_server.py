"""Checks the review server saves approvals into the run folder, and only real ticks from this PC.
Run: python3 tools/price_check/test_review_server.py"""
import json
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from review_server import make_handler, page  # noqa: E402

fails = 0


def check(name, ok):
    global fails
    print(("PASS " if ok else "FAIL ") + name)
    fails += not ok


REPORT = """<html><body data-run="2026-11-30"><main>
<label class='ok'><input type='checkbox' data-kind='plan' data-id='keppel-electric-fixed24'> Approve</label>
<label class='ok'><input type='checkbox' data-kind='promo' data-id='geneco-get-it-fixed-12'> Approve</label>
<div class="apbar"><button type="button" id="ap-save">Save approvals</button></div>
</main><script>OLD showSaveFilePicker SCRIPT</script></body></html>"""


def post(port, body, host=None, origin=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{port}/save", data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    if host:
        req.add_header("Host", host)
    if origin:
        req.add_header("Origin", origin)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


with tempfile.TemporaryDirectory() as d:
    run = Path(d) / "2026-11-30"
    run.mkdir()
    (run / "report.html").write_text(REPORT, encoding="utf-8")
    saved = run / "approved-2026-11-30.json"

    served = page(run)
    check("older reports get the new save script", "showSaveFilePicker" not in served and "fetch('save'" in served)

    server = ThreadingHTTPServer(("127.0.0.1", 0), None)
    port = server.server_address[1]
    server.RequestHandlerClass = make_handler(run, port)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    good = {"run": "2026-11-30", "approved_by": "Ebin", "plans": ["keppel-electric-fixed24"], "promotions": ["geneco-get-it-fixed-12"]}

    status, body = post(port, good, origin=f"http://127.0.0.1:{port}")
    data = json.loads(saved.read_text(encoding="utf-8")) if saved.exists() else {}
    check("saves into the run folder", status == 200 and body["count"] == 2 and data.get("plans") == ["keppel-electric-fixed24"])
    check("records who approved and when", data.get("approved_by") == "Ebin" and data.get("approved_at", "").endswith("Z"))
    check("file has every list apply.py reads", data.get("terms") == [] and data.get("promotions") == ["geneco-get-it-fixed-12"])

    saved.unlink()
    status, body = post(port, {**good, "plans": ["not-in-report"]})
    check("ids not in the report are refused", status == 400 and "not in this report" in body["error"] and not saved.exists())
    status, body = post(port, {**good, "run": "2026-11-23"})
    check("approvals for another run are refused", status == 400 and not saved.exists())
    status, body = post(port, {**good, "approved_by": "  "})
    check("a name is required", status == 400 and not saved.exists())
    status, body = post(port, {**good, "plans": [], "promotions": []})
    check("nothing ticked is refused", status == 400 and not saved.exists())
    status, body = post(port, good, origin="https://evil.example")
    check("other sites can't post", status == 403 and not saved.exists())
    status, body = post(port, good, host=f"evil.example:{port}")
    check("other host names can't post", status == 403 and not saved.exists())
    server.shutdown()
    server.server_close()

sys.exit(1 if fails else 0)
