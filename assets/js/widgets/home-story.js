// Savings by home type: a card per type of home with a real estimate, worked
// out from the price sheet, showing the switch itself (SP Group's tariff to the
// new retailer, by the kind of plan). These replace sample testimonials, so nothing
// on the site is a made-up quote. Real, permission-cleared customer stories
// can sit alongside these later.

import { compare, fmtMoney, RATES_DATE } from '../calc.js';
import { CONFIG } from '../config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * The kind of plan, as an icon and a name, where the retailer's logo used to
 * be (3 Nov 2026): Eutility has no rights to use retailers' logos. Green plans
 * show as Green Electricity whatever their pricing.
 */
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const PLAN_TYPES = {
  fixed: { name: 'Fixed Rate', icon: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>') },
  dot: { name: 'Discount off Tariff', icon: svg('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><path d="M8 8h.01" stroke-width="2.6"/><path d="M9.5 16.5l5-5"/>') },
  green: { name: 'Green Electricity', icon: svg('<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19c3-4 6-6.5 10-8.5"/>') },
  tou: { name: 'Time-Tiered', icon: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>') },
  tiered: { name: 'Usage-Tiered', icon: svg('<path d="M4 20h16M6 20v-5M12 20v-9M18 20V6"/>') },
  regulated: { name: 'SP Tariff', icon: svg('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>') },
};

export function planType(plan) {
  if (plan?.category === 'Green') return 'green';
  return PLAN_TYPES[plan?.pricingType] ? plan.pricingType : 'fixed';
}

/** A plan's type badge; pass a plan, or a key of PLAN_TYPES ('regulated' for SP Group's tariff). */
export function planBadge(planOrType) {
  const key = typeof planOrType === 'string' ? planOrType : planType(planOrType);
  const t = PLAN_TYPES[key];
  return `<span class="plan-badge plan-badge--${key}">${t.icon}<span>${esc(t.name)}</span></span>`;
}

export const HOME_NAMES = { 'HDB 3-room': '3-room HDB flat', 'HDB 4-room': '4-room HDB flat', 'HDB 5-room': '5-room HDB flat', Executive: 'Executive flat', Condo: 'Condo', Landed: 'Landed home' };
/** The same, mid-sentence ("A 3-room HDB flat using…"). */
export const IN_SENTENCE = { 'HDB 3-room': 'a 3-room HDB flat', 'HDB 4-room': 'a 4-room HDB flat', 'HDB 5-room': 'a 5-room HDB flat', Executive: 'an Executive flat', Condo: 'a condo', Landed: 'a landed home' };

/**
 * Each home type's own page ("Electricity plans for a 4-room HDB flat"),
 * written by tools/prerender.mjs from the price sheet. A new home preset needs
 * a page file too: copy one of these and add it here.
 */
export const HOME_PAGES = {
  'HDB 3-room': 'electricity-plans-hdb-3-room.html',
  'HDB 4-room': 'electricity-plans-hdb-4-room.html',
  'HDB 5-room': 'electricity-plans-hdb-5-room.html',
  Executive: 'electricity-plans-executive-flat.html',
  Condo: 'electricity-plans-condo.html',
  Landed: 'electricity-plans-landed-home.html',
};

/** Stories for the given home types (all of them by default). */
export function homeStories(labels = CONFIG.homePresets.map((p) => p.label)) {
  return labels.map((label) => {
    const preset = CONFIG.homePresets.find((p) => p.label === label);
    if (!preset) return null;
    const r = compare({ kwh: preset.kwh, contract: '24' });
    if (!r.best || r.alreadyBest) return null;
    return { label, kwh: preset.kwh, best: r.best };
  }).filter(Boolean);
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function storyCard(s, i = 0) {
  const home = HOME_NAMES[s.label] || s.label;
  const to = s.best.plan.retailer;
  return `
  <article class="story-card reveal" style="--d:${i * 0.06}s">
    <div class="story-card__switch">
      ${HOME_PAGES[s.label] ? `<a class="story-card__home" href="${HOME_PAGES[s.label]}">${esc(home)}</a>` : `<span class="story-card__home">${esc(home)}</span>`}
      <div class="switch-logos" role="img" aria-label="${esc(`From SP Group to ${to}`)}">
        <span class="switch-logos__from" aria-hidden="true"><small>From</small>${planBadge('regulated')}</span>
        <span class="switch-logos__arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        <span class="switch-logos__to" aria-hidden="true"><small>To</small>${planBadge(s.best.plan)}</span>
      </div>
    </div>
    <div class="story-card__body">
      <p class="story-card__save">${fmtMoney(s.best.savingYearly)}<small> a year</small></p>
      <p class="story-card__how">${esc(cap(IN_SENTENCE[s.label] || home))} using about ${s.kwh} kWh a month, moving from SP Group’s tariff to ${esc(to)} ${esc(s.best.plan.name)}.</p>
      <p class="story-card__note">Example estimate, retailer rates as at ${esc(RATES_DATE)}.</p>
      <a class="link-arrow" href="calculator.html?kwh=${s.kwh}&run=1">Check your own home</a>
    </div>
  </article>`;
}
