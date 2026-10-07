// Sign-up wizard: your details → your home → electricity → bill → review.
// Everything is saved through the customer service (mock: this browser only).
import { initLayout, openWhatsApp, toast } from '../layout.js';
import { CONFIG } from '../config.js';
import { AVAILABLE_PLANS, getPlan, compare, fmtMoney, rateLabel, DEFAULT_CURRENT_ID } from '../calc.js';
import * as customer from '../services/customer.js';
import { confetti } from '../fx.js';
import * as I from '../icons.js';

initLayout();

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.search);
const intendedPlan = getPlan(q.get('plan'));
const existing = customer.get() || {};

const form = {
  fullName: existing.fullName || '',
  email: existing.email || '',
  phone: existing.phone || '',
  password: '',
  address: existing.address || '',
  unit: existing.unit || '',
  postal: existing.postal || '',
  dwelling: existing.dwelling || 'HDB 4-room',
  retailer: getPlan(existing.currentPlanId)?.retailer || 'SP Group',
  currentPlanId: existing.currentPlanId || DEFAULT_CURRENT_ID,
  monthlyKwh: existing.monthlyKwh || Number(q.get('kwh')) || CONFIG.defaultKwh,
  accountNo: existing.accountNo || '',
  intendedPlanId: intendedPlan?.id || existing.intendedPlanId || '',
  consent: false,
};
let bill = customer.latestBill();
let step = 0;

const STEPS = ['Your details', 'Your home', 'Electricity', 'Your bill (optional)'];
const RETAILERS = [...new Set(AVAILABLE_PLANS.map((p) => p.retailer))].sort((a, b) => (a === 'SP Group' ? -1 : b === 'SP Group' ? 1 : a.localeCompare(b)));
const card = document.getElementById('signup-card');

if (intendedPlan) {
  document.getElementById('signup-context').innerHTML = `
    <div class="card card--blue" style="display:grid;gap:4px">
      <span class="small">You're switching to</span>
      <strong style="font-size:18px;color:var(--text)">${esc(intendedPlan.retailer)} · ${esc(intendedPlan.name)}</strong>
      <span class="small">${esc(rateLabel(intendedPlan))}</span>
    </div>`;
}

const field = (id, label, value, { type = 'text', help = '', suffix = '', autocomplete = '', placeholder = '', inputmode = '' } = {}) => `
  <div class="field">
    <label class="field__label" for="${id}">${label}</label>
    ${suffix
      ? `<div class="input-suffix"><input class="input" id="${id}" type="${type}" value="${esc(value)}" ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(placeholder)}"><span>${suffix}</span></div>`
      : `<input class="input" id="${id}" type="${type}" value="${esc(value)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(placeholder)}">`}
    ${help ? `<p class="field__help">${help}</p>` : ''}
    <p class="field__error" id="${id}-err" hidden></p>
  </div>`;

function plansFor(retailer) {
  return AVAILABLE_PLANS.filter((p) => p.retailer === retailer && p.available);
}

function panel() {
  switch (step) {
    case 0:
      return `
        ${field('su-name', 'Full name', form.fullName, { autocomplete: 'name', placeholder: 'As per NRIC' })}
        ${field('su-email', 'Email', form.email, { type: 'email', autocomplete: 'email', placeholder: 'you@example.com' })}
        ${field('su-phone', 'Mobile number', form.phone, { type: 'tel', autocomplete: 'tel', placeholder: '9123 4567', help: 'We reply on WhatsApp to this number — or by email if you prefer.' })}
        ${field('su-pw', 'Create a password', form.password, { type: 'password', autocomplete: 'new-password', help: 'At least 8 characters. This is how you get back into your account.' })}`;
    case 1:
      return `
        ${field('su-address', 'Street address', form.address, { autocomplete: 'street-address', placeholder: 'e.g. 123 Tampines Street 11' })}
        <div class="field-row field-row--2">
          ${field('su-unit', 'Unit number (optional)', form.unit, { placeholder: '#12-34' })}
          ${field('su-postal', 'Postal code', form.postal, { inputmode: 'numeric', autocomplete: 'postal-code', placeholder: '520123' })}
        </div>
        <div class="field">
          <label class="field__label" for="su-dwelling">Home type</label>
          <select class="select" id="su-dwelling">
            ${customer.DWELLINGS.map((d) => `<option${d === form.dwelling ? ' selected' : ''}>${esc(d)}</option>`).join('')}
          </select>
          <p class="field__help">Retailers use this for deposits and early termination fees.</p>
        </div>`;
    case 2: {
      const list = plansFor(form.retailer);
      return `
        <div class="field">
          <label class="field__label" for="su-retailer">Current retailer</label>
          <select class="select" id="su-retailer">
            ${RETAILERS.map((r) => `<option value="${esc(r)}"${r === form.retailer ? ' selected' : ''}>${esc(r === 'SP Group' ? 'SP Group (never switched)' : r)}</option>`).join('')}
          </select>
        </div>
        <div class="field"${list.length <= 1 ? ' hidden' : ''}>
          <label class="field__label" for="su-plan">Current plan</label>
          <select class="select" id="su-plan">
            ${list.map((p) => `<option value="${p.id}"${p.id === form.currentPlanId ? ' selected' : ''}>${esc(p.name)} — ${esc(rateLabel(p))}</option>`).join('')}
          </select>
        </div>
        ${field('su-kwh', 'Average monthly usage', form.monthlyKwh, { type: 'number', suffix: 'kWh', inputmode: 'numeric', help: 'From your SP bill. Don\'t worry about being exact — we confirm it from your bill.' })}
        ${field('su-account', 'SP account number (optional)', form.accountNo, { placeholder: '1234567890', help: 'Speeds up the switch. You can add it later.' })}`;
    }
    case 3:
      return `
        <p><strong>This bit is optional.</strong> You've already told us enough to get a comparison. A photo of your bill just lets us check the exact rate you're on and catch anything the estimate missed.</p>
        <div class="dropzone" id="su-drop" tabindex="0" role="button" aria-label="Upload your bill">
          ${I.upload}
          <strong>Tap to upload your bill</strong>
          <span class="small">Photo or PDF · up to 10 MB</span>
          <input type="file" id="su-file" accept="image/*,application/pdf" hidden>
        </div>
        <div id="su-file-out"></div>
        <p class="small">Haven't got it handy? Skip it — you can add it from your account any time.</p>
        <p class="small">Prototype: files stay in this browser and are not uploaded anywhere.</p>`;
    default: {
      const cur = getPlan(form.currentPlanId);
      return `
        <div class="review-list">
          <div><span>Name</span><span>${esc(form.fullName)}</span></div>
          <div><span>Email</span><span>${esc(form.email)}</span></div>
          <div><span>Mobile</span><span>${esc(form.phone)}</span></div>
          <div><span>Address</span><span>${esc([form.address, form.unit, 'Singapore ' + form.postal].filter(Boolean).join(', '))}</span></div>
          <div><span>Home type</span><span>${esc(form.dwelling)}</span></div>
          <div><span>Current plan</span><span>${esc(cur ? `${cur.retailer} · ${cur.name}` : '—')}</span></div>
          <div><span>Monthly usage</span><span>${Number(form.monthlyKwh).toLocaleString('en-SG')} kWh</span></div>
          ${form.intendedPlanId ? `<div><span>Switching to</span><span>${esc(getPlan(form.intendedPlanId)?.retailer)} · ${esc(getPlan(form.intendedPlanId)?.name)}</span></div>` : ''}
          <div><span>Bill uploaded</span><span>${bill ? esc(bill.name) : 'Not yet'}</span></div>
        </div>
        <label class="switch" style="align-items:flex-start">
          <input type="checkbox" id="su-consent"${form.consent ? ' checked' : ''}><span class="switch__track"></span>
          <span style="font-weight:400;font-size:14px;line-height:1.5">I'd like Eutility to contact me about switching and I accept the <a href="legal.html#terms">Website Terms and Conditions</a> and <a href="legal.html#privacy">Privacy Statement</a>.</span>
        </label>
        <p class="field__error" id="su-consent-err" hidden>Please tick the box so we can contact you.</p>`;
    }
  }
}

function render() {
  const last = step === 4;
  card.innerHTML = `
    <div class="wizard">
      <div class="wizard__steps" aria-label="Progress">
        ${STEPS.map((s, i) => `<span class="wizard__step ${i === step ? 'is-active' : i < step ? 'is-done' : ''}"><i></i>${s}</span>`).join('')}
      </div>
      <div>
        <h2 class="calc-card__title">${last ? 'Check your details' : STEPS[step]}</h2>
        <p class="small">Step ${Math.min(step + 1, 4)} of 4${last ? ' · review' : ''}</p>
      </div>
      <div class="wizard__panel">${panel()}</div>
      <div class="wizard__nav">
        ${step > 0 ? '<button class="btn btn--neutral" type="button" data-back>Back</button>' : '<span></span>'}
        <button class="btn" type="button" data-next>${last ? 'Create my account' : step === 3 ? (bill ? 'Review' : 'Skip and review') : 'Continue'}</button>
      </div>
    </div>`;
  wire();
}

function wire() {
  card.querySelector('[data-back]')?.addEventListener('click', () => { step--; render(); });
  card.querySelector('[data-next]').addEventListener('click', next);
  const bind = (id, key, filter) => card.querySelector('#' + id)?.addEventListener('input', (e) => { form[key] = filter ? filter(e.target.value) : e.target.value; });
  bind('su-name', 'fullName'); bind('su-email', 'email'); bind('su-phone', 'phone'); bind('su-pw', 'password');
  bind('su-address', 'address'); bind('su-unit', 'unit'); bind('su-postal', 'postal');
  bind('su-account', 'accountNo'); bind('su-kwh', 'monthlyKwh');
  card.querySelector('#su-dwelling')?.addEventListener('change', (e) => { form.dwelling = e.target.value; });
  card.querySelector('#su-retailer')?.addEventListener('change', (e) => {
    form.retailer = e.target.value;
    const first = plansFor(form.retailer)[0];
    form.currentPlanId = first ? first.id : DEFAULT_CURRENT_ID;
    render();
  });
  card.querySelector('#su-plan')?.addEventListener('change', (e) => { form.currentPlanId = e.target.value; });
  card.querySelector('#su-consent')?.addEventListener('change', (e) => { form.consent = e.target.checked; });

  const drop = card.querySelector('#su-drop');
  if (drop) {
    const input = card.querySelector('#su-file');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragover', 'dragenter'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
    showFile();
  }
}

async function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) { toast('That file is over 10 MB'); return; }
  bill = await customer.addBill(file);
  showFile();
  toast('Bill added');
}

function showFile() {
  const out = card.querySelector('#su-file-out');
  if (!out) return;
  out.innerHTML = bill
    ? `<div class="file-chip">
         ${bill.dataUrl ? `<img src="${bill.dataUrl}" alt="">` : `<span class="activity-row__icon">${I.upload}</span>`}
         <span class="file-chip__meta"><strong>${esc(bill.name)}</strong><span class="small">${Math.round(bill.size / 1024)} KB · added just now</span></span>
         <button class="site-row__remove" type="button" data-remove>Remove</button>
       </div>`
    : '';
  out.querySelector('[data-remove]')?.addEventListener('click', () => { bill = null; showFile(); });
  // The bill step is skippable, so the button says so until a file is added.
  const nextBtn = card.querySelector('[data-next]');
  if (nextBtn && step === 3) nextBtn.textContent = bill ? 'Review' : 'Skip and review';
}

const showError = (id, msg) => {
  const el = card.querySelector('#' + id);
  const err = card.querySelector('#' + id + '-err');
  if (!err) return;
  err.textContent = msg;
  err.hidden = !msg;
  el?.setAttribute('aria-invalid', String(!!msg));
  if (msg) el?.focus();
};

function validate() {
  const v = customer.validators;
  const checks = {
    0: [['su-name', v.fullName(form.fullName)], ['su-email', v.email(form.email)], ['su-phone', v.phone(form.phone)], ['su-pw', v.password(form.password)]],
    1: [['su-address', v.address(form.address)], ['su-postal', v.postal(form.postal)]],
    2: [['su-kwh', v.kwh(form.monthlyKwh)]],
    3: [],
    4: [],
  }[step];
  let ok = true;
  for (const [id, msg] of checks) { showError(id, msg); if (msg) ok = false; }
  if (step === 4 && !form.consent) {
    card.querySelector('#su-consent-err').hidden = false;
    ok = false;
  }
  return ok;
}

function next() {
  if (!validate()) return;
  if (step < 4) { step++; render(); window.scrollTo({ top: card.offsetTop - 100, behavior: 'smooth' }); return; }
  finish();
}

function finish() {
  const saved = customer.signUp({
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    unit: form.unit.trim(),
    postal: form.postal.trim(),
    dwelling: form.dwelling,
    currentPlanId: form.currentPlanId,
    monthlyKwh: Number(form.monthlyKwh),
    accountNo: form.accountNo.trim(),
    intendedPlanId: form.intendedPlanId,
    consentAt: new Date().toISOString(),
  });
  // So they can log back in later (mock auth — see services/customer.js).
  if (form.password) customer.setPassword(saved.email, form.password);

  // Run a savings check from the details given, so the account has something in it.
  const res = compare({ kwh: saved.monthlyKwh, currentId: saved.currentPlanId, contract: '24' });
  let check = null;
  if (res.best && !res.alreadyBest) {
    check = customer.saveCheck({
      kwh: saved.monthlyKwh,
      currentPlanId: res.current.plan.id,
      currentPlanName: `${res.current.plan.retailer} · ${res.current.plan.name}`,
      bestPlanId: res.best.plan.id,
      bestPlanName: `${res.best.plan.retailer} · ${res.best.plan.name}`,
      savingYearly: res.best.savingYearly,
      savingMonthly: res.best.savingMonthly,
    });
  }

  const target = getPlan(form.intendedPlanId) || res.best?.plan;
  card.innerHTML = `
    <div class="stack text-center" style="--stack:18px">
      <div class="success-mark">${I.check}</div>
      <h2 class="h2">You're all set, ${esc(customer.firstName())}.</h2>
      ${check ? `<p class="lead">Based on what you told us, you could save <strong class="text-orange">${fmtMoney(check.savingYearly)}</strong> a year${target ? ` with ${esc(target.retailer)} ${esc(target.name)}` : ''}.</p>`
        : '<p class="lead">We\'ve saved your details. We\'ll confirm your best plan once we\'ve read your bill.</p>'}
      <div class="review-list" style="text-align:left">
        <div><span>Account</span><span>${esc(saved.id)}</span></div>
        <div><span>We'll contact you at</span><span>${esc(saved.phone)}</span></div>
        <div><span>Bill</span><span>${bill ? esc(bill.name) : 'Not uploaded yet'}</span></div>
      </div>
      <div class="stack" style="--stack:12px">
        <button class="btn btn--block" type="button" data-wa-finish>Confirm on WhatsApp</button>
        <a class="btn btn--secondary btn--block" href="account.html">Go to my account</a>
      </div>
      <p class="small">Next: we check your bill, confirm the plan with you, then submit the switch to the retailer. Your supply is never interrupted.</p>
    </div>`;
  card.querySelector('[data-wa-finish]').addEventListener('click', () => openWhatsApp(
    `Hi Eutility, I've just created an account.\nName: ${saved.fullName}\nAddress: ${[saved.address, saved.unit, saved.postal].filter(Boolean).join(', ')}\nUsage: ${saved.monthlyKwh} kWh/month${target ? `\nInterested in: ${target.retailer} ${target.name}` : ''}`,
  ));
  confetti({ count: 140 });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

render();
