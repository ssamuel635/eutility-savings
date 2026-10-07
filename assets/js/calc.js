// Pricing engine — pure functions, no DOM. Unit-tested in tests/calc.test.mjs.
// All rates are in cents/kWh (as in the price sheet); all outputs are in S$.

import { PLANS, META } from './data/plans.js';
import { CONFIG } from './config.js';

export const TARIFF = META.regulatedTariff; // ¢/kWh, SP Group regulated tariff
export const AVAILABLE_PLANS = PLANS.filter((p) => p.available);
export const DEFAULT_CURRENT_ID = 'sp-group-regulated-tariff';

export function getPlan(id) {
  return PLANS.find((p) => p.id === id) || null;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Effective share of usage billed at the off-peak rate for a ToU plan. */
export function offPeakShareFor(plan, nightShare) {
  if (!plan.tou) return 0;
  // Nights + weekends: all weekend usage (2/7 of daytime) is also off-peak.
  if (plan.tou.weekendOffPeak) return 1 - (1 - nightShare) * (5 / 7);
  return nightShare;
}

/** Energy charge in cents for a given monthly kWh. */
export function energyCents(plan, kwh, { tariff = TARIFF, offPeakShare = CONFIG.defaultOffPeakShare } = {}) {
  switch (plan.pricingType) {
    case 'fixed':
    case 'regulated':
      return kwh * plan.rate;
    case 'dot': {
      const d = plan.discount;
      const rate = d.kind === 'cents' ? tariff - d.value : tariff * (1 - d.value / 100);
      return kwh * rate;
    }
    case 'tou': {
      const share = offPeakShareFor(plan, offPeakShare);
      return kwh * share * plan.tou.offPeak.rate + kwh * (1 - share) * plan.tou.peak.rate;
    }
    case 'tiered': {
      // Incremental blocks: each band's rate applies only to the kWh inside that band.
      let cents = 0;
      for (const t of plan.tiers) {
        const lo = t.from ?? 0;
        const hi = t.to ?? Infinity;
        const inBand = Math.max(0, Math.min(kwh, hi) - lo);
        cents += inBand * t.rate;
      }
      return cents;
    }
    default:
      return NaN;
  }
}

/** Monthly bill estimate for one plan. */
export function monthlyCost(plan, kwh, opts = {}) {
  const days = opts.days ?? CONFIG.daysPerMonth;
  const energy = energyCents(plan, kwh, opts) / 100;
  const daily = (plan.dailyCharge || 0) * days;
  const total = energy + daily;
  return {
    energy: round2(energy),
    daily: round2(daily),
    total: round2(total),
    effectiveRate: kwh > 0 ? round2((total / kwh) * 100) : 0, // ¢/kWh incl. daily charge
  };
}

export const CONTRACT_FILTERS = {
  none: { label: 'No lock-in', test: (m) => !m },
  '12': { label: 'Up to 12 mths', test: (m) => (m ?? 0) <= 12 },
  '24': { label: 'Up to 24 mths', test: (m) => (m ?? 0) <= 24 },
  any: { label: 'Any length', test: () => true },
};

/**
 * Compare every available plan against the user's current plan.
 * @returns {{current, results, best, alreadyBest}}
 */
export function compare({
  kwh,
  currentId = DEFAULT_CURRENT_ID,
  contract = '24',
  greenOnly = false,
  includeReferralOnly = false,
  offPeakShare = CONFIG.defaultOffPeakShare,
}) {
  const opts = { offPeakShare };
  const currentPlan = getPlan(currentId) || getPlan(DEFAULT_CURRENT_ID);
  const current = { plan: currentPlan, ...monthlyCost(currentPlan, kwh, opts) };
  const filter = CONTRACT_FILTERS[contract] || CONTRACT_FILTERS.any;

  const results = AVAILABLE_PLANS
    .filter((p) => p.pricingType !== 'regulated')
    .filter((p) => filter.test(p.contractMonths))
    .filter((p) => !greenOnly || p.category === 'Green')
    .filter((p) => includeReferralOnly || !p.referralOnly)
    .map((p) => {
      const cost = monthlyCost(p, kwh, opts);
      const monthly = round2(current.total - cost.total);
      return { plan: p, ...cost, savingMonthly: monthly, savingYearly: round2(monthly * 12) };
    })
    .sort((a, b) => a.total - b.total || (a.plan.contractMonths ?? 0) - (b.plan.contractMonths ?? 0));

  const best = results.find((r) => r.plan.id !== currentPlan.id) || null;
  const alreadyBest = !best || best.savingMonthly <= 0.5;
  return { current, results, best, alreadyBest };
}

// ── SME aggregation ──────────────────────────────────────────

/** Best (lowest) ≤24-month fixed-rate plan in the sheet, excluding referral-only plans. */
export function smeBaseRate() {
  const fixed = AVAILABLE_PLANS.filter(
    (p) => p.pricingType === 'fixed' && !p.referralOnly && !p.dailyCharge && (p.contractMonths ?? 0) > 0 && p.contractMonths <= 24,
  );
  return Math.min(...fixed.map((p) => p.rate));
}

export function smeTierFor(totalKwh, tiers = CONFIG.smeTiers) {
  let tier = tiers[0];
  for (const t of tiers) if (totalKwh >= t.minKwh) tier = t;
  const idx = tiers.indexOf(tier);
  const next = tiers[idx + 1] || null;
  return { tier, next, toNext: next ? Math.max(0, next.minKwh - totalKwh) : 0 };
}

export function smeEstimate(sites, { tariff = TARIFF, tiers = CONFIG.smeTiers } = {}) {
  const valid = sites.filter((s) => Number(s.kwh) > 0);
  const totalKwh = valid.reduce((sum, s) => sum + Number(s.kwh), 0);
  const { tier, next, toNext } = smeTierFor(totalKwh, tiers);
  const base = smeBaseRate();
  const aggRate = round2(base * (1 - tier.discountPct / 100));
  const currentMonthly = (totalKwh * tariff) / 100;
  const newMonthly = (totalKwh * aggRate) / 100;
  const savingMonthly = round2(currentMonthly - newMonthly);
  return {
    siteCount: valid.length,
    totalKwh,
    tier,
    next,
    toNext,
    baseRate: base,
    aggRate,
    currentMonthly: round2(currentMonthly),
    newMonthly: round2(newMonthly),
    savingMonthly,
    savingYearly: round2(savingMonthly * 12),
  };
}

// ── Formatting helpers ───────────────────────────────────────
export const fmtMoney = (n, dp = 0) =>
  'S$' + Number(n).toLocaleString('en-SG', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtKwh = (n) => Number(n).toLocaleString('en-SG') + ' kWh';
export const contractLabel = (m) => (!m ? 'No contract' : `${m}-month contract`);

export function rateLabel(plan) {
  const base = baseRateLabel(plan);
  return plan.dailyCharge ? `${base} + $${plan.dailyCharge.toFixed(2)}/day` : base;
}

function baseRateLabel(plan) {
  switch (plan.pricingType) {
    case 'fixed':
    case 'regulated':
      return `${plan.rate.toFixed(2)}¢/kWh`;
    case 'dot':
      return plan.discount.kind === 'cents'
        ? `${plan.discount.value}¢ off tariff`
        : `${plan.discount.value}% off tariff`;
    case 'tou':
      return `${plan.tou.offPeak.rate}¢ off-peak · ${plan.tou.peak.rate}¢ peak`;
    case 'tiered':
      return plan.tiers.map((t) => `${t.rate}¢`).join(' / ') + ' (tiered)';
    default:
      return '—';
  }
}
