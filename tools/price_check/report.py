"""
Weekly price check: the review page (price-checks/<date>/report.html).

Built by compare.py. The approver ticks what's right, types their name and
presses "Save approvals", which saves approved-<date>.json for apply.py.
"""
from compare import DAYS, MAX_JUMP, RATE_MAX, RATE_MIN, STALE_DAYS, TYPICAL_KWH, esc, fmt


def money(v):
    return "—" if v is None else f"S${v:,.2f}"


def promo_txt(p):
    if not p:
        return "<span class='muted'>None</span>"
    bits = [esc(p.get("title") or ""), esc(p.get("value") or "")]
    if p.get("code"):
        bits.append(f"code <b>{esc(p['code'])}</b>")
    if p.get("expires"):
        bits.append(f"ends {esc(p['expires'])}")
    return " · ".join(b for b in bits if b)


def trust_html(x):
    t = x.get("trust")
    if x["kind"] == "unverified":
        age = x.get("age_days")
        when = f"Last confirmed {esc(x.get('last_verified'))}" + (f" ({age} days ago)" if age is not None else "")
        return f"<span class='conf {'low' if x.get('stale') else 'medium'}'>{'Stale' if x.get('stale') else 'Not checked'}</span><div class='muted'>{when}</div>"
    if not t:
        return f"<span class='conf {esc(x['confidence'] or 'none')}'>{esc(x['confidence'] or 'n/a')}</span>"
    bits = []
    sr = t.get("second_read")
    if sr == "agrees":
        bits.append(f"<span class='conf'>✓ Double-checked</span>")
    elif sr == "disagrees":
        bits.append("<span class='conf low'>Reads disagree</span>")
    else:
        bits.append(f"<span class='conf {esc(x['confidence'] or 'none')}'>One read · {esc(x['confidence'] or 'n/a')}</span>")
    if t.get("high_impact") or x.get("high_impact"):
        bits.append("<span class='conf medium'>High impact</span>")
    issues = t.get("flags", []) + t.get("disagreements", [])
    if issues:
        bits.append("<ul class='flags'>" + "".join(f"<li>{esc(i)}</li>" for i in issues) + "</ul>")
    return " ".join(bits)

# The approval bar. Plain JS, no libraries: the report is opened straight from disk.
APPROVE_JS = """<script>
(() => {
  const run = document.body.dataset.run;
  const boxes = [...document.querySelectorAll('input[data-id]')];
  const $ = (id) => document.getElementById(id);
  const count = $('ap-count'), name = $('ap-name'), save = $('ap-save'), msg = $('ap-msg');
  const update = () => {
    const n = boxes.filter((b) => b.checked).length;
    count.textContent = n + (n === 1 ? ' change' : ' changes') + ' ticked';
    save.disabled = !n || !name.value.trim();
  };
  boxes.forEach((b) => b.addEventListener('change', update));
  name.addEventListener('input', update);
  $('ap-all').addEventListener('click', () => {
    const on = boxes.some((b) => !b.checked);
    boxes.forEach((b) => { b.checked = on; });
    update();
  });
  save.addEventListener('click', async () => {
    const pick = (k) => boxes.filter((b) => b.checked && b.dataset.kind === k).map((b) => b.dataset.id);
    const data = { run, approved_by: name.value.trim(), approved_at: new Date().toISOString(),
                   plans: pick('plan'), promotions: pick('promo') };
    const text = JSON.stringify(data, null, 1), file = 'approved-' + run + '.json';
    try {
      if (window.showSaveFilePicker) {
        const h = await window.showSaveFilePicker({ suggestedName: file, types: [{ description: 'Approvals', accept: { 'application/json': ['.json'] } }] });
        const w = await h.createWritable();
        await w.write(text);
        await w.close();
      } else {
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: file });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      msg.textContent = 'Saved ' + file + '. Next, ask Claude to \\u201capply the approved changes for ' + run + '\\u201d.';
    } catch (e) {
      if (e.name !== 'AbortError') msg.textContent = 'Couldn\\u2019t save: ' + e.message;
    }
  });
  update();
})();
</script>"""


def render(summary, rows, promo_rows, retailers):
    c = summary["counts"]
    bn, bw = summary["best_now"], summary["best_new"]
    order = {"changed": 0, "removed": 1, "new": 2, "unverified": 3, "same": 4}
    rows = sorted(rows, key=lambda x: (order[x["kind"]], x["retailer"], x["plan"]))
    label = {"changed": "Price changed", "removed": "No longer offered", "new": "New plan",
             "unverified": "Couldn’t verify", "same": "No change"}

    def plan_rows(kind):
        out = []
        for i, x in enumerate([r for r in rows if r["kind"] == kind]):
            chg = "<br>".join(f"{esc(f)}: <s>{fmt(o)}</s> → <b>{fmt(n)}</b>" for f, o, n in x["changes"]) or "—"
            delta = ""
            if x["old_bill"] is not None and x["new_bill"] is not None and abs(x["new_bill"] - x["old_bill"]) >= 0.005:
                d = x["new_bill"] - x["old_bill"]
                delta = f"<span class='{'up' if d > 0 else 'down'}'>{'+' if d > 0 else '−'}S${abs(d):.2f}/mo</span>"
            src = f"<a href='{esc(x['source'])}' target='_blank' rel='noopener'>source</a>" if x["source"] else ""
            t = x.get("trust") or {}
            blocked = t.get("blocked")
            approve = ""
            if kind == "new":
                approve = "<span class='muted'>Added by hand</span>"
            elif kind in ("changed", "removed"):
                approve = "<span class='blk'>Blocked</span>" if blocked else \
                    f"<label class='ok'><input type='checkbox' data-kind='plan' data-id='{esc(x['id'])}'> Approve</label>"
            checks = trust_html(x)
            out.append(f"""<tr class='{'is-blocked' if blocked else ''}'><td><b>{esc(x['plan'])}</b><div class='muted'>{esc(x['retailer'])}</div></td>
              <td>{chg}</td><td class='num'>{money(x['old_bill'])} → {money(x['new_bill'])}<div>{delta}</div></td>
              <td>{checks}</td>
              <td class='note'>{esc(x['notes'])} {src}</td><td>{approve}</td></tr>""")
        return "".join(out)

    def table(kind, title, blurb):
        body = plan_rows(kind)
        if not body:
            return ""
        return f"""<section><h2>{title} <span class='count'>{c[kind]}</span></h2><p class='blurb'>{blurb}</p>
        <div class='scroll'><table><thead><tr><th>Plan</th><th>What changed</th><th>Bill at {TYPICAL_KWH} kWh</th><th>Checks</th><th>Notes</th><th></th></tr></thead>
        <tbody>{body}</tbody></table></div></section>"""

    promo_html = "".join(f"""<tr><td><b>{esc(p['plan'])}</b><div class='muted'>{esc(p['retailer'])}</div></td>
        <td>{promo_txt(p['old'])}</td><td>{promo_txt(p['new'])}</td>
        <td>{f"<a href='{esc(p['source'])}' target='_blank' rel='noopener'>source</a>" if p['source'] else ''}</td>
        <td><label class='ok'><input type='checkbox' data-kind='promo' data-id='{esc(p['id'])}'> Approve</label></td></tr>""" for p in promo_rows)

    ret_html = "".join(f"""<tr><td><b>{esc(s['retailer'])}</b></td><td class='num'>{s['checked']}</td><td class='num'>{s['changed']}</td>
        <td class='num'>{s['unverified']}</td><td class='num'>{s['removed']}</td><td class='num'>{s['new']}</td>
        <td class='note'>{esc(s['issues'])}</td></tr>""" for s in retailers if s["retailer"] != "SP Group")

    impact = ""
    if bn and bw:
        impact = f"""<div class='impact'><div><span class='k'>Recommended at {TYPICAL_KWH} kWh today</span><b>{esc(bn[2])} {esc(bn[3])}</b><span>{money(bn[0])}/mo · saves ~S${summary['saving_now']}/yr</span></div>
        <div class='arrow'>→</div><div><span class='k'>After approving these changes</span><b>{esc(bw[2])} {esc(bw[3])}</b><span>{money(bw[0])}/mo · saves ~S${summary['saving_new']}/yr</span></div></div>"""

    return f"""<!doctype html><html lang="en-SG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Price check {esc(summary['run_date'])} — Eutility</title>
<style>
:root{{--ink:#173a5e;--text:#1d2939;--muted:#5b6472;--line:#e3e7ec;--bg:#f6f8fb;--blue:#26649B;--up:#b42318;--down:#027a48;--amber:#b54708}}
*{{box-sizing:border-box}}body{{margin:0;font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text);background:var(--bg)}}
main{{max-width:1180px;margin:0 auto;padding:28px 16px 64px}}h1{{font-size:26px;color:var(--ink);margin:0 0 4px}}h2{{font-size:19px;color:var(--ink);margin:0 0 4px}}
.sub{{color:var(--muted);margin:0 0 20px}}section{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0}}.card{{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}}
.card b{{display:block;font-size:24px;color:var(--ink)}}.card span{{color:var(--muted);font-size:13px}}.count{{background:var(--bg);border-radius:99px;padding:1px 9px;font-size:13px;color:var(--muted)}}
.blurb{{color:var(--muted);margin:0 0 12px}}.scroll{{overflow-x:auto}}table{{width:100%;border-collapse:collapse;font-size:14px}}th,td{{text-align:left;vertical-align:top;padding:9px 8px;border-top:1px solid var(--line)}}
th{{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-top:0}}.num{{white-space:nowrap}}.note{{color:var(--muted);font-size:13px;max-width:360px}}.muted{{color:var(--muted);font-size:13px}}
.up{{color:var(--up);font-weight:600;font-size:13px}}.down{{color:var(--down);font-weight:600;font-size:13px}}s{{color:var(--muted)}}a{{color:var(--blue)}}
.conf{{font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px;background:#eef4fa;color:var(--blue)}}.conf.medium{{background:#fef0c7;color:var(--amber)}}.conf.low,.conf.none{{background:#fee4e2;color:var(--up)}}
.ok{{white-space:nowrap;font-size:13px}}.impact{{display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}}
.impact>div:not(.arrow){{display:grid;gap:2px;flex:1;min-width:220px}}.impact .k{{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}}.impact b{{color:var(--ink);font-size:17px}}.arrow{{font-size:22px;color:var(--muted)}}
ul.flags{{margin:6px 0 0;padding-left:16px;color:var(--up);font-size:12px}}.blk{{font-size:12px;font-weight:700;color:var(--up)}}tr.is-blocked td{{background:#fffbfa}}.how{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin:16px 0}}.how summary{{cursor:pointer;font-weight:600;color:var(--ink)}}.how li{{margin:4px 0;color:var(--muted)}}.how b{{color:var(--text)}}
.apbar{{position:sticky;bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:16px 0;box-shadow:0 -4px 18px rgba(23,58,94,.10)}}
.apbar input{{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;min-width:180px}}.apbar button{{font:inherit;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid var(--blue);background:#fff;color:var(--blue);cursor:pointer}}
.apbar #ap-save{{background:var(--blue);color:#fff}}.apbar #ap-save:disabled{{opacity:.45;cursor:not-allowed}}#ap-msg{{flex-basis:100%;font-size:13px;color:var(--down)}}#ap-msg:empty{{display:none}}
.callout{{background:#fffaeb;border:1px solid #fedf89;border-radius:12px;padding:12px 14px;margin:12px 0;font-size:14px}}
</style></head><body data-run="{esc(summary['run_date'])}"><main>
<h1>Weekly price check · {esc(summary['run_date'])}</h1>
<p class="sub">Retailers’ official sites compared with the site’s current data (rates as at {esc(summary['data_rates_as_at'])}). Nothing has been changed yet: tick what you approve, type your name in the bar at the bottom and press <b>Save approvals</b>.</p>
<div class="cards">
 <div class="card"><b>{c['changed']}</b><span>prices changed</span></div>
 <div class="card"><b>{c['removed']}</b><span>plans withdrawn</span></div>
 <div class="card"><b>{summary['promo_changes']}</b><span>promotion updates</span></div>
 <div class="card"><b>{c['unverified']}</b><span>couldn’t verify{f" ({len(summary['stale'])} stale)" if summary['stale'] else ''}</span></div>
 <div class="card"><b>{summary['coverage']['pct']}%</b><span>coverage: {summary['coverage']['confirmed']} of {summary['coverage']['total']} plans confirmed</span></div>
 <div class="card"><b>{summary['double_checked']}</b><span>double-checked</span></div>
 <div class="card"><b>{summary['blocked']}</b><span>blocked by checks</span></div>
 <div class="card"><b>{c['same']}</b><span>unchanged</span></div>
 <div class="card"><b>{fmt(summary['tariff_new'])}¢</b><span>SP tariff incl. GST{' (unchanged)' if summary['tariff_new'] == summary['tariff_now'] else f" (was {fmt(summary['tariff_now'])}¢)"}</span></div>
</div>
{impact}
<details class="how"><summary>How this report guards against wrong numbers</summary><ul>
<li><b>Official sources only.</b> Every number links to the retailer’s own page or fact sheet. Comparison sites are never used as a source.</li>
<li><b>No guessing.</b> If a page can’t be read, the plan is marked “couldn’t verify” and keeps its current price. Nothing is filled in.</li>
<li><b>Quote check.</b> The agent copies the exact text it read; the script rejects any number that isn’t in that text.</li>
<li><b>Sanity checks.</b> Rates outside {RATE_MIN:g}–{RATE_MAX:g}¢, jumps over {MAX_JUMP:.0%} in a week, oversized discounts, and with-GST / without-GST pairs that don’t match (×1.09) are blocked.</li>
<li><b>Second read.</b> Anything that would change the top 3 recommendations or move a typical bill by S$5+/month must be read a second time by a separate pass (different method, e.g. the retailer’s fact sheet or data feed). If the two reads disagree, it’s blocked.</li>
<li><b>Gaps are tracked.</b> Each unverified plan shows when it was last confirmed; after {STALE_DAYS} days it’s marked stale so it gets checked by hand or hidden.</li>
<li><b>A person approves.</b> Nothing reaches the website until someone ticks it here. Blocked items can’t be ticked.</li></ul></details>
{table('changed', 'Price changes', 'The retailer’s official site shows a different price from our data. Bill effect is for a typical home using ' + str(TYPICAL_KWH) + ' kWh a month.')}
{table('removed', 'No longer offered', 'On our site, but no longer on the retailer’s site. Approving hides the plan.')}
{table('new', 'New plans', 'On the retailer’s site but not in our data.')}
{table('unverified', 'Couldn’t verify', 'The page couldn’t be read reliably (images, scripts or mid-update). These need a quick manual check; nothing changes until then.')}
<section><h2>Promotion updates <span class="count">{summary['promo_changes']}</span></h2><p class="blurb">Promotions change often and don’t affect the savings figure, but they show on plan cards.</p>
<div class="scroll"><table><thead><tr><th>Plan</th><th>On our site</th><th>On retailer’s site</th><th></th><th></th></tr></thead><tbody>{promo_html}</tbody></table></div></section>
<section><h2>By retailer</h2><div class="scroll"><table><thead><tr><th>Retailer</th><th>Checked</th><th>Changed</th><th>Unverified</th><th>Withdrawn</th><th>New</th><th>Notes</th></tr></thead><tbody>{ret_html}</tbody></table></div></section>
{table('same', 'Unchanged', 'Confirmed against the retailer’s site.')}
<div class="apbar"><b id="ap-count"></b><button type="button" id="ap-all">Tick / untick all</button>
<input id="ap-name" placeholder="Your name" aria-label="Your name" autocomplete="name"><button type="button" id="ap-save">Save approvals</button><span id="ap-msg" role="status"></span></div>
<p class="muted">Generated by tools/price_check/compare.py. Bill estimates use the same maths as the website (30% off-peak for time-of-use plans, {DAYS} days a month). Prices are compared including 9% GST.</p>
</main>{APPROVE_JS}</body></html>"""
