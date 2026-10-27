// Staff Review page: lists what's waiting (from /api/review), records Approve /
// Reject per item, and sends the decisions, which saves them on GitHub and starts
// the publish workflow. Everything shown is built with textContent (no HTML from
// the feeds reaches the page).

const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k != null));
  return n;
}
const niceDate = (iso) => new Date(iso + 'T00:00:00+08:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' });
const when = (iso) => new Date(iso).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore' });
const safeUrl = (u) => (/^https:\/\//i.test(u || '') ? u : null);

const choices = new Map(); // id -> 'approved' | 'rejected'
let review = null;

function note(text, kind = '') {
  const s = $('status');
  s.textContent = text;
  s.className = 'note' + (kind ? ` is-${kind}` : '');
}

async function api(init) {
  const res = await fetch('/api/review', { credentials: 'same-origin', ...init });
  let body = {};
  try { body = await res.json(); } catch { body = { error: res.status === 401 ? 'Sign in first.' : `The server answered ${res.status}.` }; }
  if (!res.ok) throw Object.assign(new Error(body.error || `The server answered ${res.status}.`), body);
  return body;
}

function tally() {
  const v = [...choices.values()];
  const a = v.filter((x) => x === 'approved').length, r = v.length - a, left = review.items.length - v.length;
  $('tally').textContent = `${a} approved · ${r} rejected · ${left} undecided`;
  $('publish').disabled = !v.length;
  $('publish').textContent = a ? 'Save and publish' : 'Save decisions';
}

function itemRow(it) {
  const choice = el('div', { className: 'choice', role: 'group', ariaLabel: `Decision for ${it.title}` });
  for (const [v, label] of [['approved', 'Approve'], ['rejected', 'Reject']]) {
    const b = el('button', { type: 'button', textContent: label });
    b.dataset.v = v;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const on = choices.get(it.id) !== v;
      if (on) choices.set(it.id, v); else choices.delete(it.id);
      choice.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(on && x.dataset.v === v)));
      tally();
    });
    choice.append(b);
  }
  const url = safeUrl(it.url);
  const title = url ? el('a', { href: url, target: '_blank', rel: 'noopener', className: 'title', textContent: it.title }) : el('span', { className: 'title', textContent: it.title });
  const tag = el('span', { className: 'tag' + (it.kind === 'official' ? ' tag--official' : ''), textContent: it.kind === 'official' ? 'Official' : 'News' });
  return el('li', { className: 'item' },
    el('div', {},
      el('p', { className: 'meta' }, tag, `${niceDate(it.date)} · ${it.source}`),
      title,
      it.snippet ? el('p', { className: 'snip', textContent: it.snippet }) : null,
      it.also?.length ? el('p', { className: 'snip', textContent: `Also reported by ${it.also.map((x) => x.source).join(', ')}` }) : null,
      it.keywords?.length ? el('p', { className: 'snip', textContent: `Matched: ${it.keywords.join(', ')}` }) : null),
    choice);
}

function showNews(r) {
  review = r;
  choices.clear();
  $('news').hidden = false;
  $('news-count').textContent = String(r.items.length);
  $('news-blurb').textContent = r.run
    ? `From the ${niceDate(r.run)} run (collected ${when(r.collected_at)}), looking back ${r.days} days. The grey text comes from the source’s feed to help you decide; only the headline, source, date and link are published.`
    : 'No runs yet.';
  $('news-items').replaceChildren(...r.items.map(itemRow));
  $('news-sources').replaceChildren(...(r.sources || []).map((s) => el('li', {},
    el('b', { textContent: s.source }), ': ',
    s.error ? el('span', { className: 'err', textContent: `couldn’t read (${s.error})` }) : (s.note || `${s.read} headlines read`))));
  $('bar').hidden = !r.items.length;
  if (r.items.length) tally();
}

function showRuns(runs) {
  $('runs').hidden = !runs.length;
  $('runs-list').replaceChildren(...runs.map((w) => {
    const state = w.status !== 'completed' ? 'running now' : w.conclusion === 'success' ? 'published' : `failed (${w.conclusion}), nothing went live`;
    return el('li', {}, `${when(w.created_at)}: `, el('a', { href: safeUrl(w.url) || '#', target: '_blank', rel: 'noopener', textContent: state }));
  }));
}

async function load() {
  try {
    const data = await api();
    $('who').textContent = `Signed in as ${data.user} · ${data.repo} (${data.branch})`;
    const news = data.reviews.find((x) => x.kind === 'news');
    showNews(news);
    showRuns(data.publishes || []);
    note(news.items.length ? '' : 'Nothing is waiting for review. Check back after the next daily run (8:30am).');
  } catch (e) {
    note(e.message, 'err');
  }
}

$('publish').addEventListener('click', async () => {
  const pick = (v) => [...choices].filter(([, x]) => x === v).map(([id]) => id);
  const body = { kind: 'news', run: review.run, approved: pick('approved'), rejected: pick('rejected') };
  const btn = $('publish'), msg = $('msg');
  btn.disabled = true;
  msg.textContent = 'Saving…';
  try {
    const r = await api({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    msg.textContent = '';
    note(r.approved
      ? `Saved: ${r.approved} approved, ${r.rejected} rejected. Publishing has started; the site updates in a few minutes. If a check fails nothing goes live and you’ll get an email.`
      : `Saved: ${r.rejected} rejected. They won’t come back.`, 'ok');
    await new Promise((ok) => setTimeout(ok, 1500));
    const data = await api();
    showNews(data.reviews.find((x) => x.kind === 'news'));
    showRuns(data.publishes || []);
  } catch (e) {
    msg.textContent = e.message;
    btn.disabled = false;
  }
});

load();
