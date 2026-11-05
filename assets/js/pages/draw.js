// Referral lucky draw page.
// Opened from the WhatsApp message (draw.html?t=TOKEN). The server checks the
// link first; only a valid, unused link shows the prize reel. The prize is
// picked on the server, and the reel just slides to it. Without a link, the
// page explains the draw and its rules (safe to share).
import { initLayout, openWhatsApp, track } from '../layout.js';
import { CONFIG } from '../config.js';
import { confetti } from '../fx.js';
import { prizeMin, prizeMax, money } from '../services/draws.js';
import { photo } from '../data/photos.js';
import { voucherCard, tier } from '../widgets/voucher.js';
import { reelMarkup, createReel } from '../widgets/prize-reel.js';
import * as I from '../icons.js';

initLayout();

const R = CONFIG.rewards;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = document.getElementById('draw-app');
const token = new URLSearchParams(location.search).get('t');
const range = `${money(prizeMin())} to ${money(prizeMax())}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' });

const HEAD = {
  referrer: ['Your friend has switched!', 'Thanks for sharing Eutility. Open your prize below.'],
  friend: ['Welcome to Eutility!', 'Your new plan has started. Open your welcome prize below.'],
  bonus: ['You’ve unlocked a bonus draw!', 'Thanks for bringing so many friends over. Open your bonus prize below.'],
};

const sampleNote = (sample) => (sample ? '<p class="draw-sample">Sample draw for previews only. No voucher is sent.</p>' : '');

function showReady(d) {
  const [h, lead] = HEAD[d.kind] || HEAD.referrer;
  app.innerHTML = `
    <div class="draw-stage">
      <div class="stack draw-stage__text" style="--stack:14px">
        <p class="eyebrow eyebrow--orange">${esc(R.programmeName)} · Lucky draw</p>
        <h1 class="display">${esc(h)}</h1>
        <p class="lead">${esc(lead)} Every draw wins a grocery voucher from ${range}.</p>
        ${sampleNote(d.sample)}
      </div>
      ${reelMarkup()}
      <div class="draw-stage__action">
        <button class="btn btn--orange btn--lg draw-go" type="button" id="spin">${I.gift}<span>Tap to open your prize</span></button>
        <p class="small">Run by Eutility Singapore Pte Ltd. Your prize is set by our system with fixed odds and shown as soon as the roll stops. This link works once, until ${esc(fmtDate(d.expires))}. <a href="#rules">Read the draw rules</a>.</p>
      </div>
    </div>`;
  const reel = createReel(app.querySelector('.reel'), d.prizes);
  document.getElementById('spin').addEventListener('click', () => spin(d, reel), { once: true });
}

async function spin(d, reel) {
  const btn = document.getElementById('spin');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Rolling…';
  let r;
  try {
    const res = await fetch('/api/draw', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ t: token }) });
    r = await res.json();
    if (!r.result) throw new Error(r.error || r.status);
  } catch (e) {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Try again';
    btn.addEventListener('click', () => spin(d, reel), { once: true });
    btn.insertAdjacentHTML('afterend', '<p class="small" role="alert">We couldn’t reach the draw just now. Check your connection and try again. Your draw is still saved.</p>');
    return;
  }
  track('draw_spun', { kind: d.kind, sample: !!d.sample });
  app.querySelector('.reel').classList.add('is-rolling');
  await reel.spinTo(r.result.index);
  showResult(r.result, d.sample, false);
}

// The prize: a big voucher card, then how it reaches you.
function showResult(result, sample, already) {
  const value = result.value ?? Number(String(result.label).replace(/\D/g, ''));
  const steps = [
    [I.chat, 'We send it on WhatsApp', sample ? 'In the live draw, your voucher code arrives on WhatsApp.' : 'Your voucher code arrives on WhatsApp, usually within a few working days.'],
    [I.ticket, 'Show it at the till', `Use it at ${esc(R.voucherShops)}.`],
    [I.userPlus, 'Win again', 'Every friend who switches gets you another draw.'],
  ];
  app.innerHTML = `
    <div class="prize prize--${tier(value)}">
      <div class="prize__card">${voucherCard(value, { size: 'big', sample })}</div>
      <div class="stack prize__text" style="--stack:14px">
        <p class="eyebrow eyebrow--orange">${already ? 'You’ve already opened this draw' : 'You won'}</p>
        <h1 class="display">${money(value)} grocery voucher</h1>
        ${sampleNote(sample)}
        <ol class="prize-steps">${steps.map(([icon, h, p]) => `<li><span class="prize-steps__icon">${icon}</span><span><strong>${h}</strong>${p}</span></li>`).join('')}</ol>
        <div class="btn-row">
          <a class="btn btn--orange" href="referrals.html">${I.gift}<span>Tell a friend, win again</span></a>
          <a class="btn btn--secondary" href="calculator.html">Check my savings</a>
        </div>
      </div>
    </div>`;
  if (!already) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    confetti({ count: tier(value) === 'gold' ? 320 : 180 });
  }
}

function showProblem(status) {
  const expired = status === 'expired';
  app.innerHTML = `
    <div class="draw-split">
      <div class="draw-result">
        <span class="draw-result__icon draw-result__icon--muted">${I.info}</span>
        <h1 class="h1">${expired ? 'This draw link has expired' : 'This draw link isn’t valid'}</h1>
        <p class="lead">${expired ? `Draw links work for ${R.drawDays} days.` : 'It may be incomplete. Open it again from the WhatsApp message we sent you.'} If you think something’s wrong, message us and we’ll check.</p>
        <div class="btn-row">
          <button class="btn btn--wa" type="button" id="draw-help">${I.chat}<span>Message us on WhatsApp</span></button>
          <a class="btn btn--secondary" href="referrals.html">About Eutility Rewards</a>
        </div>
      </div>
      <div class="photo-frame draw-split__photo">${photo('shopkeeper', { sizes: '(min-width: 900px) 45vw, 100vw' })}</div>
    </div>`;
  document.getElementById('draw-help').addEventListener('click', () => openWhatsApp(`Hi Eutility, my lucky draw link says it ${expired ? 'has expired' : 'isn’t valid'}. Could you check it for me?`));
}

// Without a link: explain the draw, no reel.
function showAbout() {
  const fan = [5, 20, 100, 500];
  app.innerHTML = `
    <div class="draw-split">
      <div class="stack" style="--stack:16px">
        <p class="eyebrow eyebrow--orange">${esc(R.programmeName)} · Lucky draw</p>
        <h1 class="display">A prize for every friend who switches.</h1>
        <p class="lead">When a friend you referred starts their new electricity plan, you both get a lucky draw. Every draw wins a grocery voucher from ${range}. We send your draw link on WhatsApp.</p>
        <div class="voucher-fan" aria-hidden="true">${fan.map((v) => voucherCard(v, { size: 'mini' })).join('')}</div>
        <div class="btn-row"><a class="btn" href="referrals.html">Get my referral link</a><a class="btn btn--secondary" href="#rules">Read the draw rules</a></div>
      </div>
      <div class="photo-frame draw-split__photo">${photo('familyMeal', { eager: true, sizes: '(min-width: 900px) 45vw, 100vw' })}</div>
    </div>`;
}

// ── The rules, shown before anyone spins (TODO: legal review) ──
function rules(prizes) {
  const odds = prizes.map((p) => `<tr><td><span class="odds-prize">${voucherCard(p.value, { size: 'mini' })}<span>${esc(p.label)} grocery voucher</span></span></td><td>${esc(p.odds)}</td></tr>`).join('');
  const bonus = R.bonusDraws.map((b) => `+${b.extra} at your ${ordinal(b.at)} friend`).join(', ');
  document.getElementById('draw-rules').innerHTML = `
    ${R.rulesDraft ? '<p class="draw-sample">Draft rules: being reviewed before launch.</p>' : ''}
    <div class="draw-rules__grid">
      <div class="stack" style="--stack:14px">
        <h3 class="h4">Who runs the draw</h3>
        <p>Eutility Singapore Pte Ltd (UEN 201624008N), 140 Paya Lebar Road, #05-08, AZ @ Paya Lebar, Singapore 409015.</p>
        <h3 class="h4">Who gets a draw</h3>
        <p>When a friend who used your referral link starts their new electricity plan through Eutility, you and your friend each get one draw. You also get bonus draws: ${esc(bonus)}, then +${R.repeatExtra} for every ${R.repeatEvery} more friends. Referrals must be genuine: you can’t refer yourself.</p>
        <h3 class="h4">How the result is decided</h3>
        <p>Every draw wins one prize. Our system sets the result with the fixed odds below when your draw is created, and the result is shown immediately after you spin. Spinning again or opening the link on another device doesn’t change it.</p>
      </div>
      <div class="stack" style="--stack:14px">
        <h3 class="h4">Prizes and odds</h3>
        <table class="draw-odds"><thead><tr><th>Prize</th><th>Chance per draw</th></tr></thead><tbody>${odds}</tbody></table>
        <p class="small">Vouchers are for ${esc(R.voucherShops)}.</p>
        <h3 class="h4">Your draw link</h3>
        <p>We send each draw to you on WhatsApp. A link works once and stays valid for ${R.drawDays} days. We send your voucher on WhatsApp too. We use your mobile number only to send your draws and prizes, as you agreed when you signed up. See our <a href="legal.html#privacy">Privacy Statement</a>.</p>
      </div>
    </div>`;
}
const ordinal = (n) => {
  const end = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10];
  return `${n}${end && ![11, 12, 13].includes(n % 100) ? end : 'th'}`;
};

async function start() {
  // The app's sample draws link to draw.html?sample=referrer|friend|bonus:
  // swap that for a fresh sample link (the server refuses when draws are live).
  const sampleKind = new URLSearchParams(location.search).get('sample');
  if (!token && /^(referrer|friend|bonus)$/.test(sampleKind || '')) {
    try {
      const r = await (await fetch(`/api/draw?sample=${sampleKind}`, { headers: { accept: 'application/json' } })).json();
      if (r.token) return location.replace(`draw.html?t=${encodeURIComponent(r.token)}`);
    } catch { /* fall through to the explanation */ }
  }
  let d = { status: 'invalid', prizes: [] };
  try {
    const res = await fetch(`/api/draw${token ? `?t=${encodeURIComponent(token)}` : ''}`, { headers: { accept: 'application/json' } });
    d = await res.json();
  } catch { /* the rules still show from config below */ }
  const prizes = d.prizes?.length ? d.prizes : R.prizes.map((p) => ({ label: money(p.value), value: p.value, odds: `${p.weight / 100}%` }));
  rules(prizes);
  if (!token) return showAbout();
  if (d.status === 'ready') return showReady({ ...d, prizes });
  if (d.status === 'drawn' && d.result) return showResult(d.result, d.sample, true);
  if (d.error) {
    app.innerHTML = '<p class="lead" role="alert">We couldn’t load your draw just now. Refresh the page to try again. Your draw is still saved.</p>';
    return;
  }
  showProblem(d.status);
}
start();
