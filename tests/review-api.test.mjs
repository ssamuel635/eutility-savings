// Tests for the staff Review page API (api/review.mjs), with GitHub faked.  Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const { default: middleware, hashPassword, makeSession } = await import('../middleware.js');
const { GET, POST, checkDecision } = await import('../api/review.mjs');

const salt = randomBytes(16).toString('hex');
process.env.GATE_SECRET = 'test-secret';
const admin = { name: 'ebin', role: 'admin', hash: await hashPassword('a-pass', salt) };
const viewer = { name: 'kenneth', role: 'viewer', hash: await hashPassword('v-pass', salt) };
process.env.GATE_USERS = [admin, viewer].map((u) => `${u.name}:${u.role}:${salt}:${u.hash}`).join(',');
process.env.REVIEW_GITHUB_TOKEN = 'test-token';

const B = 'https://site.test';
const cookie = async (u) => `eu_gate=${await makeSession(u)}`;
const ITEMS = [
  { id: 'aaaaaaaaaaaa', date: '2026-10-22', title: 'Tariff up', source: 'SP Group', kind: 'official', url: 'https://sp.test/a', keywords: ['tariff'] },
  { id: 'bbbbbbbbbbbb', date: '2026-10-21', title: 'Outage', source: 'CNA', kind: 'news', url: 'https://cna.test/b', keywords: ['power outage'] },
  { id: 'cccccccccccc', date: '2026-10-20', title: 'Old one', source: 'CNA', kind: 'news', url: 'https://cna.test/c', keywords: ['LNG'] },
];

// A fake GitHub: answers the calls the API makes and records what was written.
let calls;
let saved;
function fakeGitHub({ failDispatch = false } = {}) {
  calls = [];
  saved = {};
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const p = u.pathname.replace('/repos/ssamuel635/eutility-savings', '');
    calls.push({ method: init.method || 'GET', path: p, ref: u.searchParams.get('ref'), auth: init.headers.authorization, body: init.body && JSON.parse(init.body) });
    const ok = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    if (p === '/contents/news-checks') return ok([{ type: 'dir', name: '2026-10-21' }, { type: 'dir', name: '2026-10-22' }, { type: 'file', name: 'state.json' }]);
    if (p === '/contents/news-checks/2026-10-22') return ok([{ type: 'file', name: 'candidates.json', path: 'news-checks/2026-10-22/candidates.json' }, { type: 'file', name: 'approved-news-2026-10-22-080000.json', path: 'news-checks/2026-10-22/approved-news-2026-10-22-080000.json' }]);
    if (p === '/contents/news-checks/2026-10-22/approved-news-2026-10-22-080000.json') return ok(JSON.stringify({ items: [], rejected: ['bbbbbbbbbbbb'] }));
    if (p === '/contents/news-checks/2026-10-22/candidates.json') return ok(JSON.stringify({ run: '2026-10-22', collected_at: '2026-10-22T08:31:00+08:00', days: 7, items: ITEMS, sources: [{ source: 'CNA', read: 9, error: '' }] }));
    if (p === '/contents/news-checks/state.json') return ok(JSON.stringify({ decided: { cccccccccccc: 'approved' } }));
    if (p.startsWith('/contents/news-checks/2026-10-22/approved-news-') && init.method === 'PUT') { saved[p] = JSON.parse(init.body); return ok({ content: {} }, 201); }
    if (p === '/actions/workflows/publish.yml/runs') return ok({ workflow_runs: [{ status: 'completed', conclusion: 'success', created_at: '2026-10-22T01:00:00Z', html_url: 'https://github.com/x', triggering_actor: { login: 'ssamuel635' } }] });
    if (p === '/actions/workflows/publish.yml/dispatches') return failDispatch ? ok({ message: 'no' }, 422) : new Response(null, { status: 204 });
    return ok({ message: 'Not Found' }, 404);
  };
}

const get = async (who) => GET(new Request(B + '/api/review', { headers: who ? { cookie: await cookie(who) } : {} }));
const post = async (who, body, headers = {}) => POST(new Request(B + '/api/review', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { cookie: await cookie(who), 'content-type': 'application/json', origin: B, 'sec-fetch-site': 'same-origin', ...headers },
}));

test('only admins can read the waiting list', async () => {
  fakeGitHub();
  assert.equal((await get(null)).status, 401);
  assert.equal((await get(viewer)).status, 403);
  assert.equal(calls.length, 0, 'GitHub is not called for non-admins');
});

test('lists the newest run, without decided or already-saved headlines', async () => {
  fakeGitHub();
  const res = await get(admin);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user, 'ebin');
  const news = data.reviews[0];
  assert.equal(news.run, '2026-10-22');
  assert.deepEqual(news.items.map((x) => x.id), ['aaaaaaaaaaaa']);
  assert.equal(data.publishes[0].conclusion, 'success');
  assert.ok(calls.every((c) => c.auth === 'Bearer test-token'));
  assert.ok(calls.filter((c) => c.path.startsWith('/contents')).every((c) => c.ref === 'feature/app-crm-v2'));
  assert.ok(!JSON.stringify(data).includes('test-token'), 'the token never reaches the page');
});

test('approving saves who/what/when, then starts publishing', async () => {
  fakeGitHub();
  const res = await post(admin, { kind: 'news', run: '2026-10-22', approved: ['aaaaaaaaaaaa'], rejected: ['cccccccccccc'], approved_by: 'someone else' });
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.match(out.file, /^news-checks\/2026-10-22\/approved-news-2026-10-22-\d{6}\.json$/);
  const put = Object.values(saved)[0];
  assert.equal(put.branch, 'feature/app-crm-v2');
  const record = JSON.parse(Buffer.from(put.content, 'base64').toString());
  assert.equal(record.approved_by, 'ebin', 'the name comes from the session, not the request');
  assert.match(record.approved_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
  assert.deepEqual([record.run, record.items, record.rejected], ['2026-10-22', ['aaaaaaaaaaaa'], ['cccccccccccc']]);
  const dispatch = calls.find((c) => c.path.endsWith('/dispatches'));
  assert.deepEqual(dispatch.body, { ref: 'main', inputs: { kind: 'news', run: '2026-10-22', approved: out.file } });
});

test('viewers, other sites and bad input cannot approve', async () => {
  fakeGitHub();
  const body = { kind: 'news', run: '2026-10-22', approved: ['aaaaaaaaaaaa'] };
  assert.equal((await post(viewer, body)).status, 403);
  assert.equal((await post(admin, body, { origin: 'https://evil.test', 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await post(admin, body, { origin: '' })).status, 403);
  assert.equal((await post(admin, { ...body, run: '../state' })).status, 400);
  assert.equal((await post(admin, { ...body, approved: ['dddddddddddd'] })).status, 400, 'ids must be in that run');
  assert.equal(Object.keys(saved).length, 0);
  assert.ok(!calls.some((c) => c.path.endsWith('/dispatches')));
});

test('if publishing fails to start, the saved file is reported', async () => {
  fakeGitHub({ failDispatch: true });
  const res = await post(admin, { kind: 'news', run: '2026-10-22', approved: ['aaaaaaaaaaaa'] });
  assert.equal(res.status, 502);
  const out = await res.json();
  assert.match(out.error, /decisions are saved/);
  assert.equal(Object.keys(saved).length, 1);
});

test('without the GitHub token the page says it is not set up', async () => {
  const t = process.env.REVIEW_GITHUB_TOKEN;
  delete process.env.REVIEW_GITHUB_TOKEN;
  try {
    const res = await get(admin);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).setup, true);
  } finally {
    process.env.REVIEW_GITHUB_TOKEN = t;
  }
});

test('decision checks', () => {
  assert.equal(checkDecision({ kind: 'news', run: '2026-10-22', approved: ['aaaaaaaaaaaa'] }), '');
  assert.match(checkDecision({ kind: 'price', run: '2026-10-22', approved: ['aaaaaaaaaaaa'] }), /Unknown kind/);
  assert.match(checkDecision({ kind: 'news', run: '2026-10-22' }), /at least one/);
  assert.match(checkDecision({ kind: 'news', run: '2026-10-22', approved: ['aaaaaaaaaaaa'], rejected: ['aaaaaaaaaaaa'] }), /both/);
  const d = (topics) => checkDecision({ kind: 'news', run: '2026-10-22', approved: ['aaaaaaaaaaaa'], rejected: ['bbbbbbbbbbbb'], topics });
  assert.equal(d({ aaaaaaaaaaaa: 'solar' }), '', 'a photo topic for an approved headline');
  assert.match(d({ bbbbbbbbbbbb: 'solar' }), /only for approved/, 'not for a rejected one');
  assert.match(d({ aaaaaaaaaaaa: '<script>' }), /only for approved/, 'topic keys are plain words');
  assert.match(d(['solar']), /must be an object/);
});

test('staff pages are for admins only', async () => {
  const page = async (who) => middleware(new Request(B + '/staff/review.html', { headers: { accept: 'text/html', ...(who ? { cookie: await cookie(who) } : {}) } }));
  assert.equal((await page(null)).status, 401);
  assert.equal((await page(viewer)).status, 403);
  assert.equal((await page(admin)).headers.get('x-middleware-next'), '1');
});
