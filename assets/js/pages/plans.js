import { initLayout, openWhatsApp, observeReveals, lockBackground, unlockBackground, topLayer } from '../layout.js';
import { CONFIG } from '../config.js';
import { fmtMoney, fmtDate, activePromo, RATES_DATE } from '../calc.js';
import * as plans from '../services/plans-service.js';
import * as customer from '../services/customer.js';

initLayout();

// True while the plan list is bundled with the page. Flip this to a promise
// when plans come from an API and the skeleton below starts earning its keep.
const PLANS_READY = true;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = new URLSearchParams(location.search);
const clampKwh = (v) => Math.min(CONFIG.maxKwh, Math.max(CONFIG.minKwh, Math.round(v / 10) * 10));
const firstNumber = (...vals) => vals.map(Number).find((v) => Number.isFinite(v) && v > 0);

const state = {
  kwh: clampKwh(firstNumber(q.get('kwh'), customer.get()?.monthlyKwh) || CONFIG.defaultKwh),
  type: Object.hasOwn(plans.PLAN_TYPES, q.get('type') || '') ? q.get('type') : 'all',
  retailer: 'all',
  sort: 'price',
};

const toolbar = document.getElementById('plan-toolbar');
toolbar.innerHTML = `
  <div class="range-wrap">
    <label class="field__label" for="pl-kwh">Your monthly usage</label>
    <div class="range-value"><output id="pl-out">${state.kwh.toLocaleString('en-SG')}</output><span>kWh/month</span></div>
    <input class="range" type="range" id="pl-kwh" min="${CONFIG.minKwh}" max="${CONFIG.maxKwh}" step="10" value="${state.kwh}">
  </div>
  <div class="field">
    <label class="field__label" for="pl-retailer">Retailer</label>
    <select class="select" id="pl-retailer">
      <option value="all">All retailers</option>
      ${plans.retailers().map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
    </select>
  </div>
  <div class="field">
    <label class="field__label" for="pl-sort">Sort by</label>
    <select class="select" id="pl-sort">
      ${Object.entries(plans.SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}
    </select>
  </div>
  <div class="chips" style="grid-column:1/-1">
    ${Object.entries(plans.PLAN_TYPES).map(([k, t]) => `
      <span class="chip"><input type="radio" name="pl-type" id="pl-t-${k}" value="${k}"${k === state.type ? ' checked' : ''}><label for="pl-t-${k}">${t.label}</label></span>`).join('')}
  </div>`;

const grid = document.getElementById('plan-grid');
const count = document.getElementById('plan-count');
const basis = document.getElementById('plan-basis');
const kwhRange = document.getElementById('pl-kwh');
const kwhOut = document.getElementById('pl-out');

const paint = (el) => el.style.setProperty('--pct', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
paint(kwhRange);

function card(row, i, best) {
  const p = row.plan;
  return `
  <article class="plan-card${row.id === best ? ' plan-card--best' : ''} reveal" style="--d:${Math.min(i, 8) * 0.05}s">
    <div class="plan-card__top">
      <div>
        <p class="plan-card__retailer">${esc(p.retailer)}</p>
        <p class="plan-card__name">${esc(p.name)}</p>
      </div>
      <div class="plan-card__bill"><strong>${fmtMoney(row.monthly)}</strong><span>est./month</span></div>
    </div>
    <div class="plan-card__tags">
      ${row.id === best ? '<span class="tag tag--green">Lowest estimate</span>' : ''}
      ${row.tags.map((t) => `<span class="tag${t === 'Green' ? ' tag--green' : t === 'Promotion' ? ' tag--promo' : ''}">${esc(t)}</span>`).join('')}
    </div>
    <div class="plan-card__row"><span>Price</span><span>${esc(row.priceLabel)}</span></div>
    <div class="plan-card__row"><span>Contract</span><span>${esc(row.contract)}</span></div>
    <div class="plan-card__row"><span>vs SP tariff</span><span class="${row.savingVsTariffYearly >= 0 ? 'save-pos' : 'save-neg'}">${row.savingVsTariffYearly >= 0 ? `Save ${fmtMoney(row.savingVsTariffYearly)}/yr` : `${fmtMoney(-row.savingVsTariffYearly)}/yr more`}</span></div>
    <div class="plan-card__actions">
      <button class="btn btn--secondary btn--sm" type="button" data-detail="${row.id}" aria-label="Details: ${esc(p.retailer)} ${esc(p.name)}">Details</button>
      <button class="btn btn--sm" type="button" data-switch="${row.id}" aria-label="Switch to ${esc(p.retailer)} ${esc(p.name)} on WhatsApp">Switch</button>
    </div>
  </article>`;
}

const skeletonCards = (n = 6) => Array.from({ length: n }, () => `
  <article class="plan-card plan-card--skeleton" aria-hidden="true">
    <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span>
    <span class="skeleton"></span><span class="skeleton"></span>
  </article>`).join('');

// Plan data ships with the page, so there is nothing to wait for. The
// skeleton stays for when this comes from an API — faking latency just made
// the grid look stuck.
function render(keepPage) {
  if (!keepPage) showAll = false;
  if (!PLANS_READY) { grid.innerHTML = skeletonCards(); return; }
  drawGrid();
}

// On a phone, 35 full cards is 17 screens of scrolling. Show the first 10 —
// already sorted the way the person chose — and let them ask for the rest.
const PHONE = matchMedia('(max-width: 767px)');
const FIRST_PAGE = 10;
let showAll = false;

function drawGrid() {
  const rows = plans.list(state);
  const best = rows.length ? rows.slice().sort((a, b) => a.monthly - b.monthly)[0].id : null;
  const shown = PHONE.matches && !showAll ? rows.slice(0, FIRST_PAGE) : rows;
  const rest = rows.length - shown.length;
  grid.innerHTML = rows.length
    ? shown.map((r, i) => card(r, i, best)).join('')
      + (rest > 0 ? `<button class="btn btn--secondary btn--block plan-more" type="button" data-more>Show ${rest} more plan${rest === 1 ? '' : 's'}</button>` : '')
    : `<div class="empty" style="grid-column:1/-1">
         <p class="h4" style="color:var(--text)">No plans match those filters</p>
         <p>Try another retailer or plan type, or ask us and we’ll help you choose.</p>
         <div class="btn-row" style="justify-content:center">
           <button class="btn btn--sm" type="button" data-reset>Reset filters</button>
           <a class="btn btn--secondary btn--sm" href="#" data-wa data-wa-message="Hi Eutility, I'm looking for an electricity plan and have a question.">Ask on WhatsApp</a>
         </div>
       </div>`;
  count.textContent = `${rows.length} plan${rows.length === 1 ? '' : 's'}`;
  basis.innerHTML = `Estimated at ${state.kwh.toLocaleString('en-SG')} kWh/month · SP Group tariff ${plans.TARIFF}¢/kWh (<span class="nowrap">${esc(plans.TARIFF_PERIOD)}</span>) · rates as at <span class="nowrap">${RATES_DATE}</span>`;
  observeReveals(grid);
  syncUrl();
}

// Keep the address bar in step without hammering history while the slider moves.
let urlTimer;
function syncUrl() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const u = new URL(location.href);
    u.searchParams.set('kwh', state.kwh);
    u.searchParams.set('type', state.type);
    try { history.replaceState(null, '', u); } catch { /* rate-limited by the browser; harmless */ }
  }, 250);
}

kwhRange.addEventListener('input', () => {
  state.kwh = Number(kwhRange.value);
  kwhOut.textContent = state.kwh.toLocaleString('en-SG');
  paint(kwhRange);
  render();
});
document.getElementById('pl-retailer').addEventListener('change', (e) => { state.retailer = e.target.value; render(); });
document.getElementById('pl-sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
document.querySelectorAll('input[name="pl-type"]').forEach((r) => r.addEventListener('change', () => { state.type = r.value; render(); }));

// ── Plan detail sheet ──
const sheet = document.getElementById('plan-sheet');
const sheetBody = document.getElementById('sheet-body');

function openSheet(id) {
  const row = plans.detail(id, { kwh: state.kwh });
  if (!row) return;
  const p = row.plan;
  const promo = activePromo(p);
  sheetTrigger = document.activeElement;
  sheetBody.innerHTML = `
    <div class="stack" style="--stack:10px">
      <p class="plan-card__retailer">${esc(p.retailer)}</p>
      <h2 class="h2" id="sheet-title">${esc(p.name)}</h2>
      <div class="plan-card__tags">${row.tags.map((t) => `<span class="tag${t === 'Green' ? ' tag--green' : t === 'Promotion' ? ' tag--promo' : ''}">${esc(t)}</span>`).join('')}</div>
    </div>
    <div class="card card--blue" style="display:grid;gap:4px">
      <span class="small">Estimated bill at ${state.kwh.toLocaleString('en-SG')} kWh/month</span>
      <span style="font-size:34px;font-weight:700;letter-spacing:-.02em;color:var(--text)">${fmtMoney(row.monthly, 2)}<span class="small">/month</span></span>
      <span class="small">Effective ${row.effectiveRate}¢/kWh including any daily charge</span>
    </div>
    <dl style="margin:0">
      <div class="spec"><dt>Price</dt><dd>${esc(row.priceLabel)}</dd></div>
      <div class="spec"><dt>Contract</dt><dd>${esc(row.contract)}</dd></div>
      <div class="spec"><dt>Plan type</dt><dd>${esc(p.pricingLabel || p.pricingType)}${p.category === 'Green' ? ' · Green energy' : ''}</dd></div>
      ${promo ? `<div class="spec"><dt>Promotion</dt><dd>${esc([promo.title, promo.value].filter(Boolean).join(': '))}${promo.code ? ` · code <strong>${esc(promo.code)}</strong>` : ''}${promo.expires ? ` · ends ${esc(fmtDate(promo.expires))}` : ''}${promo.conditions ? `<br><span class="small">${esc(promo.conditions)}</span>` : ''}<br><span class="small">Set by the retailer; terms may change.</span></dd></div>` : ''}
      <div class="spec"><dt>Early termination</dt><dd>${esc(p.etf || 'See retailer terms')}</dd></div>
      <div class="spec"><dt>Security deposit</dt><dd>${esc(p.deposit || 'See retailer terms')}</dd></div>
      ${p.notes?.length ? `<div class="spec"><dt>Good to know</dt><dd>${p.notes.map(esc).join('<br>')}</dd></div>` : ''}
      <div class="spec"><dt>Source</dt><dd>${esc(p.source || p.retailer)} published rates, as at ${RATES_DATE}</dd></div>
    </dl>
    <div class="stack" style="--stack:12px">
      <button class="btn btn--block" type="button" data-switch="${p.id}">Switch on WhatsApp</button>
      <a class="btn btn--secondary btn--block" href="calculator.html?kwh=${state.kwh}&run=1">Compare with my current plan</a>
      <button class="btn btn--neutral btn--block" type="button" data-ask>Ask about this plan</button>
    </div>
    <p class="small">No account needed to switch. We’ll reply to confirm the plan, then help you sign up with the retailer. <a href="signup.html?plan=${encodeURIComponent(p.id)}&kwh=${state.kwh}">Create an account</a> if you’d like to keep your details in one place.</p>
    <p class="small">Rates compiled by Eutility from each retailer’s published prices. Final pricing and terms are set by the retailer’s contract.</p>`;
  sheetBody.querySelector('[data-ask]').addEventListener('click', () => openWhatsApp(
    `Hi Eutility, I'd like to know more about ${p.retailer} ${p.name} (about ${state.kwh} kWh/month).`,
  ));
  sheet.classList.add('is-open');
  sheet.setAttribute('aria-hidden', 'false');
  lockBackground(sheet);
  sheet.querySelector('.sheet__close').focus();
}
let sheetTrigger = null;
function closeSheet() {
  if (!sheet.classList.contains('is-open')) return;
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  unlockBackground(sheet);
  sheetTrigger?.focus?.({ preventScroll: true });
}
/** Hand the switch straight to a person — no sign-up in between. */
function switchOn(planId) {
  const row = plans.detail(planId, { kwh: state.kwh });
  const p = row?.plan;
  const name = p ? `${p.retailer} ${p.name}` : 'this plan';
  const saving = row && row.savingVsTariffYearly > 0
    ? ` That's about ${fmtMoney(row.savingVsTariffYearly)}/year better than the SP tariff.` : '';
  openWhatsApp(`Hi Eutility, I'd like to switch to ${name}. I use about ${state.kwh} kWh a month.${saving} Can you help me switch?`);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-more]')) {
    const first = grid.children.length - 1;          // index of the first newly shown card
    showAll = true; drawGrid();
    grid.children[first]?.querySelector('button')?.focus({ preventScroll: true });
    return;
  }
  if (e.target.closest('[data-reset]')) {
    state.type = 'all'; state.retailer = 'all';
    document.getElementById('pl-t-all').checked = true;
    document.getElementById('pl-retailer').value = 'all';
    render();
    return;
  }
  const s = e.target.closest('[data-switch]');
  if (s) { e.preventDefault(); switchOn(s.dataset.switch); return; }
  const b = e.target.closest('[data-detail]');
  if (b) openSheet(b.dataset.detail);
});
sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('is-open') && topLayer() === sheet) closeSheet(); });

render();
if (q.get('plan')) openSheet(q.get('plan'));
