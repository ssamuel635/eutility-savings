// Eutility Rewards: the member's progress, their link, then what's happened on it.
import { initLayout, toast, observeReveals } from '../layout.js';
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

// ── Your progress (replaces the sample leaderboard) ──
document.getElementById('leaderboard').innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
    <h2 class="h3" style="display:flex;align-items:center;gap:10px"><span style="width:26px;color:#fff">${I.trophy}</span>${customer.firstName() ? `${esc(customer.firstName())}, your progress` : 'Your progress'}</h2>
    <span class="small" style="color:#fff">${esc(rewards.monthLabel())}</span>
  </div>
  <p style="font-size:44px;font-weight:800;line-height:1;letter-spacing:-0.03em">${status.switched}<span style="font-size:18px;font-weight:600"> of ${status.target} switches</span></p>
  <div class="progress"><div class="progress__track"><div class="progress__fill" id="prog-hero"></div></div></div>
  <p class="small" style="color:#fff">${status.toNext} more switch${status.toNext === 1 ? '' : 'es'} to your next reward. Each friend who switches through your link counts.</p>`;
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
        <div class="stat"><span class="stat__num" data-stat="${status.toNext}" style="color:var(--orange-display)">0</span><span class="stat__label">To your next reward</span></div>
      </div>
      <div class="lb-light progress">
        <div style="display:flex;justify-content:space-between;font-size:14px"><span><strong>${status.switched}</strong> of ${status.target} switches</span><span class="small">Next reward</span></div>
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

document.getElementById('prog').style.width = status.progressPct + '%';
document.getElementById('prog-hero').style.width = status.progressPct + '%';

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
