// ─────────────────────────────────────────────────────────────
// Staff Review page API (Vercel Function): /api/review
//
//   GET   the market news headlines waiting for a decision, read from
//         news-checks/ on GitHub (the daily collect workflow commits there),
//         plus the last few publishing runs
//   POST  { kind: "news", run, approved: [ids], rejected: [ids] }
//         saves the decision as news-checks/<run>/approved-news-<run>-<time>.json
//         (who, when, what) and starts .github/workflows/publish.yml
//
// Admins only: the gate's session cookie is checked here as well as in
// middleware.js, and the approver's name comes from it, never from the page.
// Undecided headlines stay waiting.
//
// Environment (Vercel → Project → Settings → Environment Variables, Production):
//   REVIEW_GITHUB_TOKEN  fine-grained token, this repo only: Contents read/write,
//                        Actions read/write. Never sent to the browser.
//   REVIEW_REPO          default ssamuel635/eutility-savings
//   SITE_BRANCH          branch the site is published from, default feature/app-crm-v2
//   WORKFLOW_REF         branch holding the workflow files, default main
// ─────────────────────────────────────────────────────────────

import { readSession } from '../middleware.js';

const env = (name, fallback = '') => process.env[name] || fallback;
const cfg = () => ({
  token: env('REVIEW_GITHUB_TOKEN'),
  repo: env('REVIEW_REPO', 'ssamuel635/eutility-savings'),
  branch: env('SITE_BRANCH', 'feature/app-crm-v2'),
  workflowRef: env('WORKFLOW_REF', 'main'),
});

// Kinds of approval the page handles. The weekly price check joins here once its
// collection moves off the PC: same file-then-publish path (tools/publish.py price).
const KINDS = {
  news: { folder: 'news-checks', file: (run, stamp) => `approved-news-${run}-${stamp}.json` },
};

const RUN = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[0-9a-f]{12}$/;
const MAX_BODY = 32 * 1024;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
});

class GitHubError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function github(path, { method = 'GET', body, raw = false } = {}) {
  const { token, repo } = cfg();
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'eutility-review-page',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new GitHubError(res.status, `GitHub ${method} ${path.split('?')[0]}: ${res.status}`);
  if (res.status === 204) return null;
  return raw ? res.text() : res.json();
}

const file = async (path) => JSON.parse(await github(`/contents/${path}?ref=${encodeURIComponent(cfg().branch)}`, { raw: true }));

async function latestRun(folder) {
  const list = await github(`/contents/${folder}?ref=${encodeURIComponent(cfg().branch)}`);
  const runs = list.filter((x) => x.type === 'dir' && RUN.test(x.name)).map((x) => x.name).sort();
  return runs.at(-1) || null;
}

/** Decisions saved for this run that publish.yml may not have applied yet, so they don't show again meanwhile. */
async function savedDecisions(run) {
  const list = await github(`/contents/news-checks/${run}?ref=${encodeURIComponent(cfg().branch)}`);
  const files = list.filter((x) => x.type === 'file' && x.name.startsWith(`approved-news-${run}`) && x.name.endsWith('.json'));
  const out = {};
  for (const f of await Promise.all(files.map((x) => file(x.path)))) {
    for (const id of f.items || []) out[id] = 'approved';
    for (const id of f.rejected || []) out[id] = 'rejected';
  }
  return out;
}

async function waitingNews() {
  const run = await latestRun('news-checks');
  if (!run) return { kind: 'news', run: null, items: [], sources: [] };
  const [cands, state, saved] = await Promise.all([file(`news-checks/${run}/candidates.json`), file('news-checks/state.json'), savedDecisions(run)]);
  const decided = { ...(state.decided || {}), ...saved };
  const items = cands.items.filter((it) => !decided[it.id])
    .map(({ id, date, title, source, kind, url, snippet, keywords }) => ({ id, date, title, source, kind, url, snippet, keywords }));
  return { kind: 'news', run, collected_at: cands.collected_at, days: cands.days, items, sources: cands.sources };
}

async function recentPublishes() {
  try {
    const r = await github('/actions/workflows/publish.yml/runs?per_page=5');
    return r.workflow_runs.map((w) => ({ status: w.status, conclusion: w.conclusion, created_at: w.created_at, url: w.html_url, actor: w.triggering_actor?.login || '' }));
  } catch {
    return []; // the list is a nice-to-have; the page still works without it
  }
}

/** Who is asking: an admin session, or a Response to send back. */
async function admin(request) {
  const session = await readSession(request);
  if (!session) return json(401, { error: 'Sign in first.' });
  if (session.role !== 'admin') return json(403, { error: 'The Review page is for admins only.' });
  if (!cfg().token) return json(503, { error: 'The Review page isn’t connected to GitHub yet (REVIEW_GITHUB_TOKEN is not set in Vercel).', setup: true });
  return session;
}

function sameOrigin(request) {
  const url = new URL(request.url);
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  return (!site || site === 'same-origin') && !!origin && origin === url.origin;
}

/** Singapore time: 2026-10-22T09:15:04+08:00 and the 091504 used in the file name. */
function sgNow(now = new Date()) {
  const t = new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 19);
  return { iso: `${t}+08:00`, stamp: t.slice(11).replace(/:/g, '') };
}

export function checkDecision(body, candidateIds) {
  const { kind, run, approved = [], rejected = [] } = body || {};
  if (!KINDS[kind]) return 'Unknown kind of approval.';
  if (typeof run !== 'string' || !RUN.test(run)) return 'Run must be a date like 2026-10-22.';
  if (!Array.isArray(approved) || !Array.isArray(rejected)) return 'approved and rejected must be lists.';
  const all = [...approved, ...rejected];
  if (!all.length) return 'Approve or reject at least one headline.';
  if (all.length > 200 || !all.every((x) => typeof x === 'string' && ID.test(x))) return 'Those headline ids aren’t valid.';
  if (new Set(all).size !== all.length) return 'A headline can’t be both approved and rejected.';
  if (candidateIds && !all.every((x) => candidateIds.has(x))) return 'Some of those headlines aren’t in that run any more. Reload the page.';
  return '';
}

export async function GET(request) {
  const who = await admin(request);
  if (who instanceof Response) return who;
  try {
    const [news, publishes] = await Promise.all([waitingNews(), recentPublishes()]);
    return json(200, { user: who.name, branch: cfg().branch, repo: cfg().repo, reviews: [news], publishes });
  } catch (e) {
    return json(502, { error: `Couldn’t read the waiting items from GitHub (${e.message}).` });
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return json(403, { error: 'Forbidden' });
  const who = await admin(request);
  if (who instanceof Response) return who;
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return json(415, { error: 'Send JSON.' });
  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { error: 'Too many items in one go.' });
  let body;
  try { body = JSON.parse(text); } catch { return json(400, { error: 'Invalid JSON.' }); }

  const bad = checkDecision(body);
  if (bad) return json(400, { error: bad });
  const { kind, run, approved = [], rejected = [] } = body;
  const { folder, file: name } = KINDS[kind];
  const { branch, workflowRef, repo } = cfg();

  let cands;
  try { cands = await file(`${folder}/${run}/candidates.json`); } catch (e) {
    return json(e.status === 404 ? 400 : 502, { error: e.status === 404 ? `There’s no ${run} run.` : `Couldn’t read that run from GitHub (${e.message}).` });
  }
  const bad2 = checkDecision(body, new Set(cands.items.map((it) => it.id)));
  if (bad2) return json(400, { error: bad2 });

  const t = sgNow();
  const path = `${folder}/${run}/${name(run, t.stamp)}`;
  const record = { run, approved_by: who.name, approved_at: t.iso, items: approved, rejected, via: 'staff Review page' };
  try {
    await github(`/contents/${path}`, {
      method: 'PUT',
      body: {
        message: `Review: ${who.name} approved ${approved.length}, rejected ${rejected.length} ${kind} item(s) for ${run}`,
        content: Buffer.from(JSON.stringify(record, null, 1) + '\n').toString('base64'),
        branch,
      },
    });
  } catch (e) {
    return json(502, { error: `Couldn’t save your decisions to GitHub (${e.message}). Nothing was published.` });
  }
  const actions = `https://github.com/${repo}/actions/workflows/publish.yml`;
  try {
    await github('/actions/workflows/publish.yml/dispatches', { method: 'POST', body: { ref: workflowRef, inputs: { kind, run, approved: path } } });
  } catch (e) {
    return json(502, { error: `Your decisions are saved (${path}), but publishing didn’t start (${e.message}). Start “Publish approved changes” by hand at ${actions}.`, file: path, actions });
  }
  return json(200, { ok: true, file: path, approved: approved.length, rejected: rejected.length, actions });
}
