// Switch on the website (agreed with FXMedia, 24 Nov 2026): confirm your
// number → your details → check the plan → done. No account. The server
// (api/web-switch.mjs) saves the contact and the sign-up with FXMedia, and the
// WhatsApp chatbot sends the confirmation.
//   switch.html?plan=<our plan id>&kwh=370&current=<our current plan id>&rate=<¢/kWh, optional>
import { initLayout, openWhatsApp, track, referredBy } from '../layout.js';
import { getPlan, compare, fmtMoney, rateLabel, contractLabel, DEFAULT_CURRENT_ID } from '../calc.js';
import { enhanceSelect } from '../widgets/picker.js';
import * as I from '../icons.js';

initLayout();

const API = '/api/web-switch';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = new URLSearchParams(location.search);
const plan = getPlan(q.get('plan'));
const current = getPlan(q.get('current')) || getPlan(DEFAULT_CURRENT_ID);
const kwhIn = Math.round(Number(q.get('kwh')));
const kwh = kwhIn >= 50 && kwhIn <= 5000 ? kwhIn : null;
const rate = Number(q.get('rate')) || null;
const card = document.getElementById('switch-card');
const context = document.getElementById('switch-context');

const STEPS = ['Your number', 'Your details', 'Confirm'];
const s = {
  step: 0, phone: '', code: '', codeToken: '', demoCode: '', verifiedToken: '', unitTypes: [],
  fullName: '', email: '', address: '', postal: '', unitType: '', spAccount: '', terms: false, contact: false,
  fx: null, promoCode: '', busy: false, done: null,
};

/** The same request, for anyone who can't switch online: the WhatsApp message the calculator used to send. */
function waMessage() {
  return [
    "Hi Eutility, I'd like to switch my electricity plan.",
    '',
    ...(kwh ? [`Usage: ${kwh} kWh/month`] : []),
    ...(rate ? [`Current retailer: ${current.retailer}`, `Current rate: ${rate}¢/kWh`] : [`Current plan: ${current.retailer} – ${current.name}`]),
    ...(plan ? [`Selected plan: ${plan.retailer} – ${plan.name}`] : []),
    '(sent from the Eutility website)',
  ].join('\n');
}

async function call(body) {
  const res = await fetch(API, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { headers: { Accept: 'application/json' } });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || 'Something went wrong. Please try again.'), { code: out.code, errors: out.errors });
  return out;
}

// ── the plan they picked, as the calculator priced it ──
function showContext() {
  if (!plan || !kwh) return;
  const row = compare({ kwh, currentId: current.id, currentRate: rate, contract: 'any', includeReferralOnly: true }).results.find((r) => r.plan.id === plan.id);
  context.innerHTML = `
    <div class="card card--blue" style="display:grid;gap:4px">
      <span class="small">Switching to</span>
      <strong style="font-size:18px;color:var(--text)">${esc(plan.retailer)} · ${esc(plan.name)}</strong>
      <span class="small">${esc(rateLabel(plan))} · ${contractLabel(plan.contractMonths)}</span>
      ${row && row.savingYearly > 0 ? `<span class="small">Estimated saving: <strong>${fmtMoney(row.savingYearly)}/year</strong> at ${kwh.toLocaleString('en-SG')} kWh a month</span>` : ''}
    </div>`;
}

const field = (id, label, value, { type = 'text', help = '', autocomplete = '', placeholder = '', inputmode = '' } = {}) => `
  <div class="field">
    <label class="field__label" for="${id}">${label}</label>
    <input class="input" id="${id}" type="${type}" value="${esc(value)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(placeholder)}" aria-describedby="${id}-err">
    ${help ? `<p class="field__help">${help}</p>` : ''}
    <p class="field__error" id="${id}-err" hidden></p>
  </div>`;

const waButton = (label = 'Switch on WhatsApp instead') => `<button class="btn btn--wa-outline" type="button" data-wa-fallback>${I.chat}<span>${label}</span></button>`;

function panel() {
  if (s.step === 0) {
    return `
      <p>We’ll send a 6-digit code to check it’s your number. Your WhatsApp confirmation goes to the same number.</p>
      ${field('sw-phone', 'Mobile number', s.phone, { type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '9123 4567' })}
      ${s.codeToken ? `
        ${field('sw-code', '6-digit code', s.code, { inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: '123456' })}
        ${s.demoCode ? `<p class="small muted-note">Testing: no SMS is sent yet. Your code is <strong>${esc(s.demoCode)}</strong>.</p>` : ''}
        <button class="link-arrow" type="button" data-resend>Send a new code</button>` : ''}`;
  }
  if (s.step === 1) {
    return `
      ${field('sw-name', 'Full name', s.fullName, { autocomplete: 'name', placeholder: 'As per NRIC' })}
      ${field('sw-email', 'Email', s.email, { type: 'email', autocomplete: 'email', placeholder: 'you@example.com' })}
      ${field('sw-address', 'Address', s.address, { autocomplete: 'street-address', placeholder: 'e.g. Blk 123 Tampines St 11 #08-45' })}
      ${field('sw-postal', 'Postal code', s.postal, { inputmode: 'numeric', autocomplete: 'postal-code', placeholder: '521123' })}
      <div class="field">
        <label class="field__label" for="sw-unit">Home type</label>
        <select class="select" id="sw-unit" aria-describedby="sw-unit-err">
          <option value="">Choose…</option>
          ${s.unitTypes.map((u) => `<option value="${esc(u.code)}"${u.code === s.unitType ? ' selected' : ''}>${esc(u.label)}</option>`).join('')}
        </select>
        <p class="field__error" id="sw-unit-err" hidden></p>
      </div>
      ${field('sw-account', 'SP account number (optional)', s.spAccount, { inputmode: 'numeric', placeholder: '1234567890', help: 'The 10-digit number on your SP bill. It speeds up the switch.' })}
      <label class="switch" style="align-items:flex-start">
        <input type="checkbox" id="sw-terms"${s.terms ? ' checked' : ''} aria-describedby="sw-terms-err"><span class="switch__track"></span>
        <span style="font-weight:400;font-size:14px;line-height:1.5">I agree to the <a href="legal.html#terms" target="_blank" rel="noopener">Terms and Conditions</a> and <a href="legal.html#privacy" target="_blank" rel="noopener">Privacy Statement</a>, and to Eutility arranging this switch for me.</span>
      </label>
      <p class="field__error" id="sw-terms-err" hidden></p>
      <label class="switch" style="align-items:flex-start">
        <input type="checkbox" id="sw-contact"${s.contact ? ' checked' : ''}><span class="switch__track"></span>
        <span style="font-weight:400;font-size:14px;line-height:1.5">Eutility may contact me on WhatsApp, phone or email about my electricity plan. (Optional)</span>
      </label>`;
  }
  const p = s.fx.plan;
  return `
    <div class="review-list">
      <div><span>Plan</span><span>${esc(p.retailer)} · ${esc(p.name)}</span></div>
      <div><span>Price</span><span>${esc(p.rateLabel)}</span></div>
      <div><span>Contract</span><span>${esc(p.contractLabel)}</span></div>
      ${p.earlyTermination ? `<div><span>Early termination</span><span>${esc(p.earlyTermination)}</span></div>` : ''}
      ${p.monthly != null ? `<div><span>Estimated bill</span><span>${fmtMoney(p.monthly, 2)} a month</span></div>` : ''}
      ${p.savingYearly > 0 ? `<div><span>Estimated saving</span><span>${fmtMoney(p.savingYearly)} a year vs SP Group’s tariff</span></div>` : ''}
      <div><span>Name</span><span>${esc(s.fullName)}</span></div>
      <div><span>Address</span><span>${esc(`${s.address}, Singapore ${s.postal}`)}</span></div>
    </div>
    <p class="small">${s.fx.factSheetUrl ? `Please read the plan’s <a href="${esc(s.fx.factSheetUrl)}" target="_blank" rel="noopener">fact sheet</a>` : 'The retailer’s fact sheet will be sent to you with your confirmation'}${s.fx.emaAdvisoryUrl ? ` and EMA’s <a href="${esc(s.fx.emaAdvisoryUrl)}" target="_blank" rel="noopener">advisory for consumers</a>` : ''} before you confirm.</p>
    ${field('sw-promo', 'Promotion code (optional)', s.promoCode, { placeholder: 'If you have one', help: p.promo ? `This plan has a retailer promotion: ${esc(p.promo.title || p.promo.value || '')}${p.promo.title && p.promo.value && !p.promo.title.includes(p.promo.value) ? `, ${esc(p.promo.value)}` : ''}.` : '' })}`;
}

function render() {
  if (s.done) {
    card.innerHTML = `
      <div class="stack" style="--stack:14px">
        <p class="eyebrow" style="color:var(--green-aa)">You’re signed up</p>
        <h2 class="h3">${esc(s.fx.plan.retailer)} · ${esc(s.fx.plan.name)}</h2>
        <p>You’ll get a confirmation on WhatsApp shortly. ${s.done.duplicate ? 'We already had this switch from you, so nothing was sent twice.' : 'We’ll arrange the switch with the retailer and keep you posted there.'}</p>
        ${s.promoCode && !s.done.promoApplied ? '<p class="small">Your promotion code didn’t apply to this plan, so the switch went ahead without it.</p>' : ''}
        ${s.done.reference ? `<p class="small">Reference: <strong>${esc(s.done.reference)}</strong></p>` : ''}
        <a class="btn btn--secondary" href="index.html">Back to the home page</a>
      </div>`;
    return;
  }
  const last = s.step === 2;
  card.innerHTML = `
    <div class="wizard">
      <div class="wizard__steps" aria-label="Progress">
        ${STEPS.map((t, i) => `<span class="wizard__step ${i === s.step ? 'is-active' : i < s.step ? 'is-done' : ''}"><i></i>${t}</span>`).join('')}
      </div>
      <div>
        <h2 class="calc-card__title">${last ? 'Check and confirm' : STEPS[s.step]}</h2>
        <p class="small">Step ${s.step + 1} of 3</p>
      </div>
      <div class="wizard__panel">${panel()}</div>
      <p class="field__error" id="sw-form-err" role="alert" hidden></p>
      <div class="wizard__nav">
        ${s.step === 1 ? '<button class="btn btn--neutral" type="button" data-back>Back</button>' : '<span></span>'}
        <button class="btn" type="button" data-next${s.busy ? ' disabled' : ''}>${s.busy ? 'Please wait…' : last ? 'Confirm switch' : s.step === 0 ? (s.codeToken ? 'Confirm my number' : 'Send code') : 'Continue'}</button>
      </div>
    </div>`;
  wire();
}

function wire() {
  const bind = (id, key) => card.querySelector('#' + id)?.addEventListener('input', (e) => { s[key] = e.target.value; });
  bind('sw-phone', 'phone'); bind('sw-code', 'code'); bind('sw-name', 'fullName'); bind('sw-email', 'email');
  bind('sw-address', 'address'); bind('sw-postal', 'postal'); bind('sw-account', 'spAccount'); bind('sw-promo', 'promoCode');
  card.querySelector('#sw-unit')?.addEventListener('change', (e) => { s.unitType = e.target.value; });
  card.querySelector('#sw-terms')?.addEventListener('change', (e) => { s.terms = e.target.checked; });
  card.querySelector('#sw-contact')?.addEventListener('change', (e) => { s.contact = e.target.checked; });
  card.querySelectorAll('select.select').forEach(enhanceSelect);
  card.querySelector('[data-back]')?.addEventListener('click', () => { s.step--; render(); });
  card.querySelector('[data-resend]')?.addEventListener('click', () => { s.codeToken = ''; s.code = ''; s.demoCode = ''; next(); });
  card.querySelector('[data-next]').addEventListener('click', next);
  card.querySelectorAll('input.input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } }));
  wireFallback(card);
}

function wireFallback(root) {
  root.querySelectorAll('[data-wa-fallback]').forEach((b) => b.addEventListener('click', () => { track('switch_whatsapp_fallback'); openWhatsApp(waMessage()); }));
}

const FIELD_IDS = { fullName: 'sw-name', email: 'sw-email', address: 'sw-address', postal: 'sw-postal', unitType: 'sw-unit', spAccount: 'sw-account', termsAccepted: 'sw-terms' };

function showErrors(errors = {}, formMsg = '', fallback = false) {
  for (const [key, id] of Object.entries({ ...FIELD_IDS, phone: 'sw-phone', code: 'sw-code' })) {
    const err = card.querySelector(`#${id}-err`);
    if (!err) continue;
    err.textContent = errors[key] || '';
    err.hidden = !errors[key];
    card.querySelector('#' + id)?.setAttribute('aria-invalid', String(!!errors[key]));
  }
  const f = card.querySelector('#sw-form-err');
  f.innerHTML = formMsg ? `${esc(formMsg)}${fallback ? `<span style="display:block;margin-top:10px">${waButton()}</span>` : ''}` : '';
  f.hidden = !formMsg;
  wireFallback(f);
  card.querySelector('[aria-invalid="true"]')?.focus();
}

async function next() {
  if (s.busy) return;
  s.busy = true;
  render();
  let errors = {};
  let msg = '';
  let fallback = false;
  try {
    if (s.step === 0 && !s.codeToken) {
      const r = await call({ step: 'code', phone: s.phone });
      Object.assign(s, { codeToken: r.codeToken, demoCode: r.demoCode || '', code: '' });
    } else if (s.step === 0) {
      const r = await call({ step: 'verify', phone: s.phone, code: s.code, codeToken: s.codeToken });
      Object.assign(s, { verifiedToken: r.verifiedToken, step: 1 });
      track('switch_number_confirmed');
    } else if (s.step === 1) {
      s.fx = await call({
        step: 'details', verifiedToken: s.verifiedToken, plan: { id: plan.id, retailer: plan.retailer, name: plan.name }, kwh,
        currentRetailer: current.retailer, fullName: s.fullName, email: s.email, address: s.address, postal: s.postal,
        unitType: s.unitType, spAccount: s.spAccount, referralCode: referredBy() || '', termsAccepted: s.terms, contactConsent: s.contact,
      });
      s.step = 2;
    } else {
      s.done = await call({ step: 'confirm', verifiedToken: s.verifiedToken, planId: s.fx.plan.id, promoCode: s.promoCode });
      track('switch_signed_up', { plan: plan.id });
    }
  } catch (e) {
    if (e.code === 'not_verified') { Object.assign(s, { step: 0, codeToken: '', verifiedToken: '' }); }
    if (e.code === 'expired') { s.codeToken = ''; s.demoCode = ''; }
    errors = e.errors || (e.code === 'invalid_phone' || e.code === 'not_a_test_number' ? { phone: e.message } : e.code === 'invalid_code' ? { code: e.message } : {});
    msg = e.errors ? e.message : Object.keys(errors).length ? '' : e.message;
    fallback = ['not_a_test_number', 'plan_not_found', 'not_available', 'FXMEDIA_UNREACHABLE'].includes(e.code) || !e.code;
    if (e.code === 'not_a_test_number') msg = 'You can still switch on WhatsApp in the meantime.';
  }
  s.busy = false;
  render();
  if (msg || Object.keys(errors).length) showErrors(errors, msg, fallback);
  else card.querySelector('input.input')?.focus();
}

async function start() {
  if (!plan || !kwh) {
    card.innerHTML = `
      <div class="stack" style="--stack:14px">
        <h2 class="h3">Choose a plan first</h2>
        <p>Check your savings, then tap Switch on the plan you’d like.</p>
        <a class="btn" href="calculator.html">Check my savings</a>
      </div>`;
    return;
  }
  showContext();
  card.innerHTML = '<p class="small" role="status">Loading…</p>';
  try {
    s.unitTypes = (await call()).unitTypes || [];
    render();
  } catch (e) {
    card.innerHTML = `
      <div class="stack" style="--stack:14px">
        <h2 class="h3">Online switching isn’t available right now</h2>
        <p>${esc(e.message)}</p>
        <div>${waButton('Switch on WhatsApp')}</div>
      </div>`;
    wireFallback(card);
  }
}

start();
