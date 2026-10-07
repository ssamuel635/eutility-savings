// Tests for the private-preview gate (middleware.js).  Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const { default: middleware, hashPassword, parseUsers } = await import('../middleware.js');

const salt = randomBytes(16).toString('hex');
const salt2 = randomBytes(16).toString('hex');
process.env.GATE_SECRET = 'test-secret';
process.env.GATE_USERS = [
  `kenneth:viewer:${salt}:${await hashPassword('viewer-pass-123', salt)}`,
  `ebin:admin:${salt2}:${await hashPassword('admin-pass-456', salt2)}`,
].join(',');

const B = 'https://site.test';
const page = (path, init = {}) => new Request(B + path, { headers: { accept: 'text/html', ...(init.headers || {}) }, ...init });
const passes = (res) => res.headers.get('x-middleware-next') === '1';
async function login(username, password, next = '/') {
  const body = new URLSearchParams({ username, password, next });
  return middleware(new Request(B + '/__gate/login', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }));
}
const cookieFrom = (res) => res.headers.get('set-cookie').split(';')[0];

test('parses accounts', () => {
  const u = parseUsers();
  assert.equal(u.size, 2);
  assert.equal(u.get('ebin').role, 'admin');
});

test('blocks pages, scripts and data without a session', async () => {
  const res = await middleware(page('/calculator.html'));
  assert.equal(res.status, 401);
  assert.match(await res.text(), /Sign in to continue/);
  const js = await middleware(new Request(B + '/assets/js/data/plans.js'));
  assert.equal(js.status, 401);
  assert.ok(!passes(js));
});

test('lets the gate page assets through', async () => {
  assert.ok(passes(await middleware(new Request(B + '/assets/fonts/inter-var.woff2'))));
  assert.ok(passes(await middleware(new Request(B + '/assets/img/eutility-logo.png'))));
  assert.equal((await middleware(new Request(B + '/assets/img/og-image.jpg'))).status, 401);
});

test('wrong password is refused', async () => {
  const res = await login('kenneth', 'nope');
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
  const unknown = await login('nobody', 'viewer-pass-123');
  assert.equal(unknown.status, 401);
});

test('correct password signs in and returns to the page', async () => {
  const res = await login('Kenneth', 'viewer-pass-123', '/plans.html?kwh=500');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/plans.html?kwh=500');
  const c = res.headers.get('set-cookie');
  assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /SameSite=Lax/);
  const after = await middleware(page('/plans.html', { headers: { cookie: cookieFrom(res) } }));
  assert.ok(passes(after));
});

test('open redirects are not possible', async () => {
  for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
    const res = await login('kenneth', 'viewer-pass-123', next);
    assert.equal(res.headers.get('location'), '/');
  }
});

test('tampered or foreign cookies are rejected', async () => {
  const res = await login('kenneth', 'viewer-pass-123');
  const [name, value] = cookieFrom(res).split('=');
  const [payload, sig] = value.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'ebin', r: 'admin', exp: Date.now() + 1e9 })).toString('base64url');
  const r1 = await middleware(page('/', { headers: { cookie: `${name}=${forged}.${sig}` } }));
  assert.equal(r1.status, 401);
  process.env.GATE_SECRET = 'rotated';
  const r2 = await middleware(page('/', { headers: { cookie: `${name}=${payload}.${sig}` } }));
  assert.equal(r2.status, 401, 'changing GATE_SECRET signs everyone out');
  process.env.GATE_SECRET = 'test-secret';
});

test('admin page: admin only', async () => {
  const viewer = cookieFrom(await login('kenneth', 'viewer-pass-123'));
  const admin = cookieFrom(await login('ebin', 'admin-pass-456'));
  assert.equal((await middleware(page('/__gate/admin', { headers: { cookie: viewer } }))).status, 403);
  const ok = await middleware(page('/__gate/admin', { headers: { cookie: admin } }));
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /kenneth/);
});

test('removing an account ends its session', async () => {
  const viewer = cookieFrom(await login('kenneth', 'viewer-pass-123'));
  const saved = process.env.GATE_USERS;
  process.env.GATE_USERS = saved.split(',').filter((e) => !e.startsWith('kenneth:')).join(',');
  assert.equal((await middleware(page('/', { headers: { cookie: viewer } }))).status, 401);
  process.env.GATE_USERS = saved;
});

test('logout clears the cookie', async () => {
  const res = await middleware(page('/__gate/logout'));
  assert.equal(res.status, 303);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});

test('fails closed when not configured', async () => {
  const saved = process.env.GATE_SECRET;
  delete process.env.GATE_SECRET;
  const res = await middleware(page('/'));
  assert.equal(res.status, 503);
  assert.ok(!passes(res));
  process.env.GATE_SECRET = saved;
});
