// Our picks: three plans worth a look from the featured retailers (CONFIG),
// priced for a typical home, each with its retailer's logo. Shared by the home
// page and tools/prerender.mjs, which writes the same cards into index.html so
// search engines and phones see them before any script runs.
import { fmtMoney } from '../calc.js';
import { CONFIG } from '../config.js';
import * as plans from '../services/plans-service.js';
import { retailerLogo } from './home-story.js';
import * as I from '../icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const featured = () => (CONFIG.featuredRetailers?.length ? CONFIG.featuredRetailers : null);

/** The three picks as [label, priced plan] pairs, no plan twice. */
export function picks(kwh = CONFIG.defaultKwh) {
  const only = featured();
  const pool = (opts = {}) => plans.list({ kwh, sort: 'price', ...opts }).filter((r) => !only || only.includes(r.plan.retailer));
  const cheapest = pool()[0];
  // the next longest when the cheapest is also the longest, so there are still three cards
  const longest = pool().filter((r) => r.plan.pricingType === 'fixed' && r.id !== cheapest?.id)
    .sort((a, b) => (b.plan.contractMonths ?? 0) - (a.plan.contractMonths ?? 0) || a.monthly - b.monthly)[0];
  const green = pool({ type: 'green' })[0];
  return [
    ['Lowest bill', cheapest],
    ['Longest fixed price', longest],
    ['Greener choice', green],
  ].filter(([, r], i, arr) => r && arr.findIndex(([, x]) => x?.id === r.id) === i);
}

/** The line under "Our picks for Singapore homes." */
export function picksLead(kwh = CONFIG.defaultKwh) {
  const only = featured();
  return `${only ? `Plans from ${only.join(' and ')}` : 'Picked from every plan we track'}, priced for a home using ${kwh} kWh a month. Check yours above to compare every plan for your own numbers.`;
}

export function picksMarkup(kwh = CONFIG.defaultKwh) {
  return picks(kwh).map(([label, r], i) => `
  <article class="pick-card reveal" style="--d:${i * 0.06}s">
    <span class="pick-card__ribbon">${esc(label)}</span>
    <div class="pick-card__logo">${retailerLogo(r.plan.retailer)}</div>
    <div class="pick-card__body">
      <p class="pick-card__retailer">${esc(r.plan.retailer)}</p>
      <p class="pick-card__name">${esc(r.plan.name)}</p>
      <p class="pick-card__rate">${esc(r.priceLabel.replace(/ \+ .*$/, ''))}<small>${esc(r.contract)}</small></p>
      <div class="pick-stats">
        <div><span>Est. monthly</span><strong>${fmtMoney(r.monthly)}</strong></div>
        <div><span>vs SP tariff</span><strong class="save">${r.savingVsTariffYearly > 0 ? `Save ${fmtMoney(r.savingVsTariffYearly)}/yr` : 'Similar'}</strong></div>
      </div>
    </div>
    <div class="pick-card__actions">
      <button class="btn btn--wa btn--block" type="button" data-wa data-wa-message="Hi Eutility, I'm interested in switching to ${esc(r.plan.retailer)} ${esc(r.plan.name)}. Can you check if it suits my usage?" aria-label="Switch to ${esc(r.plan.retailer)} ${esc(r.plan.name)} on WhatsApp">${I.chat}<span>Switch on WhatsApp</span></button>
      <a class="link-arrow" href="calculator.html?kwh=${kwh}&run=1">Compare for my usage</a>
    </div>
  </article>`).join('');
}
