// Referral lucky draw: signed links, a fixed server-side result, the odds,
// and the bonus-draw counting the website shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../api/draw.mjs';
import { issueToken, readToken, outcome, prizes } from '../api/_draw-engine.mjs';
import { CONFIG } from '../assets/js/config.js';
import { bonusAt, drawsEarned, nextBonus } from '../assets/js/services/draws.js';

let ip = 0;
const req = (method, query = '', body) => new Request(`http://localhost/api/draw${query}`, {
  method,
  headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++ip % 250}` },
  body: body ? JSON.stringify(body) : undefined,
});
const call = async (method, query, body) => (await (method === 'GET' ? GET : POST)(req(method, query, body))).json();

test('a sample link draws once, and drawing again shows the same prize', async () => {
  const { token } = await call('GET', '?sample=friend');
  const before = await call('GET', `?t=${encodeURIComponent(token)}`);
  assert.equal(before.status, 'ready');
  assert.equal(before.kind, 'friend');
  assert.equal(before.sample, true);
  assert.equal(before.result, undefined, 'the result is never sent before the spin');
  const first = await call('POST', '', { t: token });
  const again = await call('POST', '', { t: token });
  assert.equal(first.status, 'drawn');
  assert.equal(again.already, true);
  assert.equal(again.result.label, first.result.label);
  assert.equal((await call('GET', `?t=${encodeURIComponent(token)}`)).status, 'drawn');
});

test('no token, a changed token or an old one shows no wheel', async () => {
  const { token } = await call('GET', '?sample=referrer');
  assert.equal((await call('GET', '')).status, 'invalid');
  assert.equal((await call('GET', `?t=${token.slice(0, -3)}abc`)).status, 'invalid');
  const old = await issueToken({ drawId: 'S-old0001', kind: 'bonus', sample: true, now: Date.now() - 40 * 864e5 });
  assert.equal((await readToken(old)).error, 'expired');
  const r = await POST(req('POST', '', { t: old }));
  assert.equal(r.status, 410);
});

test('live links are refused while draws run in sample mode', async () => {
  process.env.DRAW_SECRET = 'x'.repeat(40);
  const live = await issueToken({ drawId: 'L-abc12345', kind: 'referrer', sample: false });
  assert.equal((await readToken(live)).error, 'invalid');
  delete process.env.DRAW_SECRET;
});

test('prizes: every draw wins, odds add up, top prize at most 0.1%', async () => {
  const list = prizes();
  assert.equal(list.reduce((t, p) => t + p.weight, 0), 10000);
  assert.ok(list.find((p) => p.value === 500).weight <= 10);
  assert.ok(Math.min(...list.map((p) => p.value)) >= 5);
  assert.throws(() => prizes([{ value: 5, weight: 9980 }, { value: 500, weight: 20 }]), /0.1%/);
  const n = 20000;
  const seen = {};
  for (let i = 0; i < n; i++) {
    const { prize } = await outcome(`S-odds${i}`, true);
    seen[prize.value] = (seen[prize.value] || 0) + 1;
  }
  assert.ok(Math.abs(seen[5] / n - 0.95) < 0.01, `S$5 came up ${seen[5]} times`);
  assert.ok((seen[500] || 0) / n < 0.004);
});

test('bonus draws: +1 at 3 friends, +2 at 5, then +2 every 5 more', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 10, 15].map(bonusAt), [0, 0, 1, 0, 2, 0, 2, 2]);
  assert.equal(drawsEarned(0), 0);
  assert.equal(drawsEarned(2), 2);
  assert.equal(drawsEarned(3), 4);
  assert.equal(drawsEarned(5), 8);
  assert.equal(drawsEarned(10), 15);
  assert.deepEqual(nextBonus(0), { at: 3, extra: 1, toGo: 3 });
  assert.deepEqual(nextBonus(3), { at: 5, extra: 2, toGo: 2 });
  assert.deepEqual(nextBonus(5), { at: 10, extra: 2, toGo: 5 });
  assert.equal(CONFIG.rewards.friendSteps.length, 4);
});
