import { initLayout, observeReveals, pauseBarAction, resumeBarAction, photoFallbacks } from '../layout.js';
import { mountResidential } from '../widgets/residential.js';
import { homeStories, storyCard } from '../widgets/home-story.js';
import { MARKET_PLANS, fmtMoney, PLAN_COUNT, RETAILER_COUNT, TARIFF, TARIFF_PERIOD } from '../calc.js';
import { CONFIG } from '../config.js';
import { photo } from '../data/photos.js';
import { TESTIMONIALS, quoteCard } from '../data/testimonials.js';
import * as rewards from '../services/rewards.js';
import * as plans from '../services/plans-service.js';
import * as I from '../icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

initLayout();

// Hero calculator (Residential) and the SME switch
mountResidential(document.getElementById('home-calc'), { mode: 'compact', bare: true });
document.querySelectorAll('input[name="home-mode"]').forEach((r) => r.addEventListener('change', () => {
  const sme = r.value === 'sme' && r.checked;
  const show = document.getElementById(sme ? 'home-sme' : 'home-calc');
  document.getElementById('home-calc').hidden = sme;
  document.getElementById('home-sme').hidden = !sme;
  show.classList.remove('panel-in'); void show.offsetWidth; show.classList.add('panel-in');
  if (sme) pauseBarAction(); else resumeBarAction();
}));

document.querySelector('[data-plan-count]').textContent = `${PLAN_COUNT} plans compared`;

// Hero: our best fixed rate against the regulated tariff, straight from the price sheet
// Lowest fixed rate on sale (no daily charge, so the figure is the whole price)
const best = Math.min(...MARKET_PLANS.filter((p) => p.pricingType === 'fixed' && !p.dailyCharge).map((p) => p.rate));
document.getElementById('rate-vs').innerHTML = `
  <div class="rate-vs__item"><span class="rate-vs__num">${best.toFixed(2)}<small>¢/kWh</small></span><span class="rate-vs__label">Fixed plans from</span></div>
  <span class="rate-vs__vs">vs</span>
  <div class="rate-vs__item rate-vs__item--tariff"><span class="rate-vs__num">${TARIFF.toFixed(2)}<small>¢/kWh</small></span><span class="rate-vs__label">SP Group tariff, ${esc(TARIFF_PERIOD)}</span></div>`;

// What Eutility does: a photo beside a short list
document.getElementById('why-photo').innerHTML = photo('dinner', { sizes: '(min-width: 1024px) 50vw, 100vw' });
const VALUE = [
  { icon: 'compare', title: 'Every plan, side by side', text: `${PLAN_COUNT} home plans from ${RETAILER_COUNT} retailers, priced for your usage.`, href: 'plans.html', link: 'Explore plans' },
  { icon: 'shield', title: 'Independent, not a retailer', text: 'We have no plan of our own to sell. If yours already wins, we say so.', href: 'about.html', link: 'About Eutility' },
  { icon: 'chat', title: 'We do the switching', text: 'Send your bill on WhatsApp. We confirm the plan with you and sign you up.', href: 'how-it-works.html', link: 'How it works' },
  { icon: 'bolt', title: 'Running a business?', text: 'Add your sites and we ask retailers for one aggregated rate.', href: 'calculator.html#sme', link: 'For businesses' },
];
document.getElementById('why-list').innerHTML = VALUE.map((v) => `
  <li>${I[v.icon]}<strong>${v.title}</strong><p>${v.text}</p><a class="link-arrow" href="${v.href}">${v.link}</a></li>`).join('');

// Hero photo: behind the top of the page on desktop, above the headline on phones
document.getElementById('hero-photo').innerHTML = photo('sofa', { eager: true, sizes: '(min-width: 1024px) 62vw, 100vw' });

// Our picks: three plans worth a look, priced for a typical home, each with a photo
const kwh = CONFIG.defaultKwh;
const cheapest = plans.list({ kwh, sort: 'price' })[0];
const noLock = plans.list({ kwh, type: 'nolock', sort: 'price' })[0];
const green = plans.list({ kwh, type: 'green', sort: 'price' })[0];
const picks = [
  ['Lowest bill', cheapest, 'livingRoom'],
  ['No lock-in', noLock, 'motherChild'],
  ['Greener choice', green, 'kites'],
].filter(([, r], i, arr) => r && arr.findIndex(([, x]) => x?.id === r.id) === i);
document.getElementById('plan-teaser').innerHTML = picks.map(([label, r, img], i) => `
  <article class="pick-card reveal" style="--d:${i * 0.06}s">
    <span class="pick-card__ribbon">${esc(label)}</span>
    <div class="photo-frame">${photo(img, { sizes: '(min-width: 720px) 33vw, 100vw' })}</div>
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
      <button class="btn btn--block" type="button" data-wa data-wa-message="Hi Eutility, I'm interested in switching to ${esc(r.plan.retailer)} ${esc(r.plan.name)}. Can you check if it suits my usage?" aria-label="Switch to ${esc(r.plan.retailer)} ${esc(r.plan.name)}">Switch with Eutility</button>
      <a class="link-arrow" href="plans.html?plan=${encodeURIComponent(r.id)}" aria-label="Plan details: ${esc(r.plan.retailer)} ${esc(r.plan.name)}">Plan details</a>
    </div>
  </article>`).join('');
const tip = document.querySelector('#plan-teaser')?.closest('section')?.querySelector('.section-head .lead');
if (tip) tip.textContent = `Picked from every plan we track, priced for a home using ${kwh} kWh a month. Check yours above for your own numbers.`;

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

// Photos in the lower sections (steps, account, the closing band)
document.querySelectorAll('[data-photo-slot]').forEach((el) => { el.innerHTML = photo(el.dataset.photoSlot, { sizes: '(min-width: 1024px) 33vw, 100vw' }); });

// Retailer marquee (names only; duplicated once for a seamless loop — the copy is
// hidden from screen readers, and from everyone when motion is reduced).
const names = [...new Set(MARKET_PLANS.map((p) => p.retailer))].sort();
const item = (n) => `<span class="marquee__item">${esc(n)}</span>`;
document.getElementById('marquee').innerHTML =
  names.map(item).join('') + `<span class="marquee__dup" aria-hidden="true">${names.map(item).join('')}</span>`;

photoFallbacks();
observeReveals();
