// Savings by home type: a card per type of home with a real estimate, worked
// out from the price sheet, showing the switch itself (SP Group's tariff to the
// new retailer, by their logos). These replace sample testimonials, so nothing
// on the site is a made-up quote. Real, permission-cleared customer stories
// can sit alongside these later.

import { compare, fmtMoney, RATES_DATE } from '../calc.js';
import { CONFIG } from '../config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Official logos, from each retailer's own website or supplied by Eutility
 * (Oct 2026), in assets/img/retailers/. A retailer without a file here shows
 * its name instead.
 */
const LOGOS = {
  'SP Group': 'sp-group.svg',
  Geneco: 'geneco.svg',
  'Keppel Electric': 'keppel-electric.svg',
  PacificLight: 'pacificlight.png',
  'Sembcorp Power': 'sembcorp-power.png',
  'Senoko Energy': 'senoko-energy.png',
  'Tuas Power': 'tuas-power.png',
  'Flo Energy': 'flo-energy.png',
};

export function retailerLogo(name) {
  const file = LOGOS[name];
  return file
    ? `<img class="retailer-logo" src="assets/img/retailers/${file}" alt="${esc(name)}" loading="lazy" decoding="async">`
    : `<span class="retailer-logo retailer-logo--text">${esc(name)}</span>`;
}

const HOME_NAMES = { 'HDB 3-room': '3-room HDB flat', 'HDB 4-room': '4-room HDB flat', 'HDB 5-room': '5-room HDB flat', Executive: 'Executive flat', Condo: 'Condo', Landed: 'Landed home' };
/** The same, mid-sentence ("A 3-room HDB flat using…"). */
const IN_SENTENCE = { 'HDB 3-room': 'a 3-room HDB flat', 'HDB 4-room': 'a 4-room HDB flat', 'HDB 5-room': 'a 5-room HDB flat', Executive: 'an Executive flat', Condo: 'a condo', Landed: 'a landed home' };

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
      <span class="story-card__home">${esc(home)}</span>
      <div class="switch-logos" role="img" aria-label="${esc(`From SP Group to ${to}`)}">
        <span class="switch-logos__from" aria-hidden="true"><small>From</small>${retailerLogo('SP Group')}</span>
        <span class="switch-logos__arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        <span class="switch-logos__to" aria-hidden="true"><small>To</small>${retailerLogo(to)}</span>
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
