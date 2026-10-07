// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlan, monthlyCost, compare, smeEstimate, smeTierFor, TARIFF, energyCents } from '../assets/js/calc.js';

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('regulated tariff read from sheet', () => {
  assert.equal(TARIFF, 34.78);
});

test('fixed plan: kWh × rate', () => {
  const p = getPlan('geneco-get-it-fixed-24'); // 29.8¢
  close(monthlyCost(p, 450).total, 134.1);
});

test('fixed + daily charge', () => {
  const p = getPlan('pacificlight-easy-peasy'); // 26¢ + $0.55/day
  close(monthlyCost(p, 450, { days: 30 }).total, 117 + 16.5);
});

test('discount off tariff: percent and cents', () => {
  close(energyCents(getPlan('keppel-electric-suresave-dot'), 100) / 100, 34.78 * 0.88); // 12%
  close(energyCents(getPlan('pacificlight-classic-60'), 100) / 100, 34.78 - 8); // 8¢ off
});

test('time of use uses off-peak share', () => {
  const p = getPlan('senoko-energy-lifesavvy24'); // 20.05 off / 36.95 peak
  close(energyCents(p, 100, { offPeakShare: 0.5 }), 50 * 20.05 + 50 * 36.95);
});

test('weekend saver treats weekends as off-peak', () => {
  const p = getPlan('keppel-electric-weekend-saver');
  const share = 1 - (1 - 0.3) * (5 / 7); // 0.5
  close(energyCents(p, 100, { offPeakShare: 0.3 }), 100 * share * 27.9 + 100 * (1 - share) * 39.9);
});

test('tiered plan charges incremental blocks', () => {
  const p = getPlan('pacificlight-stack-it-up-24'); // 30 / 29.4 / 28
  close(energyCents(p, 700), 300 * 30 + 300 * 29.4 + 100 * 28);
  close(energyCents(p, 200), 200 * 30);
});

test('compare: sorted cheapest first, savings vs SP tariff', () => {
  const { current, results, best } = compare({ kwh: 450, contract: 'any' });
  assert.equal(current.plan.id, 'sp-group-regulated-tariff');
  for (let i = 1; i < results.length; i++) assert.ok(results[i].total >= results[i - 1].total);
  assert.ok(best.savingYearly > 0);
  close(best.savingYearly, best.savingMonthly * 12, 0.1);
});

test('compare: contract filter + referral-only excluded by default', () => {
  const { results } = compare({ kwh: 450, contract: '24' });
  assert.ok(results.every((r) => (r.plan.contractMonths ?? 0) <= 24));
  assert.ok(results.every((r) => !r.plan.referralOnly));
  const none = compare({ kwh: 450, contract: 'none' }).results;
  assert.ok(none.every((r) => !r.plan.contractMonths));
});

test('compare: user already on cheapest plan', () => {
  const { best } = compare({ kwh: 450, contract: '24' });
  const again = compare({ kwh: 450, contract: '24', currentId: best.plan.id });
  assert.ok(again.alreadyBest || again.best.savingMonthly <= 0.5);
});

test('SME tiers and aggregation', () => {
  assert.equal(smeTierFor(1500).tier.label, 'Starter');
  assert.equal(smeTierFor(12000).tier.label, 'Silver');
  const est = smeEstimate([{ name: 'A', kwh: 4200 }, { name: 'B', kwh: 2000 }, { name: 'C', kwh: '' }]);
  assert.equal(est.siteCount, 2);
  assert.equal(est.totalKwh, 6200);
  assert.equal(est.tier.label, 'Bronze');
  assert.ok(est.savingYearly > 0);
});
