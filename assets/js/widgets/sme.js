// SME multi-site load aggregation widget.
import { CONFIG } from '../config.js';
import { smeEstimate, fmtMoney, TARIFF, TARIFF_PERIOD } from '../calc.js';
import { openWhatsApp, openEmail, toast } from '../layout.js';
import { countUp } from '../fx.js';
import * as I from '../icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usage = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

export function mountSme(root) {
  let sites = [{ name: '', kwh: '' }, { name: '', kwh: '' }];
  let company = '';
  let lastYearly = 0;

  root.innerHTML = `
  <div class="grid-2 grid-2--top grid-sme">
    <form class="card card--shadow calc-card" novalidate aria-labelledby="sme-title">
      <h2 class="calc-card__title" id="sme-title">Your business</h2>
      <div class="field">
        <label class="field__label" for="sme-company">Company name</label>
        <input class="input" id="sme-company" autocomplete="organization" placeholder="e.g. Tan &amp; Co Pte Ltd">
        <p class="field__error" id="sme-company-err" hidden>Enter your company name.</p>
      </div>
      <div class="stack" style="--stack:12px">
        <div>
          <p class="h4">Sites</p>
          <p class="field__help">Add each location with its own electricity account. We combine them to ask retailers for one better rate.</p>
        </div>
        <div class="stack" style="--stack:12px" id="sme-sites"></div>
        <button class="btn btn--dashed" type="button" id="sme-add">+ Add site</button>
      </div>
    </form>

    <aside class="sticky-col" aria-label="Estimate summary">
      <div class="card card--blue stack" style="--stack:16px">
        <h2 class="h3">Summary</h2>
        <div class="summary-row"><span>Company</span><strong id="sme-sum-company">—</strong></div>
        <div class="summary-row"><span>Sites</span><strong id="sme-sum-sites">0</strong></div>
        <div class="summary-row"><span>Total monthly usage</span><strong class="num" style="font-size:20px" id="sme-sum-kwh">0 kWh</strong></div>
        <div class="tier-meter" aria-live="polite">
          <div class="summary-row"><span>Volume tier</span><span class="pill pill--blue" id="sme-tier">Starter</span></div>
          <div class="tier-meter__track"><div class="tier-meter__fill" id="sme-meter" style="width:0%"></div></div>
          <div class="tier-meter__labels">${CONFIG.smeTiers.map((t) => `<span>${t.label}</span>`).join('')}</div>
          <p class="small" id="sme-nudge"></p>
        </div>
        <hr class="rule rule--blue">
        <div class="reveal-num reveal-num--sm">
          <p style="color:var(--slate)">Illustrative savings</p>
          <p class="reveal-num__big">S$<span id="sme-save">0</span><small>/year</small></p>
          <p class="small" id="sme-rate"></p>
        </div>
        <button class="btn btn--block" type="button" id="sme-talk">${I.chat}<span>Get my quote on WhatsApp</span></button>
        <button class="btn btn--secondary btn--block" type="button" id="sme-mail">${I.mail}<span>Email us instead</span></button>
        <p class="small">No account needed. Your sites and usage go straight to a Eutility consultant. This figure is illustrative only: a consultant confirms a firm quote with you, and business clients get a dedicated account manager.</p>
      </div>
    </aside>
  </div>`;

  const list = root.querySelector('#sme-sites');
  const addBtn = root.querySelector('#sme-add');
  const companyEl = root.querySelector('#sme-company');

  function renderSites(focusIdx) {
    list.innerHTML = sites.map((s, i) => `
      <div class="site-row" data-i="${i}">
        <div class="site-row__head">
          <strong>Site ${i + 1}</strong>
          ${sites.length > 1 ? `<button class="site-row__remove" type="button" data-remove="${i}" aria-label="Remove site ${i + 1}">Remove</button>` : ''}
        </div>
        <div class="field">
          <label class="field__label" for="sme-n-${i}">Site name</label>
          <input class="input" id="sme-n-${i}" data-k="name" value="${esc(s.name)}" placeholder="${i === 0 ? 'e.g. Tampines outlet' : 'Site name'}">
        </div>
        <div class="field">
          <label class="field__label" for="sme-u-${i}">Monthly usage</label>
          <div class="input-suffix"><input class="input" id="sme-u-${i}" data-k="kwh" type="number" inputmode="numeric" min="1" max="10000000" value="${esc(s.kwh)}" placeholder="e.g. 2000"><span>kWh</span></div>
        </div>
      </div>`).join('');
    addBtn.disabled = sites.length >= CONFIG.smeMaxSites;
    if (focusIdx != null) list.querySelector(`#sme-n-${focusIdx}`)?.focus();
  }

  list.addEventListener('input', (e) => {
    const row = e.target.closest('.site-row');
    if (!row) return;
    sites[Number(row.dataset.i)][e.target.dataset.k] = e.target.value;
    update();
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    sites.splice(Number(b.dataset.remove), 1);
    renderSites();
    update();
    toast('Site removed');
  });
  addBtn.addEventListener('click', () => {
    sites.push({ name: '', kwh: '' });
    renderSites(sites.length - 1);
    update();
  });
  companyEl.addEventListener('input', () => {
    company = companyEl.value.trim();
    root.querySelector('#sme-company-err').hidden = true;
    companyEl.removeAttribute('aria-invalid');
    update();
  });

  let debounce;
  function update() {
    const est = smeEstimate(sites);
    root.querySelector('#sme-sum-company').textContent = company || '—';
    root.querySelector('#sme-sum-sites').textContent = est.siteCount;
    root.querySelector('#sme-sum-kwh').textContent = est.totalKwh.toLocaleString('en-SG') + ' kWh';
    root.querySelector('#sme-tier').textContent = est.tier.label;
    const tiers = CONFIG.smeTiers;
    const idx = tiers.indexOf(est.tier);
    const seg = 100 / (tiers.length - 1);
    const within = est.next ? (est.totalKwh - est.tier.minKwh) / (est.next.minKwh - est.tier.minKwh) : 0;
    root.querySelector('#sme-meter').style.width = Math.min(100, idx * seg + within * seg) + '%';
    root.querySelector('#sme-nudge').textContent = 'Larger combined usage can qualify for better rates. A consultant confirms what’s available.';
    root.querySelector('#sme-rate').textContent = est.totalKwh
      ? `Illustrative rate ${est.aggRate}¢/kWh vs SP Group’s regulated tariff ${TARIFF}¢/kWh (${TARIFF_PERIOD}). Assumes all sites are on the regulated tariff today.`
      : 'Enter monthly usage for at least one site.';
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const el = root.querySelector('#sme-save');
      const target = Math.max(0, est.savingYearly);
      if (target !== lastYearly) countUp(el, target, { duration: 500 });
      lastYearly = target;
    }, 250);
    return est;
  }

  // One quote request, two channels. Returns null (after showing why) if the
  // form isn't ready, so both buttons validate identically.
  function quoteMessage() {
    const est = update();
    if (!company) {
      const err = root.querySelector('#sme-company-err');
      err.hidden = false;
      companyEl.setAttribute('aria-invalid', 'true');
      companyEl.focus();
      return null;
    }
    if (!est.totalKwh) {
      list.querySelector('[data-k="kwh"]')?.focus();
      toast('Add monthly usage for at least one site.');
      return null;
    }
    // Number sites as the person sees them on screen, even if some are blank.
    const lines = sites.map((s, i) => [s, i]).filter(([s]) => usage(s.kwh) > 0)
      .map(([s, i]) => `• ${s.name.trim() || `Site ${i + 1}`}: ${usage(s.kwh).toLocaleString('en-SG')} kWh`).join('\n');
    return `Hi Eutility, I'd like a business electricity quote.\nCompany: ${company}\n${lines}\nTotal: ${est.totalKwh.toLocaleString('en-SG')} kWh/month (illustrative saving ${fmtMoney(est.savingYearly)}/year)`;
  }
  root.querySelector('#sme-talk').addEventListener('click', () => {
    const msg = quoteMessage();
    if (msg) openWhatsApp(msg);
  });
  root.querySelector('#sme-mail').addEventListener('click', () => {
    const msg = quoteMessage();
    if (msg) openEmail(msg, `Business electricity quote — ${company}`);
  });

  renderSites();
  update();
}
