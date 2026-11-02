// boot.js: a page whose modules never start reloads once, by itself (Kenneth's
// iPhone, 29 Oct 2026). Runs the real file against a stand-in browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(new URL('../assets/js/boot.js', import.meta.url), 'utf8');

function browser({ started = false, gate = 401, offline = false, storage = new Map(), noStorage = false } = {}) {
  const classes = new Set(started ? [] : ['no-js']);
  const listeners = {};
  const timers = [];
  const b = {
    reloads: 0, fetched: [], storage,
    fire: (type, e = {}) => (listeners[type] || []).forEach((f) => f(e)),
    runTimers: () => timers.splice(0).forEach((f) => f()),
    start: () => classes.delete('no-js'),
  };
  const sessionStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  const ctx = {
    document: { documentElement: { classList: { contains: (c) => classes.has(c) } } },
    location: { pathname: '/calculator.html', reload: () => { b.reloads++; } },
    addEventListener: (t, f) => (listeners[t] ||= []).push(f),
    setTimeout: (f) => timers.push(f),
    fetch: (url) => { b.fetched.push(url); return offline ? Promise.reject(new TypeError('offline')) : Promise.resolve({ status: gate }); },
  };
  Object.defineProperty(ctx, 'sessionStorage', { get() { if (noStorage) throw new Error('blocked'); return sessionStorage; } });
  ctx.window = ctx;
  vm.runInNewContext(SRC, ctx);
  return b;
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('a page that started normally is left alone', async () => {
  const b = browser({ started: true });
  b.fire('load'); b.runTimers(); await settle();
  assert.equal(b.reloads, 0);
  assert.equal(b.fetched.length, 0);
});

test('lapsed sign-in: the page reloads, which shows the sign-in form', async () => {
  const b = browser({ gate: 401 });
  b.fire('load'); b.runTimers(); await settle();
  assert.deepEqual(b.fetched, ['/__gate/status']);
  assert.equal(b.reloads, 1);
});

test('a module that fails to download reloads straight away, without waiting', async () => {
  const b = browser({ gate: 204 });
  b.fire('error', { target: { tagName: 'SCRIPT', type: 'module' } }); await settle();
  assert.equal(b.reloads, 1);
  b.fire('load'); b.runTimers(); await settle();
  assert.equal(b.reloads, 1, 'only one check per page view');
});

test('never more than one automatic reload: a second failure leaves the refresh note', async () => {
  const storage = new Map();
  const first = browser({ gate: 204, storage });
  first.fire('load'); first.runTimers(); await settle();
  assert.equal(first.reloads, 1);
  const second = browser({ gate: 204, storage }); // the reloaded page failed too
  second.fire('load'); second.runTimers(); await settle();
  assert.equal(second.reloads, 0);
});

test('once the page works again, a later failure may reload again', async () => {
  const storage = new Map();
  const failed = browser({ gate: 204, storage });
  failed.fire('load'); failed.runTimers(); await settle();
  const ok = browser({ gate: 204, storage }); ok.start(); ok.fire('load');
  assert.equal(storage.size, 0);
});

test('offline, or storage blocked: no reload (it could loop)', async () => {
  const off = browser({ offline: true });
  off.fire('load'); off.runTimers(); await settle();
  assert.equal(off.reloads, 0);
  const blocked = browser({ noStorage: true });
  blocked.fire('load'); blocked.runTimers(); await settle();
  assert.equal(blocked.reloads, 0);
});
