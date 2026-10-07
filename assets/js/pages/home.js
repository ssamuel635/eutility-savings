import { initLayout, observeReveals, pauseBarAction, resumeBarAction } from '../layout.js';
import { mountResidential } from '../widgets/residential.js';
import { testimonialCard } from '../widgets/testimonial.js';
import { TESTIMONIALS } from '../data/testimonials.js';
import { MARKET_PLANS, fmtMoney, PLAN_COUNT, RETAILER_COUNT } from '../calc.js';
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

// What Eutility does
const VALUE = [
  { icon: 'compare', title: 'Compare the market', text: `${PLAN_COUNT} home plans from ${RETAILER_COUNT} retailers, priced for your usage and laid side by side, the way we compare offers for our business clients.`, href: 'plans.html', link: 'Explore plans' },
  { icon: 'shield', title: 'Independent advice', text: 'We don’t supply energy, so we have no plan of our own to sell. If yours already wins, we say so.', href: 'about.html', link: 'About Eutility' },
  { icon: 'bolt', title: 'Running a business?', text: 'Add your sites and we’ll ask retailers for one aggregated rate. We cover telecoms, bill checks and carbon reporting too.', href: 'calculator.html#sme', link: 'For businesses' },
  { icon: 'gift', title: 'Refer a friend', text: 'Share your link. When a friend switches, it counts towards your reward. Terms apply.', href: 'referrals.html', link: 'Eutility Rewards' },
];
document.getElementById('value-grid').innerHTML = VALUE.map((v, i) => `
  <div class="reward reveal" style="--d:${i * 0.06}s">
    <span class="reward__icon" style="background:var(--blue-tint);color:var(--blue)">${I[v.icon]}</span>
    <h3 class="h4">${v.title}</h3>
    <p class="small">${v.text}</p>
    <a class="link-arrow" href="${v.href}" style="font-size:14px">${v.link}</a>
  </div>`).join('');

// Three plans worth a look, straight from the price sheet
const cheapest = plans.list({ sort: 'price' })[0];
const noLock = plans.list({ type: 'nolock', sort: 'price' })[0];
const green = plans.list({ type: 'green', sort: 'price' })[0];
document.getElementById('plan-teaser').innerHTML = [
  ['Lowest estimated bill', cheapest],
  ['No lock-in', noLock],
  ['Green energy', green],
].filter(([, r]) => r).map(([label, r], i) => `
  <article class="plan-card reveal" style="--d:${i * 0.06}s">
    <div class="plan-card__top">
      <div>
        <p class="plan-card__retailer">${esc(label)}</p>
        <p class="plan-card__name">${esc(r.plan.retailer)} · ${esc(r.plan.name)}</p>
      </div>
      <div class="plan-card__bill"><strong>${fmtMoney(r.monthly)}</strong><span>est./month</span></div>
    </div>
    <div class="plan-card__row"><span>Price</span><span>${esc(r.priceLabel)}</span></div>
    <div class="plan-card__row"><span>Contract</span><span>${esc(r.contract)}</span></div>
    <div class="plan-card__actions">
      <a class="btn btn--secondary btn--sm" href="plans.html?plan=${encodeURIComponent(r.id)}" aria-label="Details: ${esc(r.plan.retailer)} ${esc(r.plan.name)}">Details</a>
      <button class="btn btn--sm" type="button" data-wa data-wa-message="Hi Eutility, I'm interested in switching to ${esc(r.plan.retailer)} ${esc(r.plan.name)}. Can you check if it suits my usage?" aria-label="Switch to ${esc(r.plan.retailer)} ${esc(r.plan.name)} on WhatsApp">Switch</button>
    </div>
  </article>`).join('');

// Testimonials
const t = document.getElementById('home-testimonials');
t.innerHTML = TESTIMONIALS.slice(0, 3).map(testimonialCard).join('');

// Retailer marquee (names only; duplicated once for a seamless loop — the copy is
// hidden from screen readers, and from everyone when motion is reduced).
const names = [...new Set(MARKET_PLANS.map((p) => p.retailer))].sort();
const item = (n) => `<span class="marquee__item">${esc(n)}</span>`;
document.getElementById('marquee').innerHTML =
  names.map(item).join('') + `<span class="marquee__dup" aria-hidden="true">${names.map(item).join('')}</span>`;

observeReveals();
