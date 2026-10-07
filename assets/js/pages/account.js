// Customer dashboard (mock): profile, electricity details, saved savings checks,
// bills and a rewards snapshot. All data comes from the services layer.
import { initLayout, openWhatsApp, toast, initials } from '../layout.js';
import { CONFIG } from '../config.js';
import { getPlan, fmtMoney, rateLabel, contractLabel } from '../calc.js';
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
      <p class="small">Prototype: accounts live in this browser only, so nothing you enter reaches Eutility yet.</p>
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

  root.innerHTML = `
    <div class="stack" style="--stack:28px">
      <div class="stack" style="--stack:10px">
        <p class="eyebrow">My account</p>
        <h1 class="h1">Hello, ${esc(customer.firstName())}.</h1>
        <p class="lead">${best ? `Your last check found you could save <strong class="text-orange">${fmtMoney(best.savingYearly)}</strong> a year.` : 'You haven’t run a savings check yet.'}</p>
      </div>

      <div class="dash-grid">
        <div class="stack" style="--stack:20px">
          <div class="dash-card">
            <div style="display:flex;gap:14px;align-items:center">
              <span class="dash-avatar">${esc(initials(c.fullName))}</span>
              <div>
                <strong style="display:block;font-size:17px;color:var(--text)">${esc(c.fullName)}</strong>
                <span class="small">${esc(c.id)} · joined ${fmtDate(c.createdAt)}</span>
              </div>
            </div>
            <div class="review-list">
              <div><span>Email</span><span>${esc(c.email)}</span></div>
              <div><span>Mobile</span><span>${esc(c.phone)}</span></div>
              <div><span>Address</span><span>${esc([c.address, c.unit, c.postal ? `Singapore ${c.postal}` : ''].filter(Boolean).join(', ') || '—')}</span></div>
              <div><span>Home type</span><span>${esc(c.dwelling || '—')}</span></div>
            </div>
            <a class="btn btn--neutral btn--block btn--sm" href="signup.html">Update my details</a>
          </div>

          <div class="dash-card">
            <h2 class="h4">Rewards</h2>
            <div class="lb-light progress">
              <div style="display:flex;justify-content:space-between;font-size:14px"><span>${st.switched} of ${st.target} switches</span><span class="small">${st.toNext} to next reward</span></div>
              <div class="progress__track"><div class="progress__fill" style="width:${st.progressPct}%"></div></div>
            </div>
            <p class="small">${esc(CONFIG.rewards.programmeName)} · sample figures until the programme goes live.</p>
            <a class="btn btn--secondary btn--block btn--sm" href="referrals.html">See the leaderboard</a>
          </div>
        </div>

        <div class="stack" style="--stack:20px">
          <div class="dash-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
              <h2 class="h4">My electricity</h2>
              <a class="link-arrow" href="calculator.html?${esc(new URLSearchParams({ kwh: isNum(kwh) ? kwh : '', plan: c.currentPlanId || '', run: '1' }))}" style="font-size:14px">Re-check savings</a>
            </div>
            <div class="review-list">
              <div><span>Current plan</span><span>${cur ? `${esc(cur.retailer)} · ${esc(cur.name)}` : '—'}</span></div>
              <div><span>Price</span><span>${cur ? esc(rateLabel(cur)) : '—'}</span></div>
              <div><span>Contract</span><span>${cur ? esc(contractLabel(cur.contractMonths)) : '—'}</span></div>
              <div><span>Monthly usage</span><span>${isNum(kwh) && kwh > 0 ? `${kwh.toLocaleString('en-SG')} kWh` : '—'}</span></div>
              <div><span>SP account</span><span>${esc(c.accountNo || 'Not added')}</span></div>
              ${target ? `<div><span>Interested in</span><span>${esc(target.retailer)} · ${esc(target.name)}</span></div>` : ''}
            </div>
          </div>

          <div class="dash-card">
            <h2 class="h4">Savings checks</h2>
            ${checks.length ? checks.map((k) => `
              <div class="history-row">
                <div class="history-row__top">
                  <strong style="color:var(--text)">${esc(k.bestPlanName || 'Savings check')}</strong>
                  ${isNum(k.savingYearly) ? `<span class="history-row__save">${fmtMoney(k.savingYearly)}<span class="small" style="color:var(--muted)">/yr</span></span>` : ''}
                </div>
                <span class="small">${fmtDate(k.at)}${isNum(Number(k.kwh)) ? ` · ${Number(k.kwh).toLocaleString('en-SG')} kWh/month` : ''}${k.currentPlanName ? ` · from ${esc(k.currentPlanName)}` : ''}${k.sample ? ' · sample' : ''}</span>
              </div>`).join('')
            : `<div class="empty"><p>No checks saved yet</p><a class="btn btn--sm" href="calculator.html">Check my savings</a></div>`}
          </div>

          <div class="dash-card">
            <h2 class="h4">My bills</h2>
            ${bills.length ? bills.map((b) => `
              <div class="file-chip">
                ${safeImg(b.dataUrl) ? `<img src="${safeImg(b.dataUrl)}" alt="">` : `<span class="activity-row__icon">${I.upload}</span>`}
                <span class="file-chip__meta"><strong>${esc(b.name || 'Bill')}</strong><span class="small">${isNum(b.size) ? `${Math.max(1, Math.round(b.size / 1024))} KB · ` : ''}${fmtDate(b.at)}${b.sample ? ' · sample' : ''}</span></span>
              </div>`).join('')
            : `<div class="empty"><p>No bill uploaded yet</p><a class="btn btn--sm btn--secondary" href="signup.html">Upload a bill</a></div>`}
            <p class="small">Prototype: bills are kept in this browser only and are not sent to Eutility.</p>
          </div>

          <div class="dash-card">
            <h2 class="h4">Need a hand?</h2>
            <p>We can check your contract dates, confirm a plan, or just answer a question.</p>
            <button class="btn btn--secondary btn--block" type="button" data-wa-help>${I.chat}<span>Chat on WhatsApp</span></button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;border-top:1px solid var(--border);padding-top:20px">
        <p class="small" style="max-width:520px">This prototype keeps everything in this browser. “Clear demo data” removes your profile, checks and bills from it.</p>
        <div style="display:flex;gap:12px">
          <button class="btn btn--neutral btn--sm" type="button" data-signout>Log out</button>
          <button class="btn btn--neutral btn--sm" type="button" data-clear style="color:var(--red-aa)">Clear demo data</button>
        </div>
      </div>
    </div>`;

  root.querySelector('[data-wa-help]').addEventListener('click', () => openWhatsApp(
    `Hi Eutility, this is ${c.fullName}. I have a question about my electricity plan.`,
  ));
  root.querySelector('[data-signout]').addEventListener('click', () => { customer.signOut(); location.reload(); });
  root.querySelector('[data-clear]').addEventListener('click', () => {
    customer.clearDemoData();
    toast('Demo data cleared');
    setTimeout(() => location.reload(), 600);
  });
}

customer.isSignedIn() ? dashboard() : signedOut();
