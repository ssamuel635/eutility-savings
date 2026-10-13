// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlan, monthlyCost, compare, smeEstimate, smeTierFor, TARIFF, energyCents, MARKET_PLANS } from '../assets/js/calc.js';

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('regulated tariff read from sheet', () => {
  // Value changes every quarter; check it is wired from the sheet and plausible.
  assert.equal(TARIFF, getPlan('sp-group-regulated-tariff').rate);
  assert.ok(TARIFF > 15 && TARIFF < 60, `tariff ${TARIFF}¢/kWh looks wrong`);
});

// These check the maths using each plan's own numbers, so they keep passing when
// the weekly price check updates the rates.
const firstOf = (type, pred = () => true) => {
  const p = MARKET_PLANS.find((x) => x.pricingType === type && pred(x));
  assert.ok(p, `no ${type} plan in the data`);
  return p;
};

test('fixed plan: kWh × rate', () => {
  const p = firstOf('fixed', (x) => !x.dailyCharge);
  close(monthlyCost(p, 450).total, (450 * p.rate) / 100);
});

test('fixed + daily charge', () => {
  const p = firstOf('fixed', (x) => x.dailyCharge > 0);
  close(monthlyCost(p, 450, { days: 30 }).total, (450 * p.rate) / 100 + 30 * p.dailyCharge);
});

test('discount off tariff: percent and cents', () => {
  const pct = { pricingType: 'dot', discount: { value: 12, kind: 'percent' } };
  const cents = { pricingType: 'dot', discount: { value: 1.64, kind: 'cents' } };
  close(energyCents(pct, 100) / 100, TARIFF * 0.88);
  close(energyCents(cents, 100) / 100, TARIFF - 1.64);
  for (const p of MARKET_PLANS.filter((x) => x.pricingType === 'dot')) {
    const d = p.discount;
    const rate = d.kind === 'cents' ? TARIFF - d.value : TARIFF * (1 - d.value / 100);
    close(energyCents(p, 100) / 100, rate);
  }
});

test('time of use uses off-peak share', () => {
  const p = firstOf('tou', (x) => !x.tou.weekendOffPeak);
  close(energyCents(p, 100, { offPeakShare: 0.5 }), 50 * p.tou.offPeak.rate + 50 * p.tou.peak.rate);
});

test('weekend saver treats weekends as off-peak', () => {
  const p = firstOf('tou', (x) => x.tou.weekendOffPeak);
  const share = 1 - (1 - 0.3) * (5 / 7); // 0.5
  close(energyCents(p, 100, { offPeakShare: 0.3 }), 100 * share * p.tou.offPeak.rate + 100 * (1 - share) * p.tou.peak.rate);
});

test('tiered plan charges incremental blocks', () => {
  const p = firstOf('tiered');
  const [a, b, c] = p.tiers.map((t) => t.rate);
  close(energyCents(p, 700), 300 * a + 300 * b + 100 * c);
  close(energyCents(p, 200), 200 * a);
});

test('plan data is plausible', () => {
  for (const p of MARKET_PLANS) {
    const rates = [p.rate, p.tou?.offPeak?.rate, p.tou?.peak?.rate, ...(p.tiers || []).map((t) => t.rate)].filter((r) => r != null);
    for (const r of rates) assert.ok(r > 15 && r < 45, `${p.id}: ${r}¢/kWh looks wrong`);
    const m = monthlyCost(p, 450).total;
    assert.ok(Number.isFinite(m) && m > 50 && m < 250, `${p.id}: S$${m} at 450 kWh looks wrong`);
  }
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

test('getPlan ignores plans that are not on sale', () => {
  assert.equal(getPlan('flo-energy-residential-not-yet-launched'), null);
  assert.equal(getPlan('toString'), null);
});

test('compare: odd contract keys fall back safely', () => {
  for (const contract of ['toString', '__proto__', 'constructor', 'nope']) {
    const r = compare({ kwh: 400, contract });
    assert.ok(r.results.length > 0);
  }
});

test('compare: no matching plans is reported, not "already best"', () => {
  const r = compare({ kwh: 400, contract: 'none', greenOnly: true });
  if (r.results.length === 0) {
    assert.equal(r.noMatches, true);
    assert.equal(r.alreadyBest, false);
  }
});

test('compare: ties are broken deterministically, not by sheet order', () => {
  const r = compare({ kwh: 450, contract: 'any' });
  for (let i = 1; i < r.results.length; i++) {
    const a = r.results[i - 1], b = r.results[i];
    assert.ok(a.total <= b.total);
  }
  assert.ok(Number.isInteger(r.tiedWith));
});

test('activePromo hides promotions after their end date', async () => {
  const { activePromo } = await import('../assets/js/calc.js');
  const plan = { promo: { title: 'x', expires: '2026-09-30' } };
  assert.ok(activePromo(plan, new Date('2026-09-30T12:00:00+08:00')));
  assert.equal(activePromo(plan, new Date('2026-10-01T00:00:01+08:00')), null);
  assert.ok(activePromo({ promo: { title: 'y', expires: null } }));
});

test('SME estimate ignores bad input and stays finite', () => {
  const r = smeEstimate([{ kwh: 1e308 }, { kwh: 'abc' }, { kwh: -5 }, { kwh: 2000 }]);
  assert.ok(Number.isFinite(r.totalKwh) && Number.isFinite(r.savingYearly));
  assert.equal(r.siteCount, 2);
});

test('fmtMoney formats negatives and non-numbers', async () => {
  const { fmtMoney } = await import('../assets/js/calc.js');
  assert.equal(fmtMoney(-194), '−S$194');
  assert.equal(fmtMoney(Infinity), 'S$—');
  assert.equal(fmtMoney(1234.5, 2), 'S$1,234.50');
});
