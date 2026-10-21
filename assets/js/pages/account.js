// Customer dashboard (mock): profile, electricity details, saved savings checks,
// bills and rewards. All data comes from the services layer.
// Laid out like GitHub's settings: a sidebar of sections on the left, one
// section at a time on the right. The address bar keeps the section (#bills),
// so Back and shared links work.
import { initLayout, openWhatsApp, initials, photoFallbacks } from '../layout.js';
import { CONFIG } from '../config.js';
import { getPlan, fmtMoney, rateLabel, contractLabel } from '../calc.js';
import { photo } from '../data/photos.js';
import * as customer from '../services/customer.js';
import * as rewards from '../services/rewards.js';
import * as I from '../icons.js';

initLayout();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = document.getElementById('account-root');
const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' });
};
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const safeImg = (u) => (typeof u === 'string' && /^data:image\/(png|jpe?g|webp|gif|heic);base64,[a-z0-9+/=]+$/i.test(u) ? u : '');
const pts = rewards.fmtPts;

const ico = (name, tone) => `<span class="ico-tile ico-tile--${tone}">${I[name]}</span>`;
const tile = (icon, tone, value, label, href) => `<a class="acct-tile" href="${href}">${ico(icon, tone)}<strong>${value}</strong><span class="small">${label}</span></a>`;
const head = (title, action = '') => `<div class="acct-head"><h1 class="h2">${title}</h1>${action}</div>`;
const action = (href, icon, tone, title, text) => `<a class="acct-action" href="${href}">${ico(icon, tone)}<span><strong>${title}</strong><span class="small">${text}</span></span>${I.chevron}</a>`;

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'electricity', label: 'My electricity', icon: 'plug' },
  { id: 'checks', label: 'Savings checks', icon: 'calc' },
  { id: 'bills', label: 'My bills', icon: 'file' },
  { id: 'rewards', label: 'Rewards', icon: 'gift' },
  { id: 'details', label: 'My details', icon: 'user' },
  { id: 'help', label: 'Help', icon: 'help' },
];

function signedOut() {
  root.innerHTML = `
    <div class="stack text-center" style="--stack:18px;max-width:520px;margin-inline:auto;padding-block:clamp(32px,6vw,80px)">
      <span class="dash-avatar" style="margin-inline:auto">${I.user}</span>
      <h1 class="h1">Your account</h1>
      <p class="lead">Keep your bill, your past checks and your plan details in one place, so you don’t have to dig them out again.</p>
      <div class="stack" style="--stack:12px">
        <a class="btn btn--block" href="login.html?next=account.html">Log in</a>
        <a class="btn btn--secondary btn--block" href="signup.html">Create my account</a>
        <a class="btn btn--neutral btn--block" href="calculator.html">Check my savings first</a>
      </div>
    </div>`;
}

function dashboard() {
  const c = customer.get();
  const checks = customer.listChecks();
  const bills = customer.listBills();
  const cur = getPlan(c.currentPlanId);
  const target = getPlan(c.intendedPlanId);
  const st = rewards.myStatus();
  const best = checks.find((k) => isNum(k.savingYearly));
  const kwh = Number(c.monthlyKwh);
  const recheck = `calculator.html?${esc(new URLSearchParams({ kwh: isNum(kwh) ? kwh : '', plan: c.currentPlanId || '', run: '1' }))}`;

  const panels = {
    overview: `
      <div class="acct-hero">
        <div class="photo-frame">${photo('estate', { sizes: '(min-width: 1024px) 70vw, 100vw' })}</div>
        <div class="acct-hero__text">
          <p class="eyebrow">My account</p>
          <h1 class="h1">Hello, ${esc(customer.firstName())}.</h1>
          <p class="lead">${best ? `Your last check found you could save <strong class="text-orange">${fmtMoney(best.savingYearly)}</strong> a year.` : 'You haven’t run a savings check yet.'}</p>
        </div>
      </div>
      <div class="acct-tiles">
        ${tile('calc', 'blue', best ? `${fmtMoney(best.savingYearly)}/yr` : '—', 'Best saving found', '#checks')}
        ${tile('plug', 'navy', cur ? esc(cur.retailer) : 'Not set', 'Current retailer', '#electricity')}
        ${tile('file', 'orange', String(bills.length), bills.length === 1 ? 'Bill on file' : 'Bills on file', '#bills')}
        ${tile('gift', 'red', pts(st.points), 'Reward points', '#rewards')}
      </div>
      <div class="dash-card">
        <h2 class="h4">Next steps</h2>
        <div class="acct-actions">
          ${action(recheck, 'calc', 'blue', 'Re-check my savings', 'Retailers change their rates often.')}
          ${action('signup.html', 'upload', 'orange', 'Upload my latest bill', 'We use it to arrange your switch.')}
          ${action('referrals.html', 'gift', 'red', 'Share my referral link', `${pts(CONFIG.rewards.pointsPerSwitch)} for every friend who switches.`)}
        </div>
      </div>`,

    electricity: `
      ${head('My electricity', `<a class="btn btn--sm" href="${recheck}">Re-check savings</a>`)}
      <div class="dash-card">
        <div class="review-list">
          <div><span>Current plan</span><span>${cur ? `${esc(cur.retailer)} · ${esc(cur.name)}` : '—'}</span></div>
          <div><span>Price</span><span>${cur ? esc(rateLabel(cur)) : '—'}</span></div>
          <div><span>Contract</span><span>${cur ? esc(contractLabel(cur.contractMonths)) : '—'}</span></div>
          <div><span>Monthly usage</span><span>${isNum(kwh) && kwh > 0 ? `${kwh.toLocaleString('en-SG')} kWh` : '—'}</span></div>
          <div><span>SP account</span><span>${esc(c.accountNo || 'Not added')}</span></div>
          ${target ? `<div><span>Interested in</span><span>${esc(target.retailer)} · ${esc(target.name)}</span></div>` : ''}
        </div>
      </div>`,

    checks: `
      ${head('Savings checks', '<a class="btn btn--sm" href="calculator.html">New check</a>')}
      <div class="dash-card">
        ${checks.length ? checks.map((k) => `
          <div class="history-row">
            <div class="history-row__top">
              <strong style="color:var(--text)">${esc(k.bestPlanName || 'Savings check')}</strong>
              ${isNum(k.savingYearly) ? `<span class="history-row__save">${fmtMoney(k.savingYearly)}<span class="small" style="color:var(--muted)">/yr</span></span>` : ''}
            </div>
            <span class="small">${fmtDate(k.at)}${isNum(Number(k.kwh)) ? ` · ${Number(k.kwh).toLocaleString('en-SG')} kWh/month` : ''}${k.currentPlanName ? ` · from ${esc(k.currentPlanName)}` : ''}</span>
          </div>`).join('')
        : '<div class="empty"><p>No checks saved yet</p><a class="btn btn--sm" href="calculator.html">Check my savings</a></div>'}
      </div>`,

    bills: `
      ${head('My bills', '<a class="btn btn--sm btn--secondary" href="signup.html">Upload a bill</a>')}
      <div class="dash-card">
        ${bills.length ? bills.map((b) => `
          <div class="file-chip">
            ${safeImg(b.dataUrl) ? `<img src="${safeImg(b.dataUrl)}" alt="">` : `<span class="activity-row__icon">${I.upload}</span>`}
            <span class="file-chip__meta"><strong>${esc(b.name || 'Bill')}</strong><span class="small">${isNum(b.size) ? `${Math.max(1, Math.round(b.size / 1024))} KB · ` : ''}${fmtDate(b.at)}</span></span>
          </div>`).join('')
        : '<div class="empty"><p>No bill uploaded yet</p></div>'}
        <p class="small">Bills you add are sent to Eutility to arrange your switch.</p>
      </div>`,

    rewards: `
      ${head(esc(CONFIG.rewards.programmeName), '<a class="btn btn--sm" href="referrals.html">See every reward</a>')}
      <div class="dash-card">
        <p class="acct-points">${st.points.toLocaleString('en-SG')}<span> pts</span></p>
        <div class="lb-light progress">
          <div style="display:flex;justify-content:space-between;gap:12px;font-size:14px"><span>${st.switched} friend${st.switched === 1 ? '' : 's'} switched</span><span class="small">${st.next ? `Next up: ${esc(st.next.name)}, ${pts(st.next.points - st.points)} to go` : 'Everything unlocked'}</span></div>
          <div class="progress__track"><div class="progress__fill" style="width:${st.nextPct}%"></div></div>
        </div>
        <div class="acct-rewards">${rewards.catalogue().slice(1, 5).map((r) => `<figure><img src="${r.src}" alt="" loading="lazy" width="600" height="600"><figcaption>${esc(r.name)}<span>${pts(r.points)}</span></figcaption></figure>`).join('')}</div>
      </div>`,

    details: `
      ${head('My details', '<a class="btn btn--sm btn--secondary" href="signup.html">Update</a>')}
      <div class="dash-card">
        <div class="review-list">
          <div><span>Name</span><span>${esc(c.fullName)}</span></div>
          <div><span>Email</span><span>${esc(c.email)}</span></div>
          <div><span>Mobile</span><span>${esc(c.phone)}</span></div>
          <div><span>Address</span><span>${esc([c.address, c.unit, c.postal ? `Singapore ${c.postal}` : ''].filter(Boolean).join(', ') || '—')}</span></div>
          <div><span>Home type</span><span>${esc(c.dwelling || '—')}</span></div>
          <div><span>Customer ID</span><span>${esc(c.id)}</span></div>
          <div><span>Joined</span><span>${fmtDate(c.createdAt)}</span></div>
        </div>
      </div>`,

    help: `
      ${head('Help')}
      <div class="dash-card">
        <p>We can check your contract dates, confirm a plan, or just answer a question.</p>
        <div class="btn-row">
          <button class="btn btn--wa" type="button" data-wa-help>${I.chat}<span>Chat on WhatsApp</span></button>
          <a class="btn btn--secondary" href="faq.html">Read the FAQ</a>
        </div>
      </div>`,
  };

  root.innerHTML = `
    <div class="acct">
      <aside class="acct-side" aria-label="Account">
        <div class="acct-side__me">
          <span class="dash-avatar">${esc(initials(c.fullName))}</span>
          <div><strong>${esc(c.fullName)}</strong><span class="small">${esc(c.email || c.id)}</span></div>
        </div>
        <nav class="acct-nav" aria-label="Account sections">
          ${SECTIONS.map((x) => `<a href="#${x.id}" data-section="${x.id}">${I[x.icon]}<span>${x.label}</span></a>`).join('')}
          <button class="acct-nav__out" type="button" data-signout>${I.logout}<span>Log out</span></button>
        </nav>
      </aside>
      <div class="acct-main">
        ${SECTIONS.map((x) => `<section class="acct-panel stack" style="--stack:20px" data-panel="${x.id}" aria-label="${x.label}" hidden>${panels[x.id]}</section>`).join('')}
      </div>
    </div>`;

  const show = () => {
    const id = SECTIONS.some((x) => `#${x.id}` === location.hash) ? location.hash.slice(1) : 'overview';
    root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== id; });
    root.querySelectorAll('[data-section]').forEach((a) => (a.dataset.section === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    // On phones the sidebar is a scrolling strip: keep the current section in view.
    const on = root.querySelector(`[data-section="${id}"]`);
    on?.parentElement?.scrollTo?.({ left: on.offsetLeft - 16, behavior: 'smooth' });
  };
  window.addEventListener('hashchange', () => { show(); window.scrollTo({ top: 0 }); });
  show();
  photoFallbacks();

  root.querySelector('[data-wa-help]').addEventListener('click', () => openWhatsApp(
    `Hi Eutility, this is ${c.fullName}. I have a question about my electricity plan.`,
  ));
  root.querySelector('[data-signout]').addEventListener('click', () => { customer.signOut(); location.href = 'index.html'; });
}

customer.isSignedIn() ? dashboard() : signedOut();
