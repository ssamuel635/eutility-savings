"""
Market news: the review page (news-checks/<date>/review.html).

Built by collect.py. The approver ticks the headlines that belong on the site,
types their name and presses "Save approvals", which saves
approved-news-<date>.json for apply.py. Anything not ticked is set aside and
won't be shown again. Opened straight from disk, so plain JS, no libraries.
"""
import html
from datetime import date


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def nice_date(iso):
    d = date.fromisoformat(iso)
    return f"{d.day} {d.strftime('%b %Y')}"


APPROVE_JS = """<script>
(() => {
  const run = document.body.dataset.run;
  const boxes = [...document.querySelectorAll('input[data-id]')];
  const $ = (id) => document.getElementById(id);
  const count = $('ap-count'), name = $('ap-name'), save = $('ap-save'), msg = $('ap-msg');
  if (!boxes.length) return;
  const update = () => {
    const n = boxes.filter((b) => b.checked).length;
    count.textContent = n + ' of ' + boxes.length + ' ticked';
    save.disabled = !name.value.trim();
  };
  boxes.forEach((b) => b.addEventListener('change', update));
  name.addEventListener('input', update);
  save.addEventListener('click', async () => {
    const data = { run, approved_by: name.value.trim(), approved_at: new Date().toISOString(),
                   items: boxes.filter((b) => b.checked).map((b) => b.dataset.id) };
    const text = JSON.stringify(data, null, 1), file = 'approved-news-' + run + '.json';
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
      msg.textContent = 'Saved ' + file + '. Next, ask Claude to \\u201cpublish the approved news for ' + run + '\\u201d.';
    } catch (e) {
      if (e.name !== 'AbortError') msg.textContent = 'Couldn\\u2019t save: ' + e.message;
    }
  });
  update();
})();
</script>"""


def render(data):
    items, run = data["items"], data["run"]
    rows = "".join(f"""<tr>
      <td><label class="ok"><input type="checkbox" data-id="{esc(it['id'])}"> Publish</label></td>
      <td class="num">{esc(nice_date(it['date']))}</td>
      <td><span class="tag {'tag--official' if it['kind'] == 'official' else ''}">{'Official' if it['kind'] == 'official' else 'News'}</span><div class="muted">{esc(it['source'])}</div></td>
      <td><a href="{esc(it['url'])}" target="_blank" rel="noopener"><b>{esc(it['title'])}</b></a>
        {f"<div class='snip'>{esc(it['snippet'])}</div>" if it.get('snippet') else ''}
        <div class="muted">Matched: {esc(', '.join(it['keywords']))}</div></td>
    </tr>""" for it in items)

    src_rows = "".join(f"""<tr><td><b>{esc(s['source'])}</b></td>
      <td>{f"<span class='err'>Couldn’t read</span><div class='muted'>{esc(s['error'])}</div>" if s['error'] else esc(s.get('note') or f"{s['read']} headlines read")}</td></tr>"""
                       for s in data["sources"])

    body = f"""<section><h2>Headlines <span class="count">{len(items)}</span></h2>
      <p class="blurb">Tick the ones that belong on the site. The grey text under a headline comes from the source’s feed and helps you decide; it isn’t published.</p>
      <div class="scroll"><table><thead><tr><th></th><th>Date</th><th>Source</th><th>Headline</th></tr></thead><tbody>{rows}</tbody></table></div></section>""" \
        if items else """<section><h2>Nothing new to review</h2><p class="blurb">No new electricity headlines in the window. Nothing to do today.</p></section>"""

    return f"""<!doctype html><html lang="en-SG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Market news {esc(run)} — Eutility</title>
<style>
:root{{--ink:#294671;--text:#212121;--muted:#5b6472;--line:#e3e1dc;--bg:#f6f8fb;--blue:#007BB8;--err:#b42318;--ok:#027a48}}
*{{box-sizing:border-box}}body{{margin:0;font:15px/1.5 Montserrat,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text);background:var(--bg)}}
main{{max-width:1080px;margin:0 auto;padding:28px 16px 64px}}h1{{font-size:26px;color:var(--ink);margin:0 0 4px}}h2{{font-size:19px;color:var(--ink);margin:0 0 4px}}
.sub{{color:var(--muted);margin:0 0 20px}}section{{background:#fff;border:1px solid var(--line);border-radius:2px;padding:18px;margin:16px 0}}
.count{{border:1px solid var(--line);border-radius:99px;padding:1px 9px;font-size:13px;color:var(--muted)}}.blurb{{color:var(--muted);margin:0 0 12px}}
.scroll{{overflow-x:auto}}table{{width:100%;border-collapse:collapse;font-size:14px}}th,td{{text-align:left;vertical-align:top;padding:10px 8px;border-top:1px solid var(--line)}}
th{{font-size:12px;color:var(--muted);border-top:0}}.num{{white-space:nowrap}}.muted{{color:var(--muted);font-size:13px}}.snip{{color:var(--muted);font-size:13px;margin:4px 0}}
a{{color:var(--blue)}}.tag{{font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px;border:1px solid var(--line);color:var(--ink);white-space:nowrap}}.tag--official{{border-color:var(--blue);color:var(--blue)}}
.err{{color:var(--err);font-weight:600}}.ok{{white-space:nowrap;font-size:13px}}
.apbar{{position:sticky;bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:2px;padding:12px 14px;margin:16px 0}}
.apbar input{{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:6px;min-width:180px}}.apbar button{{font:inherit;font-weight:600;padding:8px 14px;border-radius:99px;border:1px solid var(--blue);background:var(--blue);color:#fff;cursor:pointer}}
.apbar button:disabled{{opacity:.45;cursor:not-allowed}}#ap-msg{{flex-basis:100%;font-size:13px;color:var(--ok)}}#ap-msg:empty{{display:none}}
</style></head><body data-run="{esc(run)}"><main>
<h1>Market news · {esc(nice_date(run))}</h1>
<p class="sub">Electricity headlines from the last {data['days']} days that haven’t been reviewed yet. Nothing is on the website until you approve it: tick what should go live, type your name and press <b>Save approvals</b>. Anything you leave unticked is set aside and won’t come back.</p>
{body}
<section><h2>Sources checked</h2><div class="scroll"><table><tbody>{src_rows}</tbody></table></div></section>
{'' if not items else '''<div class="apbar"><b id="ap-count"></b>
<input id="ap-name" placeholder="Your name" aria-label="Your name" autocomplete="name"><button type="button" id="ap-save">Save approvals</button><span id="ap-msg" role="status"></span></div>'''}
<p class="muted">Generated by tools/news/collect.py at {esc(data['collected_at'])}. Headlines only: the website shows each title, its source and date, and links to the original.</p>
</main>{APPROVE_JS}</body></html>"""
