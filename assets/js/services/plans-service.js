// Plans service — every screen asks for plans through here, never from the data file
// directly. Today it reads the generated price sheet (assets/js/data/plans.js);
// tomorrow `list()` can call an API or CRM without touching any page.

import { MARKET_PLANS, getPlan, monthlyCost, rateLabel, contractLabel, activePromo, TARIFF, TARIFF_PERIOD } from '../calc.js';
import { CONFIG } from '../config.js';

export const PLAN_TYPES = {
  all: { label: 'All plans', test: () => true },
  fixed: { label: 'Fixed price', test: (p) => p.pricingType === 'fixed' },
  nolock: { label: 'No lock-in', test: (p) => !p.contractMonths },
  green: { label: 'Green', test: (p) => p.category === 'Green' },
  tou: { label: 'Time-of-use', test: (p) => p.pricingType === 'tou' },
  dot: { label: 'Discount off tariff', test: (p) => p.pricingType === 'dot' },
  promo: { label: 'With promotion', test: (p) => !!activePromo(p) },
};

export const SORTS = {
  price: { label: 'Lowest estimate first', cmp: (a, b) => a.monthly - b.monthly || a.plan.retailer.localeCompare(b.plan.retailer) || a.plan.name.localeCompare(b.plan.name) },
  contract: { label: 'Shortest contract', cmp: (a, b) => (a.plan.contractMonths ?? 0) - (b.plan.contractMonths ?? 0) || a.monthly - b.monthly },
  retailer: { label: 'Retailer A–Z', cmp: (a, b) => a.plan.retailer.localeCompare(b.plan.retailer) || a.monthly - b.monthly },
};

/** Every plan, priced at the given usage, with display-ready fields. */
export function list({ kwh = CONFIG.defaultKwh, type = 'all', retailer = 'all', sort = 'price', offPeakShare = CONFIG.defaultOffPeakShare } = {}) {
  const typeTest = (Object.hasOwn(PLAN_TYPES, type) ? PLAN_TYPES[type] : PLAN_TYPES.all).test;
  const rows = MARKET_PLANS
    .filter(typeTest)
    .filter((p) => retailer === 'all' || p.retailer === retailer)
    .map((p) => decorate(p, kwh, offPeakShare));
  return rows.sort((Object.hasOwn(SORTS, sort) ? SORTS[sort] : SORTS.price).cmp);
}

export function retailers() {
  return [...new Set(MARKET_PLANS.map((p) => p.retailer))].sort();
}

/** One plan, priced and decorated (used by the plan detail view). */
export function detail(id, { kwh = CONFIG.defaultKwh, offPeakShare = CONFIG.defaultOffPeakShare } = {}) {
  const p = getPlan(id);
  return p ? decorate(p, kwh, offPeakShare) : null;
}

export function tariffBill(kwh) {
  return monthlyCost(getPlan('sp-group-regulated-tariff'), kwh).total;
}

function decorate(plan, kwh, offPeakShare) {
  const cost = monthlyCost(plan, kwh, { offPeakShare });
  const vsTariff = tariffBill(kwh) - cost.total;
  return {
    plan,
    id: plan.id,
    monthly: cost.total,
    effectiveRate: cost.effectiveRate,
    savingVsTariffYearly: Math.round(vsTariff * 12),
    priceLabel: rateLabel(plan),
    contract: contractLabel(plan.contractMonths),
    tags: tagsFor(plan),
  };
}

function tagsFor(plan) {
  const t = [];
  if (plan.category === 'Green') t.push('Green');
  if (!plan.contractMonths) t.push('No lock-in');
  if (plan.pricingType === 'tou') t.push(plan.tou?.weekendOffPeak ? 'Cheaper at weekends' : 'Cheaper off-peak');
  if (plan.pricingType === 'dot') t.push('Follows SP tariff');
  if (plan.pricingType === 'tiered') t.push('Tiered rates');
  if (plan.dailyCharge) t.push('Daily charge');
  if (activePromo(plan)) t.push('Promotion');
  return t;
}

export { TARIFF, TARIFF_PERIOD };
