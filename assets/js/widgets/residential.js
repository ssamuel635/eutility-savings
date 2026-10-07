// Residential savings calculator widget.
//   mode 'compact' — homepage card: inputs → thinking → count-up reveal → link to full comparison
//   mode 'full'    — calculator page: filters, reveal, plan-vs, animated bar chart, full plan table
import { CONFIG } from '../config.js';
import { META } from '../data/plans.js';
import {
  AVAILABLE_PLANS, compare, getPlan, DEFAULT_CURRENT_ID, CONTRACT_FILTERS,
  fmtMoney, contractLabel, rateLabel, monthlyCost,
} from '../calc.js';
import { countUp, confetti, ding, wait, soundEnabled, setSound, reducedMotion } from '../fx.js';
import { openWhatsApp, openEmail, toast, setBarAction } from '../layout.js';
import * as customer from '../services/customer.js';
import * as I from '../icons.js';

const RETAILERS = [...new Set(AVAILABLE_PLANS.map((p) => p.retailer))];
// SP Group first — it's the default for households who have never switched.
RETAILERS.sort((a, b) => (a === 'SP Group' ? -1 : b === 'SP Group' ? 1 : a.localeCompare(b)));
const plansOf = (r) => AVAILABLE_PLANS.filter((p) => p.retailer === r);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Pick the most likely plan when a user knows their retailer but not their plan. */
function defaultPlanFor(retailer) {
  const ps = plansOf(retailer);
  return (ps.find((p) => p.pricingType === 'fixed' && p.contractMonths === 24 && !p.referralOnly) || ps[0]).id;
}

let uid = 0;

export function mountResidential(root, { mode = 'full', initial = {}, bare = false } = {}) {
  const id = `res${++uid}`;
  const full = mode === 'full';
  const start = {
    kwh: clampKwh(Number(initial.kwh) || CONFIG.defaultKwh),
    currentId: getPlan(initial.plan)?.id || DEFAULT_CURRENT_ID,
    contract: CONTRACT_FILTERS[initial.contract] ? initial.contract : '24',
  };
  const startRetailer = getPlan(start.currentId).retailer;

  root.innerHTML = `
  <form class="${bare ? '' : 'card card--shadow '}calc-card" novalidate ${bare ? 'aria-label="Residential savings calculator"' : `aria-labelledby="${id}-title"`}>
    ${bare ? '' : `<h2 class="calc-card__title" id="${id}-title">${full ? 'Your details' : 'Check your savings'}</h2>`}

    <div class="range-wrap">
      <label class="field__label" for="${id}-kwh"><span>Monthly electricity usage <span class="tip" tabindex="0" data-tip="kWh (kilowatt-hours) are the units of electricity on your bill. Your SP Group bill shows how many you used last month.">?</span></span></label>
      <div class="presets" role="group" aria-label="Not sure? Pick your home type">
        ${CONFIG.homePresets.map((p) => `<button type="button" class="preset" data-kwh="${p.kwh}" aria-pressed="false">${p.label}</button>`).join('')}
      </div>
      <div class="range-value"><output id="${id}-out" for="${id}-kwh">${start.kwh}</output><span>kWh / month</span></div>
      <input class="range" type="range" id="${id}-kwh" min="${CONFIG.minKwh}" max="${CONFIG.maxKwh}" step="10" value="${start.kwh}"
        aria-describedby="${id}-kwh-help">
      <div class="range-scale" aria-hidden="true"><span>${CONFIG.minKwh}</span><span>${CONFIG.maxKwh.toLocaleString('en-SG')}</span></div>
      <p class="field__help" id="${id}-kwh-help">Not sure? Tap your home type above for a typical figure, or check “Electricity” on your SP Group bill.</p>
      ${full ? `
      <div class="field">
        <label class="field__label" for="${id}-kwh-exact">Or type your exact usage</label>
        <div class="input-suffix"><input class="input" id="${id}-kwh-exact" type="number" inputmode="numeric" min="${CONFIG.minKwh}" max="5000" value="${start.kwh}"><span>kWh</span></div>
        <p class="field__error" id="${id}-kwh-err" hidden></p>
      </div>` : ''}
    </div>

    <div class="field">
      <label class="field__label" for="${id}-retailer">Current retailer</label>
      <select class="select" id="${id}-retailer">
        ${RETAILERS.map((r) => `<option value="${esc(r)}"${r === startRetailer ? ' selected' : ''}>${esc(r === 'SP Group' ? 'SP Group (never switched)' : r)}</option>`).join('')}
      </select>
    </div>
    <div class="field" id="${id}-plan-field">
      <label class="field__label" for="${id}-plan">Current plan <span class="small">Not sure? Leave as is</span></label>
      <select class="select" id="${id}-plan"></select>
    </div>

    ${full ? `
    <fieldset class="field" style="border:0;padding:0;margin-top:20px">
      <legend class="field__label" style="margin-bottom:8px">Contract length you'd accept</legend>
      <div class="chips">
        ${Object.entries(CONTRACT_FILTERS).map(([k, f]) => `
          <span class="chip"><input type="radio" name="${id}-contract" id="${id}-c-${k}" value="${k}"${k === start.contract ? ' checked' : ''}><label for="${id}-c-${k}">${f.label}</label></span>`).join('')}
      </div>
    </fieldset>
    <label class="switch"><input type="checkbox" id="${id}-green"><span class="switch__track"></span>Green plans only</label>
    <details class="advanced">
      <summary>Advanced assumptions</summary>
      <div class="advanced__body">
        <div class="range-wrap">
          <label class="field__label" for="${id}-offpeak">Usage at night / off-peak <strong id="${id}-offpeak-out">${Math.round(CONFIG.defaultOffPeakShare * 100)}%</strong></label>
          <input class="range" type="range" id="${id}-offpeak" min="0" max="80" step="5" value="${CONFIG.defaultOffPeakShare * 100}">
          <p class="field__help">Only affects time-of-use plans (cheaper at night, dearer by day).</p>
        </div>
        <label class="switch"><input type="checkbox" id="${id}-refonly"><span class="switch__track"></span>Include referral-only plans</label>
      </div>
    </details>` : ''}

    <p class="live-bill" aria-live="polite"><span class="pulse-dot" aria-hidden="true"></span><span>Your bill today is about <strong data-live-bill>—</strong> a month</span></p>
    <button class="btn btn--block" type="submit">Calculate Savings <span class="arrow" aria-hidden="true">→</span></button>
    <p class="small text-center">No sign-up needed · Rates from ${META.planCount} plans, updated ${META.generated}</p>
    ${full ? '' : `<div class="res-compact-out" aria-live="polite"></div>`}
  </form>
  ${full ? `<div class="res-results" id="${id}-results" aria-live="polite" tabindex="-1"></div>` : ''}`;

  const $ = (s) => root.querySelector(s);
  const form = $('form');
  const range = $(`#${id}-kwh`);
  const out = $(`#${id}-out`);
  const exact = $(`#${id}-kwh-exact`);
  const exactErr = $(`#${id}-kwh-err`);
  const retailerSel = $(`#${id}-retailer`);
  const planSel = $(`#${id}-plan`);
  const offpeak = $(`#${id}-offpeak`);
  const resultsEl = full ? $(`#${id}-results`) : $('.res-compact-out');

  let kwh = start.kwh;

  const paintRange = (el) => {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--pct', pct + '%');
  };
  const liveBill = $('[data-live-bill]');
  const presets = root.querySelectorAll('.preset');
  function updateLive() {
    const cur = getPlan(planSel?.value) || getPlan(DEFAULT_CURRENT_ID);
    if (liveBill && cur) liveBill.textContent = fmtMoney(monthlyCost(cur, kwh).total);
  }
  function setKwh(v, from) {
    kwh = v;
    out.textContent = Number(v).toLocaleString('en-SG');
    if (from !== 'range') { range.value = Math.min(CONFIG.maxKwh, v); }
    if (exact && from !== 'exact') exact.value = v;
    paintRange(range);
    if (from !== 'preset') presets.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    updateLive();
  }
  // Presets glide the slider to a typical value
  let glide;
  presets.forEach((b) => b.addEventListener('click', () => {
    presets.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const from = kwh, to = Number(b.dataset.kwh), t0 = performance.now();
    cancelAnimationFrame(glide);
    const step = (now) => {
      const t = reducedMotion() ? 1 : Math.min(1, (now - t0) / 450);
      const e = 1 - Math.pow(1 - t, 3);
      setKwh(Math.round(from + (to - from) * e), 'preset');
      if (t < 1) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }));
  range.addEventListener('input', () => setKwh(Number(range.value), 'range'));
  exact?.addEventListener('input', () => {
    const v = Number(exact.value);
    const ok = v >= CONFIG.minKwh && v <= 5000;
    exact.setAttribute('aria-invalid', String(!ok));
    exactErr.hidden = ok;
    exactErr.textContent = ok ? '' : `Enter a usage between ${CONFIG.minKwh} and 5,000 kWh.`;
    if (ok) setKwh(v, 'exact');
  });
  setKwh(kwh);

  function fillPlans(retailer, selectedId) {
    const ps = plansOf(retailer);
    const def = defaultPlanFor(retailer);
    planSel.innerHTML = ps.map((p) => {
      const tag = p.id === def && ps.length > 1 ? ' — assumed if unsure' : '';
      return `<option value="${p.id}"${p.id === (selectedId || def) ? ' selected' : ''}>${esc(p.name)} — ${esc(rateLabel(p))}${tag}</option>`;
    }).join('');
    $(`#${id}-plan-field`).hidden = ps.length <= 1;
  }
  fillPlans(startRetailer, start.currentId);
  updateLive();
  retailerSel.addEventListener('change', () => { fillPlans(retailerSel.value); updateLive(); });
  planSel.addEventListener('change', updateLive);

  offpeak?.addEventListener('input', () => {
    $(`#${id}-offpeak-out`).textContent = offpeak.value + '%';
    paintRange(offpeak);
  });
  if (offpeak) paintRange(offpeak);

  function readInputs() {
    return {
      kwh,
      currentId: planSel.value || DEFAULT_CURRENT_ID,
      contract: full ? form.querySelector(`input[name="${id}-contract"]:checked`).value : '24',
      greenOnly: full ? $(`#${id}-green`).checked : false,
      includeReferralOnly: full ? $(`#${id}-refonly`).checked : false,
      offPeakShare: offpeak ? Number(offpeak.value) / 100 : CONFIG.defaultOffPeakShare,
    };
  }

  let running = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (running) return;
    if (exact && exact.getAttribute('aria-invalid') === 'true') { exact.focus(); return; }
    running = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Calculating…';
    const inputs = readInputs();
    const res = compare(inputs);
    await thinking(resultsEl, full, res.results.length);
    if (full) {
      renderFull(resultsEl, res, inputs);
      const u = new URL(location.href);
      u.searchParams.set('kwh', inputs.kwh);
      u.searchParams.set('plan', inputs.currentId);
      u.searchParams.set('contract', inputs.contract);
      history.replaceState(null, '', u);
    } else {
      renderCompact(resultsEl, res, inputs);
    }
    btn.disabled = false;
    btn.innerHTML = 'Recalculate <span class="arrow" aria-hidden="true">→</span>';
    running = false;
  });

  return { run: () => form.requestSubmit() };
}

function clampKwh(v) { return Math.max(CONFIG.minKwh, Math.min(5000, Math.round(v))); }

// ── "AI thinking" moment (brief page 2: pulsing dots / scanning line) ──
async function thinking(el, full, planCount) {
  const retailers = new Set(AVAILABLE_PLANS.map((p) => p.retailer)).size;
  const steps = ['Reading your usage', `Comparing ${planCount} plans from ${retailers} retailers`, 'Calculating your savings'];
  el.innerHTML = `
    <div class="${full ? 'card card--shadow ' : ''}thinking" role="status">
      <div class="thinking__scan" aria-hidden="true"></div>
      <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
      <ol class="thinking__steps">${steps.map((s, i) => `<li>${s}… (${i + 1} of 3)</li>`).join('')}</ol>
    </div>`;
  if (full) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  const lis = el.querySelectorAll('li');
  for (let i = 0; i < lis.length; i++) {
    lis[i].classList.add('is-active');
    await wait(full ? 650 : 420);
    lis[i].classList.remove('is-active');
    lis[i].classList.add('is-done');
  }
}

/** Yearly saving expressed as months of the new bill — a friendlier way to picture it. */
function freeMonths(best) {
  if (!best || best.total <= 0) return '';
  const m = best.savingYearly / best.total;
  if (m < 0.5) return '';
  const r = Math.round(m * 2) / 2;
  return `${r % 1 ? r.toFixed(1) : r} month${r === 1 ? '' : 's'}`;
}

/**
 * The handoff message. This carries everything Eutility needs to act on the
 * switch, which is why nobody has to make an account first — the fast path is
 * calculator → results → WhatsApp, and this message is what makes that work.
 */
function planWaMessage(res, inputs) {
  const b = res.best.plan;
  const c = res.current.plan;
  return `Hi Eutility, I'd like to switch from ${c.retailer} ${c.name} to ${b.retailer} ${b.name}.`
    + ` I use about ${inputs.kwh} kWh a month, and your calculator says I'd save around ${fmtMoney(res.best.savingYearly)}/year`
    + ` (${fmtMoney(res.best.savingMonthly)}/month). Can you take it from here?`;
}

/** On phones the bottom bar becomes this result's switch button (layout.js). */
function barFor(res, inputs, el) {
  if (!res.best || res.alreadyBest) { setBarAction(null); return; }
  setBarAction({
    label: `Switch & save ${fmtMoney(res.best.savingYearly)}/yr`,
    sub: `${res.best.plan.retailer} ${res.best.plan.name}`,
    message: planWaMessage(res, inputs),
    subject: planMailSubject(res),
  }, el.querySelector('[data-wa-switch]'));
}

/** The same thing, as an email subject. */
function planMailSubject(res) {
  return `Switch request — ${res.best.plan.retailer} ${res.best.plan.name}`;
}

async function celebrate(numEl, yearly) {
  await countUp(numEl, yearly);
  ding();
  if (yearly > CONFIG.confettiThreshold) confetti();
}

// ── Compact result (homepage) ──
async function renderCompact(el, res, inputs) {
  const params = new URLSearchParams({ kwh: inputs.kwh, plan: inputs.currentId, run: '1' });
  if (res.alreadyBest) {
    el.innerHTML = `
      <div class="stack" style="--stack:12px">
        <p class="h4 text-green">Good news — you're already on one of the cheapest plans for your usage.</p>
        <a class="link-arrow" href="calculator.html?${params}">See the full comparison</a>
      </div>`;
    setBarAction(null);
    return;
  }
  el.innerHTML = `
    <div class="stack enter" style="--stack:14px">
      <div class="reveal-num">
        <span class="reveal-num__label">You save</span>
        <span class="reveal-num__big">S$<span data-n>0</span><small>/year</small></span>
        <span class="reveal-num__sub">with ${esc(res.best.plan.retailer)} ${esc(res.best.plan.name)} · ${fmtMoney(res.best.savingMonthly)}/month</span>
        ${freeMonths(res.best) ? `<span class="free-months">≈ ${freeMonths(res.best)} of electricity, on us</span>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn btn--urgent" type="button" data-switch data-wa-switch>${I.chat}<span>Switch on WhatsApp</span></button>
        <a class="btn btn--secondary" href="calculator.html?${params}">See full comparison</a>
      </div>
      <p class="small">No account needed. <a href="signup.html?plan=${encodeURIComponent(res.best.plan.id)}&kwh=${inputs.kwh}">Save this result</a> if you'd like us to keep it.</p>
    </div>`;
  const r = el.getBoundingClientRect();
  if (r.bottom > innerHeight || r.top < 0) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  el.querySelector('[data-wa-switch]')?.addEventListener('click', () => openWhatsApp(planWaMessage(res, inputs)));
  barFor(res, inputs, el);
  await celebrate(el.querySelector('[data-n]'), res.best.savingYearly);
  el.querySelector('[data-switch]').classList.add('btn--pulse');
}

// ── Full result (calculator page) ──
function renderFull(el, res, inputs) {
  const { current, best, results, alreadyBest } = res;
  const cur = current.plan;
  const sOn = soundEnabled();
  const top = results.slice(0, 5);
  const chartRows = [
    { label: `${cur.retailer} · ${cur.name}`, sub: 'your plan', total: current.total, cls: 'bar--current' },
    ...top.filter((r) => r.plan.id !== cur.id).slice(0, 5).map((r, i) => ({
      label: `${r.plan.retailer} · ${r.plan.name}`, sub: contractLabel(r.plan.contractMonths), total: r.total, cls: i === 0 && !alreadyBest ? 'bar--winner' : '',
    })),
  ];
  const max = Math.max(...chartRows.map((r) => r.total));

  const b = best?.plan;
  const promo = b?.promo;
  el.innerHTML = `
  <div class="stack" style="--stack:20px">
    <div class="card card--shadow stack enter res-card" style="--stack:20px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <span class="pill pill--green">Based on ${inputs.kwh.toLocaleString('en-SG')} kWh / month</span>
        <button class="btn btn--ghost btn--sm" type="button" data-sound aria-pressed="${sOn}">${I.sound(sOn)}<span>Sound ${sOn ? 'on' : 'off'}</span></button>
      </div>
      ${alreadyBest ? `
        <div class="stack" style="--stack:8px">
          <p class="eyebrow" style="color:var(--green-aa)">Nice</p>
          <h2 class="h2">You're already on one of the cheapest plans for your usage.</h2>
          <p class="lead">Nothing cheaper matches your filters. Try widening the contract length, or chat with us to check promotions.</p>
        </div>` : `
        <div class="reveal-num">
          <span class="reveal-num__label">You save</span>
          <span class="reveal-num__big">S$<span data-n>0</span><small>/year</small></span>
          <span class="reveal-num__sub">That's <span class="num">${fmtMoney(best.savingMonthly, 2)}</span> a month</span>
          ${freeMonths(best) ? `<span class="free-months">≈ ${freeMonths(best)} of electricity, on us</span>` : ''}
        </div>
        <div class="plan-vs">
          <div class="plan-box">
            <span class="plan-box__eyebrow">Current plan</span>
            <span class="plan-box__name">${esc(cur.retailer)} · ${esc(cur.name)}</span>
            <span class="plan-box__meta">${esc(rateLabel(cur))}</span>
            <span class="plan-box__bill">${fmtMoney(current.total, 2)}<span class="small">/mo</span></span>
          </div>
          <span class="plan-vs__arrow"><span aria-hidden="true">→</span><span class="plan-vs__delta">−${fmtMoney(best.savingMonthly, 2)}/mo</span></span>
          <div class="plan-box plan-box--rec">
            <span class="plan-box__eyebrow">Recommended</span>
            <span class="plan-box__name">${esc(b.retailer)} · ${esc(b.name)}</span>
            <span class="plan-box__meta">${esc(rateLabel(b))} · ${contractLabel(b.contractMonths)}</span>
            <span class="plan-box__bill">${fmtMoney(best.total, 2)}<span class="small">/mo</span></span>
          </div>
        </div>
        ${promo ? `<div class="promo"><span aria-hidden="true" style="width:22px;flex:none;color:var(--orange-aa)">${I.gift}</span><div><strong>Sign-up promotion:</strong> ${esc(promo.value)}${promo.code ? ` · code <strong>${esc(promo.code)}</strong>` : ''}${promo.conditions ? `<br><span class="small">${esc(promo.conditions)}</span>` : ''}<br><span class="small">Not included in the savings above.</span></div></div>` : ''}
        <div class="btn-row">
          <button class="btn btn--urgent" type="button" data-switch data-wa-switch>${I.chat}<span>Switch on WhatsApp</span></button>
          <button class="btn btn--secondary" type="button" data-mail-switch>${I.mail}<span>Switch by email</span></button>
        </div>
        <p class="small">No account needed — we'll take it from there. · <a href="plans.html?kwh=${inputs.kwh}">Browse all plans</a></p>

        ${customer.isSignedIn()
          ? `<p class="small">Saved to your account. <a href="account.html">See your checks</a></p>`
          : `<div class="save-offer">
               <div>
                 <p class="h4">Want us to remember this?</p>
                 <p class="small">Keep this comparison, add your bill and your electricity details, and we'll re-check when rates move. Free, and about a minute.</p>
               </div>
               <a class="btn btn--secondary" href="signup.html?plan=${encodeURIComponent(b.id)}&kwh=${inputs.kwh}">Create my account</a>
             </div>`}
        <ul class="note-list">
          ${b.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
          ${b.contractMonths ? `<li>Early termination: ${esc(b.etf || 'see retailer terms')}</li>` : ''}
          ${b.deposit ? `<li>Deposit: ${esc(b.deposit)}</li>` : ''}
        </ul>`}
    </div>

    <div class="card stack enter" style="--stack:16px;--d:.15s">
      <h3 class="h3">How your plan compares</h3>
      <p class="small">Estimated monthly bill at ${inputs.kwh.toLocaleString('en-SG')} kWh. Lower is better.</p>
      <ul class="bars">
        ${chartRows.map((r) => `
          <li class="bar ${r.cls}">
            <span class="bar__label">${esc(r.label)} <small>· ${esc(r.sub)}</small></span>
            <span class="bar__value">${fmtMoney(r.total, 2)}</span>
            <span class="bar__track"><span class="bar__fill" data-w="${((r.total / max) * 100).toFixed(1)}"></span></span>
          </li>`).join('')}
      </ul>
    </div>

    <details class="card enter" style="--d:.3s">
      <summary class="h4" style="cursor:pointer">See all ${results.length} matching plans</summary>
      <div class="table-scroll" style="margin-top:16px">
        <table class="plan-table">
          <thead><tr><th>Plan</th><th>Price</th><th class="num-cell">Est. bill /mo</th><th class="num-cell">Save /yr</th></tr></thead>
          <tbody>
            ${results.map((r, i) => `
              <tr class="${i === 0 && !alreadyBest ? 'is-best' : ''}">
                <td><strong>${esc(r.plan.retailer)}</strong> · ${esc(r.plan.name)}<span class="muted">${contractLabel(r.plan.contractMonths)}${r.plan.category === 'Green' ? ' · Green' : ''}${r.plan.promo ? ' · Promo' : ''}</span></td>
                <td>${esc(rateLabel(r.plan))}</td>
                <td class="num-cell">${fmtMoney(r.total, 2)}</td>
                <td class="num-cell ${r.savingYearly >= 0 ? 'save-pos' : 'save-neg'}">${r.savingYearly >= 0 ? '' : '−'}${fmtMoney(Math.abs(r.savingYearly))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </details>

    <p class="small">How we estimate: usage × each plan's published rate (plus any daily charge), compared with your current plan. Discount-off-tariff plans use SP's current tariff of ${META.regulatedTariff}¢/kWh. Time-of-use plans assume ${Math.round(inputs.offPeakShare * 100)}% of usage is off-peak. Promotions are shown separately and not included. Your actual bill depends on your usage and the retailer's terms.</p>
  </div>`;

  // Keep the result in the customer's account (mock storage) when signed in
  if (!alreadyBest && customer.isSignedIn()) {
    customer.saveCheck({
      kwh: inputs.kwh,
      currentPlanId: cur.id,
      currentPlanName: `${cur.retailer} · ${cur.name}`,
      bestPlanId: b.id,
      bestPlanName: `${b.retailer} · ${b.name}`,
      savingYearly: best.savingYearly,
      savingMonthly: best.savingMonthly,
    });
    toast('Saved to your account');
  }

  // Wire actions — the switch handoff carries the plan and the numbers, so this
  // alone is a complete request. The account offer sits beside it, never in front.
  el.querySelector('[data-wa-switch]')?.addEventListener('click', () => openWhatsApp(planWaMessage(res, inputs)));
  el.querySelector('[data-mail-switch]')?.addEventListener('click', () => openEmail(planWaMessage(res, inputs), planMailSubject(res)));
  barFor(res, inputs, el);
  el.querySelector('[data-wa-chat]')?.addEventListener('click', () => openWhatsApp(
    `Hi Eutility, I have a question about my savings estimate (${inputs.kwh} kWh/month, currently on ${cur.retailer} ${cur.name}).`,
  ));
  const soundBtn = el.querySelector('[data-sound]');
  soundBtn.addEventListener('click', () => {
    const on = !soundEnabled();
    setSound(on);
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.innerHTML = `${I.sound(on)}<span>Sound ${on ? 'on' : 'off'}</span>`;
    if (on) ding();
  });

  // Animate: bars grow and compete → winner glows, others fade → count-up → pulse CTA
  el.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    el.querySelectorAll('.bar__fill').forEach((f) => { f.style.width = f.dataset.w + '%'; });
    setTimeout(() => el.querySelector('.bars')?.classList.add('is-settled'), reducedMotion() ? 0 : 1100);
  });
  if (!alreadyBest) {
    celebrate(el.querySelector('[data-n]'), best.savingYearly).then(() => {
      el.querySelector('[data-switch]')?.classList.add('btn--pulse');
    });
  }
}
