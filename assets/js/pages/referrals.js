// Eutility Rewards: leaderboard first, then the member's own status, link and activity.
import { initLayout, toast, observeReveals } from '../layout.js';
import { CONFIG } from '../config.js';
import { countUp } from '../fx.js';
import * as rewards from '../services/rewards.js';
import * as customer from '../services/customer.js';
import * as I from '../icons.js';

initLayout();

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const status = rewards.myStatus();
const link = rewards.myLink();
const display = link.replace(/^https:\/\//, '');

// ── Leaderboard ──
const board = rewards.leaderboard();
document.getElementById('leaderboard').innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
    <h2 class="h3" style="display:flex;align-items:center;gap:10px"><span style="width:26px;color:#ffb300">${I.trophy}</span>Top referrers</h2>
    <span class="small" style="color:#bbdefb">${esc(rewards.monthLabel())}</span>
  </div>
  <div>
    ${board.slice(0, 6).map((r) => `
      <div class="lb-row${r.isMe ? ' lb-row--me' : ''}${r.rank === 1 ? ' lb-row--1' : ''}">
        <span class="lb-row__rank">${r.rank}</span>
        <span class="lb-row__name">${esc(r.name)}${r.isMe ? ' <span class="small">(you)</span>' : ''}</span>
        <span class="lb-row__score">${r.switches} <small>switches</small></span>
      </div>`).join('')}
  </div>
  <p class="small" style="color:#bbdefb">Sample standings — live once the programme launches.</p>`;

// ── Your status, progress and link ──
const name = customer.firstName();
document.getElementById('my-status').innerHTML = `
  <div class="grid-2 grid-2--top">
    <div class="card card--shadow stack" style="--stack:18px">
      <div>
        <h2 class="calc-card__title">${name ? `Hey ${esc(name)}` : 'Your progress'}</h2>
        <p class="small">${esc(CONFIG.rewards.programmeName)} · ${status.sample ? 'sample figures for now' : ''}</p>
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
      ${customer.isSignedIn() ? '' : '<p class="small">Create an account to track this properly. <a href="signup.html">Sign up</a></p>'}
    </div>

    <div class="card card--shadow stack" style="--stack:16px">
      <h2 class="calc-card__title">Your link</h2>
      <div class="ref-link"><span id="ref-link-text">${esc(display)}</span></div>
      <div class="stack" style="--stack:12px">
        <button class="btn btn--block" type="button" id="ref-copy">Copy Link</button>
        <button class="btn btn--neutral btn--block" type="button" id="ref-share">Share on WhatsApp</button>
      </div>
      <p class="small">Your friend lands on the savings calculator with your code already applied.</p>
    </div>
  </div>`;

document.getElementById('prog').style.width = status.progressPct + '%';

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
  setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
});

document.getElementById('ref-share').addEventListener('click', () => {
  const text = `I switched my electricity plan with Eutility and it took a minute. Check what you'd save: ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

// ── Activity + reward icons ──
document.getElementById('activity').innerHTML = rewards.activity().map((a) => `
  <div class="activity-row">
    <span class="activity-row__icon">${I[a.icon] || I.gift}</span>
    <span>${esc(a.text)}</span>
    <time>${esc(a.at)}</time>
  </div>`).join('');

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
