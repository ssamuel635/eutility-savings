// Eutility Rewards: the member's progress, their link, then what's happened on it.
import { initLayout, toast, observeReveals, openWhatsApp } from '../layout.js';
import { CONFIG } from '../config.js';
import { countUp } from '../fx.js';
import * as rewards from '../services/rewards.js';
import * as customer from '../services/customer.js';
import * as I from '../icons.js';

initLayout();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const status = rewards.myStatus();
const link = rewards.myLink();
const display = link.replace(/^https?:\/\//, '');
const pts = rewards.fmtPts;

// ── Your points, and how far to the next item ──
const next = status.next;
document.getElementById('leaderboard').innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
    <h2 class="h3" style="display:flex;align-items:center;gap:10px"><span style="width:26px;color:#fff">${I.trophy}</span>${customer.firstName() ? `${esc(customer.firstName())}, your points` : 'Your points'}</h2>
    <span class="small" style="color:#fff">${status.switched} friend${status.switched === 1 ? '' : 's'} switched</span>
  </div>
  <p class="rewards-panel__pts">${status.points.toLocaleString('en-SG')}<span> pts</span></p>
  <div class="progress"><div class="progress__track"><div class="progress__fill" id="prog-hero"></div></div></div>
  <p class="small" style="color:#fff">${next ? `Next up: ${esc(next.name)}, ${pts(next.points - status.points)} to go. Each friend who switches earns you ${pts(CONFIG.rewards.pointsPerSwitch)}.` : 'You can redeem anything in the catalogue.'}</p>`;
document.getElementById('leaderboard').classList.replace('board-hero', 'rewards-panel');

// ── Your status, progress and link ──
const name = customer.firstName();
document.getElementById('my-status').innerHTML = `
  <div class="grid-2 grid-2--top">
    <div class="card card--shadow stack" style="--stack:18px">
      <div>
        <h2 class="calc-card__title">${name ? `Hi ${esc(name)}` : 'Your progress'}</h2>
        <p class="small">${esc(CONFIG.rewards.programmeName)}</p>
      </div>
      <div class="stats">
        <div class="stat"><span class="stat__num" data-stat="${status.shared}">0</span><span class="stat__label">Friends referred</span></div>
        <div class="stat"><span class="stat__num" data-stat="${status.switched}" style="color:var(--green-aa)">0</span><span class="stat__label">Switched &amp; counted</span></div>
        <div class="stat"><span class="stat__num" data-stat="${status.points}" style="color:var(--orange-display)">0</span><span class="stat__label">Points</span></div>
      </div>
      <div class="lb-light progress">
        <div style="display:flex;justify-content:space-between;font-size:14px"><span><strong>${pts(status.points)}</strong>${next ? ` of ${pts(next.points)}` : ''}</span><span class="small">${next ? esc(next.name) : 'Everything unlocked'}</span></div>
        <div class="progress__track"><div class="progress__fill" id="prog"></div></div>
      </div>
      ${customer.isSignedIn() ? '' : '<p class="small"><a href="signup.html">Create an account</a> to track your progress.</p>'}
    </div>

    <div class="card card--shadow stack" style="--stack:16px">
      <h2 class="calc-card__title">Your link</h2>
      <div class="ref-link"><span id="ref-link-text">${esc(display)}</span></div>
      <div class="stack" style="--stack:12px">
        <button class="btn btn--block" type="button" id="ref-copy">Copy link</button>
        <button class="btn btn--neutral btn--block" type="button" id="ref-share">Share on WhatsApp</button>
      </div>
      <p class="small">Your friend lands on our home page, and your code is added when they message us.</p>
    </div>
  </div>`;

document.getElementById('prog').style.width = status.nextPct + '%';
document.getElementById('prog-hero').style.width = status.nextPct + '%';

// ── The catalogue: a photo per item, its points and how close you are ──
document.getElementById('catalogue-lead').textContent = `Every friend who switches earns you ${pts(CONFIG.rewards.pointsPerSwitch)}. Swap them for vouchers and things for the home.`;
document.getElementById('catalogue').innerHTML = rewards.catalogue().map((r, i) => {
  const ready = status.points >= r.points;
  const pct = Math.min(100, Math.round((status.points / r.points) * 100));
  return `
  <article class="reward-item reveal" style="--d:${(i % 4) * 0.05}s">
    <div class="reward-item__img"><img src="${r.src}" alt="" loading="lazy" decoding="async" width="600" height="600" data-photo>${ready ? '<span class="reward-item__tag">Ready to redeem</span>' : ''}</div>
    <div class="reward-item__body">
      <h3 class="reward-item__name">${esc(r.name)}</h3>
      <p class="reward-item__pts">${pts(r.points)}</p>
      <div class="progress__track" aria-hidden="true"><div class="progress__fill" style="width:${pct}%"></div></div>
      ${ready
        ? `<button class="btn btn--sm btn--block" type="button" data-redeem="${esc(r.id)}">Redeem</button>`
        : `<p class="small">${pts(r.points - status.points)} to go</p>`}
    </div>
  </article>`;
}).join('');
document.querySelectorAll('[data-redeem]').forEach((b) => b.addEventListener('click', () => {
  const r = rewards.catalogue().find((x) => x.id === b.dataset.redeem);
  openWhatsApp(`Hi Eutility, I'd like to redeem ${pts(r.points)} for: ${r.name}.
Referral code: ${rewards.myCode()}
(sent from the Eutility website)`);
}));

const copyBtn = document.getElementById('ref-copy');
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: link });
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  copyBtn.textContent = 'Copied ✓';
  toast('Link copied');
  setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 2000);
});

document.getElementById('ref-share').addEventListener('click', () => {
  const text = `I checked my electricity plan with Eutility. See what you could save: ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

// ── Activity + reward icons ──
// Nothing is invented: until the referral backend reports activity, say so plainly.
document.getElementById('activity').innerHTML = `
  <div class="activity-row">
    <span class="activity-row__icon">${I.gift}</span>
    <span>Nothing yet. Share your link and you’ll see each friend’s switch here.</span>
  </div>`;

document.querySelectorAll('[data-icon]').forEach((e) => { e.innerHTML = I[e.dataset.icon]; });

// Count the stat tiles up when they scroll into view
const stats = document.querySelector('.stats');
if (stats) {
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    stats.querySelectorAll('[data-stat]').forEach((e) => countUp(e, Number(e.dataset.stat), { duration: 900 }));
    io.disconnect();
  });
  io.observe(stats);
}
observeReveals();
