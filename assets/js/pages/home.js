import { initLayout, observeReveals } from '../layout.js';
import { mountResidential } from '../widgets/residential.js';
import { testimonialCard } from '../widgets/testimonial.js';
import { TESTIMONIALS } from '../data/testimonials.js';
import { META } from '../data/plans.js';
import { AVAILABLE_PLANS, fmtMoney } from '../calc.js';
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
}));

document.querySelector('[data-plan-count]').textContent = `${META.planCount} plans compared`;

// What Eutility does
const VALUE = [
  { icon: 'compare', title: 'Compare the whole market', text: `All ${META.planCount} home plans, priced for your usage and laid side by side, the way we compare offers for our business clients.`, href: 'plans.html', link: 'Have a look' },
  { icon: 'shield', title: 'Independent advice', text: 'We don’t supply energy, so no retailer pays us to push their plan. If yours already wins, we say so.', href: 'about.html', link: 'About Eutility' },
  { icon: 'bolt', title: 'Running a business?', text: 'Add your sites and we\'ll go to market for one better rate. We cover telecoms, bill checks and carbon reporting too.', href: 'calculator.html#sme', link: 'For businesses' },
  { icon: 'gift', title: 'Tell your friends', text: 'They save, you collect rewards. Nothing to sign up for beyond your link.', href: 'referrals.html', link: 'Eutility Rewards' },
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
  ['Cheapest right now', cheapest],
  ['No lock-in', noLock],
  ['Green energy', green],
].filter(([, r]) => r).map(([label, r], i) => `
  <article class="plan-card reveal" style="--d:${i * 0.06}s">
    <div class="plan-card__top">
      <div>
        <p class="plan-card__retailer">${label}</p>
        <p class="plan-card__name">${r.plan.retailer} · ${r.plan.name}</p>
      </div>
      <div class="plan-card__bill"><strong>${fmtMoney(r.monthly)}</strong><span>est. / month</span></div>
    </div>
    <div class="plan-card__row"><span>Price</span><span>${r.priceLabel}</span></div>
    <div class="plan-card__row"><span>Contract</span><span>${r.contract}</span></div>
    <div class="plan-card__actions">
      <a class="btn btn--secondary btn--sm" href="plans.html?plan=${encodeURIComponent(r.id)}">Details</a>
      <button class="btn btn--sm" type="button" data-wa data-wa-message="Hi Eutility, I'd like to switch to ${esc(r.plan.retailer)} ${esc(r.plan.name)}. Can you take it from here?">Switch</button>
    </div>
  </article>`).join('');

// Testimonials
const t = document.getElementById('home-testimonials');
t.innerHTML = TESTIMONIALS.slice(0, 3).map(testimonialCard).join('');

// Retailer marquee (names only; duplicated once for a seamless loop)
const names = [...new Set(AVAILABLE_PLANS.map((p) => p.retailer))];
const item = (n) => `<span class="marquee__item">${n}</span>`;
document.getElementById('marquee').innerHTML =
  names.map(item).join('') + `<span aria-hidden="true" style="display:contents">${names.map(item).join('')}</span>`;

observeReveals();
