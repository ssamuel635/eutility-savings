// Plans service — every screen asks for plans through here, never from the data file
// directly. Today it reads the generated price sheet (assets/js/data/plans.js);
// tomorrow `list()` can call an API or CRM without touching any page.

import { AVAILABLE_PLANS, getPlan, monthlyCost, rateLabel, contractLabel, TARIFF } from '../calc.js';
import { CONFIG } from '../config.js';

export const PLAN_TYPES = {
  all: { label: 'All plans', test: () => true },
  fixed: { label: 'Fixed price', test: (p) => p.pricingType === 'fixed' },
  nolock: { label: 'No lock-in', test: (p) => !p.contractMonths },
  green: { label: 'Green', test: (p) => p.category === 'Green' },
  tou: { label: 'Night saver', test: (p) => p.pricingType === 'tou' },
  dot: { label: 'Discount off tariff', test: (p) => p.pricingType === 'dot' },
  promo: { label: 'Has promotion', test: (p) => !!p.promo },
};

export const SORTS = {
  price: { label: 'Cheapest first', cmp: (a, b) => a.monthly - b.monthly },
  contract: { label: 'Shortest contract', cmp: (a, b) => (a.plan.contractMonths ?? 0) - (b.plan.contractMonths ?? 0) || a.monthly - b.monthly },
  retailer: { label: 'Retailer A–Z', cmp: (a, b) => a.plan.retailer.localeCompare(b.plan.retailer) },
};

/** Every plan, priced at the given usage, with display-ready fields. */
export function list({ kwh = CONFIG.defaultKwh, type = 'all', retailer = 'all', sort = 'price', offPeakShare = CONFIG.defaultOffPeakShare } = {}) {
  const typeTest = (PLAN_TYPES[type] || PLAN_TYPES.all).test;
  const rows = AVAILABLE_PLANS
    .filter((p) => p.pricingType !== 'regulated' && !p.referralOnly)
    .filter(typeTest)
    .filter((p) => retailer === 'all' || p.retailer === retailer)
    .map((p) => decorate(p, kwh, offPeakShare));
  return rows.sort((SORTS[sort] || SORTS.price).cmp);
}

export function retailers() {
  return [...new Set(AVAILABLE_PLANS.filter((p) => p.pricingType !== 'regulated').map((p) => p.retailer))].sort();
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
  if (plan.pricingType === 'tou') t.push('Cheaper at night');
  if (plan.pricingType === 'dot') t.push('Follows SP tariff');
  if (plan.pricingType === 'tiered') t.push('Tiered rates');
  if (plan.dailyCharge) t.push('Daily charge');
  if (plan.promo) t.push('Promotion');
  return t;
}

export { TARIFF };
