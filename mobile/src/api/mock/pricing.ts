// Plans and savings, served from the website's pricing engine. This is the
// stand-in for FXMedia requests #1 (plan data) and #2 (savings calculation).

import {
  AVAILABLE_PLANS, DEFAULT_CURRENT_ID, RATES_DATE, TARIFF, TARIFF_PERIOD,
  activePromo, compare, contractLabel, getPlan, rateLabel,
  type CompareRow, type SheetPlan,
} from '@/engine';
import type { Plan, PlanCatalogue, PricedPlan, QuoteInput, SavingsQuote } from '../types';
import { nowISO, uid } from './db';

export function toPlan(p: SheetPlan): Plan {
  const promo = activePromo(p);
  const tags: string[] = [];
  if (p.category === 'Green') tags.push('Green');
  if (!p.contractMonths && p.pricingType !== 'regulated') tags.push('No lock-in');
  if (p.pricingType === 'tou') tags.push(p.tou?.weekendOffPeak ? 'Cheaper at weekends' : 'Cheaper off-peak');
  if (p.pricingType === 'dot') tags.push('Follows SP tariff');
  if (p.pricingType === 'tiered') tags.push('Tiered rates');
  if (p.dailyCharge) tags.push('Daily charge');
  if (promo) tags.push('Promotion');
  return {
    id: p.id,
    retailer: p.retailer,
    name: p.name,
    green: p.category === 'Green',
    regulated: p.pricingType === 'regulated',
    contractMonths: p.contractMonths,
    contractLabel: p.pricingType === 'regulated' ? 'No contract' : contractLabel(p.contractMonths),
    priceLabel: rateLabel(p),
    deposit: p.deposit,
    earlyTermination: p.etf,
    promo: promo ? { title: promo.title, value: promo.value, conditions: promo.conditions, code: promo.code, expires: promo.expires } : null,
    tags,
  };
}

export function catalogue(): PlanCatalogue {
  const plans = AVAILABLE_PLANS
    .filter((p) => !p.referralOnly)
    .map(toPlan)
    // Regulated tariff first (most people's starting point), then by retailer.
    .sort((a, b) => Number(b.regulated) - Number(a.regulated) || a.retailer.localeCompare(b.retailer) || a.name.localeCompare(b.name));
  return { plans, ratesAsAt: RATES_DATE, tariffPeriod: TARIFF_PERIOD, regulatedTariff: TARIFF };
}

export function planById(id: string | null | undefined): Plan | null {
  const p = id ? getPlan(id) : null;
  return p ? toPlan(p) : null;
}

const priced = (r: CompareRow): PricedPlan => ({
  plan: toPlan(r.plan),
  monthly: r.total,
  savingMonthly: r.savingMonthly,
  savingYearly: r.savingYearly,
});

export function quote(input: QuoteInput): SavingsQuote {
  const currentId = getPlan(input.currentPlanId) ? input.currentPlanId : DEFAULT_CURRENT_ID;
  const r = compare({ kwh: input.kwh, currentId, contract: input.contract, greenOnly: input.greenOnly });
  const others = r.results.filter((x) => x.plan.id !== currentId);
  return {
    id: 'Q-' + uid(6),
    at: nowISO(),
    input: { ...input, currentPlanId: currentId },
    current: { plan: toPlan(r.current.plan), monthly: r.current.total },
    recommended: r.best && !r.alreadyBest ? priced(r.best) : null,
    alternatives: others.filter((x) => x !== r.best).slice(0, 5).map(priced),
    alreadyBest: r.alreadyBest,
    ratesAsAt: RATES_DATE,
  };
}
