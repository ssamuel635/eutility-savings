import { initLayout, observeReveals, photoFallbacks } from '../layout.js';
import { mountResidential } from '../widgets/residential.js';
import { homeStories, storyCard, retailerLogo } from '../widgets/home-story.js';
import { MARKET_PLANS, CONTRACT_FILTERS, compare, fmtMoney, rateLabel, PLAN_COUNT, RETAILER_COUNT, TARIFF, TARIFF_PERIOD } from '../calc.js';
import { CONFIG } from '../config.js';
import { photo } from '../data/photos.js';
import { TESTIMONIALS, quoteCard } from '../data/testimonials.js';
import * as rewards from '../services/rewards.js';
import * as plans from '../services/plans-service.js';
import * as I from '../icons.js';
import { playChat } from '../widgets/wa-chat.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

initLayout();

// Hero calculator, homes only; businesses get a link to a consultant above it
mountResidential(document.getElementById('home-calc'), { mode: 'compact', bare: true });

document.querySelector('[data-plan-count]').textContent = `${PLAN_COUNT} plans compared`;

// Hero: our best fixed rate against the regulated tariff, straight from the price sheet
// Lowest fixed rate on sale (no daily charge, so the figure is the whole price),
// for contracts of up to 24 months: the calculator's default, so the headline
// rate is one the calculator can actually recommend.
const upTo24 = CONTRACT_FILTERS['24'].test;
const best = Math.min(...MARKET_PLANS.filter((p) => p.pricingType === 'fixed' && !p.dailyCharge && upTo24(p.contractMonths)).map((p) => p.rate));
document.getElementById('rate-vs').innerHTML = `
  <div class="rate-vs__item"><span class="rate-vs__num">${best.toFixed(2)}<small>¢/kWh</small></span><span class="rate-vs__label">Fixed plans up to 24 months, from</span></div>
  <span class="rate-vs__vs">vs</span>
  <div class="rate-vs__item rate-vs__item--tariff"><span class="rate-vs__num">${TARIFF.toFixed(2)}<small>¢/kWh</small></span><span class="rate-vs__label">SP Group tariff, ${esc(TARIFF_PERIOD)}</span></div>`;

// What Eutility does: a photo beside a short list
document.getElementById('why-photo').innerHTML = photo('dinner', { sizes: '(min-width: 1024px) 50vw, 100vw' });
const VALUE = [
  { icon: 'compare', title: 'Every plan, side by side', text: `${PLAN_COUNT} home plans from ${RETAILER_COUNT} retailers, priced for your usage.`, href: 'calculator.html', link: 'Check my savings' },
  { icon: 'shield', title: 'Independent, not a retailer', text: 'We have no plan of our own to sell. If yours already wins, we say so.', href: 'about.html', link: 'About Eutility' },
  { icon: 'chat', title: 'We do the switching', text: 'Send your bill on WhatsApp. We confirm the plan with you and sign you up.', href: 'how-it-works.html', link: 'How it works' },
  { icon: 'bolt', title: 'Running a business?', text: 'Message or call us and a consultant quotes your sites.', href: 'calculator.html#sme', link: 'For businesses' },
];
document.getElementById('why-list').innerHTML = VALUE.map((v) => `
  <li>${I[v.icon]}<strong>${v.title}</strong><p>${v.text}</p><a class="link-arrow" href="${v.href}">${v.link}</a></li>`).join('');

// Hero photo: behind the top of the page on desktop, above the headline on phones
document.getElementById('hero-photo').innerHTML = photo('sofa', { eager: true, sizes: '(min-width: 1024px) 62vw, 100vw' });

// Our picks: three plans worth a look from the featured retailers (CONFIG),
// priced for a typical home, each with its retailer's logo
const kwh = CONFIG.defaultKwh;
const featured = CONFIG.featuredRetailers?.length ? CONFIG.featuredRetailers : null;
const pool = (opts = {}) => plans.list({ kwh, sort: 'price', ...opts }).filter((r) => !featured || featured.includes(r.plan.retailer));
const cheapest = pool()[0];
const longest = pool().filter((r) => r.plan.pricingType === 'fixed')
  .sort((a, b) => (b.plan.contractMonths ?? 0) - (a.plan.contractMonths ?? 0) || a.monthly - b.monthly)[0];
const green = pool({ type: 'green' })[0];
const picks = [
  ['Lowest bill', cheapest],
  ['Longest fixed price', longest],
  ['Greener choice', green],
].filter(([, r], i, arr) => r && arr.findIndex(([, x]) => x?.id === r.id) === i);
document.getElementById('plan-teaser').innerHTML = picks.map(([label, r], i) => `
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
const tip = document.querySelector('#plan-teaser')?.closest('section')?.querySelector('.section-head .lead');
if (tip) tip.textContent = `${featured ? `Plans from ${featured.join(' and ')}` : 'Picked from every plan we track'}, priced for a home using ${kwh} kWh a month. Check yours above to compare every plan for your own numbers.`;

// What switching could save: real estimates for typical homes
document.getElementById('home-testimonials').innerHTML = homeStories(['HDB 3-room', 'HDB 5-room', 'Condo']).map(storyCard).join('');

// Testimonials: three home customers' quotes; the section stays hidden until there are any
const quotes = document.getElementById('home-quotes');
if (TESTIMONIALS.length) {
  quotes.innerHTML = TESTIMONIALS.slice(0, 3).map(quoteCard).join('');
  quotes.closest('section').hidden = false;
}

// Rewards teaser: four things points can buy
document.getElementById('home-rewards').innerHTML = rewards.catalogue().filter((r) => ['air-fryer', 'rice-cooker', 'ps5', 'robot-vacuum'].includes(r.id)).map((r) => `
  <figure class="reward-mini"><img src="${r.src}" alt="" loading="lazy" decoding="async" width="600" height="600"><figcaption>${esc(r.name)}<span>${rewards.fmtPts(r.points)}</span></figcaption></figure>`).join('');

// Three simple steps: the WhatsApp assistant's chat, drawn like How it works,
// with the report worked out live for a home using the default usage. The
// three chats play one after another as they scroll into view.
const steps = document.getElementById('home-steps');
const report = compare({ kwh, contract: '24' }).best;
const twoDp = (n) => Number(Math.max(0, n)).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
steps.querySelectorAll('[data-logo]').forEach((e) => { e.innerHTML = '<img src="assets/img/eutility-symbol.png" alt="" width="22" height="22">'; });
steps.querySelector('[data-current]').textContent = `SP Group @ ${TARIFF}¢/kWh`;
if (report) {
  steps.querySelector('[data-recommended]').textContent = `${report.plan.retailer} @ ${rateLabel(report.plan)}`;
  steps.querySelector('[data-monthly]').textContent = twoDp(report.savingMonthly);
  steps.querySelector('[data-yearly]').textContent = twoDp(report.savingYearly);
  steps.querySelector('[data-retailer]').textContent = report.plan.retailer;
  steps.querySelector('[data-report-label]').setAttribute('aria-label', `Example WhatsApp chat: your savings report. Recommended: ${report.plan.retailer} at ${rateLabel(report.plan)}. You save ${fmtMoney(report.savingYearly)} a year.`);
}
steps.parentElement.querySelector('[data-example]').textContent = `Example: a home using ${kwh} kWh a month, on today’s published rates.`;
// Each chat waits for the one before it and for itself to be on screen (side
// by side on a laptop, one under another on a phone). A chat coming into view
// also releases the ones above it, for someone who jumps past them.
const chats = [...steps.querySelectorAll('.step__chat')];
const seen = chats.map(() => { let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; });
chats.forEach((chat, i) => chat.addEventListener('inview', () => seen.slice(0, i + 1).forEach((s) => s.resolve()), { once: true }));
chats.reduce((previous, chat, i) => previous.then(() => seen[i].p).then(() => playChat(chat)), Promise.resolve());

// Photos in the lower sections (account, the closing band)
document.querySelectorAll('[data-photo-slot]').forEach((el) => { el.innerHTML = photo(el.dataset.photoSlot, { sizes: '(min-width: 1024px) 33vw, 100vw' }); });

// Retailer marquee (names only; duplicated once for a seamless loop — the copy is
// hidden from screen readers, and from everyone when motion is reduced).
const names = [...new Set(MARKET_PLANS.map((p) => p.retailer))].sort();
const item = (n) => `<span class="marquee__item">${esc(n)}</span>`;
document.getElementById('marquee').innerHTML =
  names.map(item).join('') + `<span class="marquee__dup" aria-hidden="true">${names.map(item).join('')}</span>`;

photoFallbacks();
observeReveals();
