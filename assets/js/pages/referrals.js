// Eutility Rewards: the referral lucky draw.
// Draws waiting, progress to the next bonus draw, each friend's progress
// (numbered, never named), the member's link, and recent winners.
import { initLayout, toast, observeReveals, track } from '../layout.js';
import { CONFIG } from '../config.js';
import * as rewards from '../services/rewards.js';
import { prizeMin, prizeMax, topOdds, money, plural, bonusAt } from '../services/draws.js';
import * as customer from '../services/customer.js';
import * as I from '../icons.js';
import { photo } from '../data/photos.js';
import { voucherCard } from '../widgets/voucher.js';

initLayout();

const R = CONFIG.rewards;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });
const me = rewards.myReferrals();
const link = rewards.myLink();
const range = `${money(prizeMin())} to ${money(prizeMax())}`;
const STEPS = R.friendSteps;
const LAST = STEPS.length - 1;

document.getElementById('ref-photo').innerHTML = photo('neighbours', { eager: true, sizes: '(min-width: 1024px) 45vw, 100vw' });
document.getElementById('ref-lead').textContent = `When a friend you referred starts their new electricity plan, you each get a lucky draw. Every draw wins a grocery voucher from ${range}.`;

if (me.sample) {
  document.getElementById('sample-note').innerHTML = `<p class="draw-sample" style="margin-bottom:20px">Showing sample data for review. <a href="?sample=0">Hide it</a></p>`;
}

// ── Draws waiting, and how far to the next bonus ──
const next = me.next;
let prev = me.switched; // the last bonus reached (or 0), so the bar fills from there
while (prev > 0 && !bonusAt(prev)) prev--;
const pct = Math.round(((me.switched - prev) / (next.at - prev)) * 100);
const drawRow = (d) => `
  <li class="draw-item${d.status === 'drawn' ? ' draw-item--used' : ''}">
    ${d.status === 'drawn' ? voucherCard(d.prize, { size: 'mini', cls: 'draw-item__voucher' }) : `<span class="draw-item__icon">${I.gift}</span>`}
    <span class="draw-item__text">
      <strong>${d.kind === 'bonus' ? 'Bonus draw' : `Friend ${d.friend} switched`}</strong>
      <span class="small">${d.status === 'drawn' ? `Won a ${money(d.prize)} voucher` : `Ready since ${esc(fmtDate(d.at))}`}</span>
    </span>
    ${d.status === 'ready' ? `<button class="btn btn--orange btn--sm" type="button" data-draw="${esc(d.id)}">Spin</button>` : ''}
  </li>`;
document.getElementById('ref-summary').innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
    <h2 class="h3" style="display:flex;align-items:center;gap:10px"><span style="width:26px;color:var(--blue)">${I.gift}</span>${customer.firstName() ? `${esc(customer.firstName())}, your draws` : 'Your draws'}</h2>
    <span class="small">${plural(me.switched, 'friend')} switched</span>
  </div>
  <p class="ref-panel__big">${me.waiting.length}<span> ${me.waiting.length === 1 ? 'draw' : 'draws'} waiting</span></p>
  <div class="stack" style="--stack:8px">
    <div class="progress__track" aria-hidden="true"><div class="progress__fill" id="bonus-fill"></div></div>
    <p class="small">${next.toGo === 1 ? 'One more friend' : `${next.toGo} more friends`} for a bonus (+${plural(next.extra, 'draw')}).</p>
  </div>
  ${me.draws.length
    ? `<ul class="draw-list">${me.draws.slice().reverse().map(drawRow).join('')}</ul>`
    : `<p class="small">No draws yet. When a friend’s new plan starts, we’ll send your draw link on WhatsApp${customer.isSignedIn() ? ' and show it here' : ''}.</p>`}`;
requestAnimationFrame(() => { document.getElementById('bonus-fill').style.width = `${pct}%`; });

document.querySelectorAll('[data-draw]').forEach((b) => b.addEventListener('click', async () => {
  const d = me.draws.find((x) => x.id === b.dataset.draw);
  b.disabled = true;
  try {
    const href = await rewards.drawLink(d);
    if (href) location.href = href;
  } catch {
    b.disabled = false;
    toast('Couldn’t open the draw. Try again.');
  }
}));

// ── Each friend's progress (numbered only: friends are never named) ──
const friendRow = (f) => `
  <li class="friend${f.step === LAST ? ' friend--done' : ''}">
    <div class="friend__top"><strong>Friend ${f.n}</strong><span class="friend__status">${esc(STEPS[f.step])}${f.step === LAST ? ' 🎉' : ''}</span></div>
    <ol class="friend__steps" aria-label="Step ${f.step + 1} of ${STEPS.length}">${STEPS.map((s, i) => `<li class="${i <= f.step ? 'is-done' : ''}"><span class="visually-hidden">${esc(s)}</span></li>`).join('')}</ol>
    <div class="friend__labels" aria-hidden="true">${STEPS.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
  </li>`;

document.getElementById('ref-friends').innerHTML = `
  <div>
    <h2 class="calc-card__title">Your friends</h2>
    <p class="small">We don’t show names, just where each friend is up to.</p>
  </div>
  ${me.friends.length
    ? `<ul class="friends">${me.friends.map(friendRow).join('')}</ul>`
    : `<div class="activity-row"><span class="activity-row__icon">${I.userPlus}</span><span>No friends yet. When someone messages us with your code, you’ll see their progress here.</span></div>`}
  ${customer.isSignedIn() ? '' : '<p class="small"><a href="signup.html">Create an account</a> to track your friends and draws.</p>'}`;

document.getElementById('ref-link-card').innerHTML = `
  <h2 class="calc-card__title">Your link</h2>
  <div class="ref-link"><span id="ref-link-text">${esc(link.replace(/^https?:\/\//, ''))}</span></div>
  <div class="ref-link-btns">
    <button class="btn" type="button" id="ref-copy">Copy link</button>
    <button class="btn btn--wa" type="button" id="ref-share">${I.chat}<span>Share on WhatsApp</span></button>
  </div>
  <p class="small">Your friend lands on our home page, and your code is added when they message us.</p>`;

const copyBtn = document.getElementById('ref-copy');
copyBtn.addEventListener('click', async () => {
  track('referral_shared', { how: 'copy' });
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
  track('referral_shared', { how: 'whatsapp' });
  const text = `I checked my electricity plan with Eutility. See what you could save, and we both get a lucky draw if you switch: ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

// ── Recent winners: hidden until there are real ones ──
const HOME_PHOTO = { 'HDB 3-room': 'hdb', 'HDB 4-room': 'hdbBlocks', 'HDB 5-room': 'voidDeck', Executive: 'neighbours', Condo: 'estate', Landed: 'estate' };
const stories = rewards.stories();
if (stories.length) {
  document.getElementById('stories').innerHTML = stories.map((s) => `
    <article class="story reveal">
      <div class="photo-frame story__photo">${photo(HOME_PHOTO[s.home] || 'hdb', { sizes: '(min-width: 768px) 33vw, 100vw' })}</div>
      <div class="story__who"><strong>${esc(s.name)}</strong><span>${esc(s.area)} · ${esc(s.ago)}</span></div>
      ${s.saving ? `<p class="story__save">${money(s.saving)}<span>a year saved vs the SP tariff (est.)</span></p>` : ''}
      <p class="story__won">${voucherCard(s.prize, { size: 'mini' })}<span>Switched their ${esc(s.home)} and won a <strong>${money(s.prize)} voucher</strong>.</span></p>
      ${s.sample ? '<span class="story__tag">Sample</span>' : ''}
    </article>`).join('');
  document.getElementById('stories-section').hidden = false;
}

// ── Bonus draws ──
const ordinal = (n) => {
  const end = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10];
  return `${n}${end && ![11, 12, 13].includes(n % 100) ? end : 'th'}`;
};
const last = R.bonusDraws[R.bonusDraws.length - 1].at;
document.getElementById('bonus-ladder').innerHTML = [
  `<li><span>Every friend whose plan starts</span><strong>1 draw each</strong></li>`,
  ...R.bonusDraws.map((b) => `<li><span>Your ${ordinal(b.at)} friend</span><strong>+${plural(b.extra, 'bonus draw')}</strong></li>`),
  `<li><span>Every ${R.repeatEvery} friends after that (${last + R.repeatEvery}, ${last + 2 * R.repeatEvery} …)</span><strong>+${plural(R.repeatExtra, 'bonus draw')}</strong></li>`,
].join('');
document.getElementById('prize-note').innerHTML = `Prizes are ${esc(R.voucherShops)} vouchers from ${range}. The top prize has a ${topOdds()} chance per draw. <a href="draw.html#rules">Read the draw rules</a>.`;

observeReveals();
