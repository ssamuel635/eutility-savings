// Referral lucky draw page.
// Opened from the WhatsApp message (draw.html?t=TOKEN). The server checks the
// link first; only a valid, unused link shows the wheel. The prize is picked on
// the server, and the wheel just turns to it. Without a link, the page explains
// the draw and its rules (safe to share).
import { initLayout, openWhatsApp, track } from '../layout.js';
import { CONFIG } from '../config.js';
import { confetti, reducedMotion } from '../fx.js';
import { prizeMin, prizeMax, money } from '../services/draws.js';
import * as I from '../icons.js';

initLayout();

const R = CONFIG.rewards;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = document.getElementById('draw-app');
const token = new URLSearchParams(location.search).get('t');
const range = `${money(prizeMin())} to ${money(prizeMax())}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' });

const HEAD = {
  referrer: ['Your friend has switched!', 'Thanks for sharing Eutility. Spin the wheel for your prize.'],
  friend: ['Welcome to Eutility!', 'Your new plan has started. Spin the wheel for your prize.'],
  bonus: ['You’ve unlocked a bonus draw!', 'Thanks for bringing so many friends over. Spin for your bonus prize.'],
};

// ── The wheel: one equal slice per prize, drawn as SVG ──
function wheelSvg(prizes) {
  const n = prizes.length;
  const slice = 360 / n;
  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`;
  };
  const top = Math.max(...prizes.map((p) => p.value));
  const slices = prizes.map((p, i) => {
    const a0 = i * slice;
    const fill = p.value === top ? 'var(--orange-display)' : i % 2 ? 'var(--deep)' : 'var(--blue)';
    const mid = a0 + slice / 2;
    return `<path d="M100 100 L${pt(a0, 96)} A96 96 0 0 1 ${pt(a0 + slice, 96)} Z" fill="${fill}"/>
      <text x="100" y="40" transform="rotate(${mid} 100 100)" text-anchor="middle" class="wheel__label">${esc(p.label)}</text>`;
  }).join('');
  return `
    <div class="wheel" aria-hidden="true">
      <svg viewBox="0 0 200 200" class="wheel__svg"><g class="wheel__spin" id="wheel-spin">${slices}<circle cx="100" cy="100" r="96" fill="none" stroke="#fff" stroke-width="3"/></g>
        <circle cx="100" cy="100" r="16" fill="#fff"/><circle cx="100" cy="100" r="7" fill="var(--deep)"/></svg>
      <span class="wheel__pointer"></span>
    </div>`;
}

const sampleNote = (sample) => (sample ? '<p class="draw-sample">Sample draw for previews only. No voucher is sent.</p>' : '');

function showReady(d) {
  const [h, lead] = HEAD[d.kind] || HEAD.referrer;
  app.innerHTML = `
    <div class="draw-grid">
      <div class="stack draw-grid__text" style="--stack:16px">
        <p class="eyebrow eyebrow--orange">${esc(R.programmeName)} · Lucky draw</p>
        <h1 class="display">${esc(h)}</h1>
        <p class="lead">${esc(lead)} Every spin wins a grocery voucher from ${range}.</p>
        ${sampleNote(d.sample)}
      </div>
      <div class="stack draw-grid__action" style="--stack:16px">
        <button class="btn btn--orange btn--lg" type="button" id="spin">${I.gift}<span>Spin the wheel</span></button>
        <p class="small">Run by Eutility Singapore Pte Ltd. Your prize is set by our system with fixed odds and shown as soon as you spin. This link works once, until ${esc(fmtDate(d.expires))}. <a href="#rules">Read the draw rules</a>.</p>
      </div>
      ${wheelSvg(d.prizes)}
    </div>`;
  document.getElementById('spin').addEventListener('click', () => spin(d), { once: true });
}

async function spin(d) {
  const btn = document.getElementById('spin');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Spinning…';
  let r;
  try {
    const res = await fetch('/api/draw', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ t: token }) });
    r = await res.json();
    if (!r.result) throw new Error(r.error || r.status);
  } catch (e) {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Try again';
    btn.addEventListener('click', () => spin(d), { once: true });
    btn.insertAdjacentHTML('afterend', '<p class="small" role="alert">We couldn’t reach the draw just now. Check your connection and try again. Your draw is still saved.</p>');
    return;
  }
  track('draw_spun', { kind: d.kind, sample: !!d.sample });
  // Turn a few times, then stop with the prize's slice under the pointer.
  const slice = 360 / d.prizes.length;
  const jitter = (Math.random() - 0.5) * slice * 0.6;
  const turn = 360 * 6 - (r.result.index * slice + slice / 2) + jitter;
  const wheel = document.getElementById('wheel-spin');
  const ms = reducedMotion() ? 300 : 4200;
  wheel.style.transition = `transform ${ms}ms cubic-bezier(0.17, 0.67, 0.12, 1)`;
  wheel.style.transform = `rotate(${turn}deg)`;
  setTimeout(() => showResult(r.result, d.sample, false), ms + 200);
}

function showResult(result, sample, already) {
  app.innerHTML = `
    <div class="draw-result">
      <span class="draw-result__icon">${I.gift}</span>
      <p class="eyebrow eyebrow--orange">${already ? 'You’ve already used this draw' : 'You won'}</p>
      <h1 class="display">${esc(result.label)} grocery voucher</h1>
      <p class="lead">${sample ? 'In the live draw, we’d send it to you on WhatsApp.' : `We’ll send your voucher (${esc(R.voucherShops)}) to you on WhatsApp.`}</p>
      ${sampleNote(sample)}
      <div class="btn-row">
        <a class="btn" href="referrals.html">Refer another friend</a>
        <a class="btn btn--secondary" href="calculator.html">Check my savings</a>
      </div>
    </div>`;
  if (!already) confetti();
}

function showProblem(status) {
  const expired = status === 'expired';
  app.innerHTML = `
    <div class="draw-result">
      <span class="draw-result__icon draw-result__icon--muted">${I.info}</span>
      <h1 class="h1">${expired ? 'This draw link has expired' : 'This draw link isn’t valid'}</h1>
      <p class="lead">${expired ? `Draw links work for ${R.drawDays} days.` : 'It may be incomplete. Open it again from the WhatsApp message we sent you.'} If you think something’s wrong, message us and we’ll check.</p>
      <div class="btn-row">
        <button class="btn btn--wa" type="button" id="draw-help">${I.chat}<span>Message us on WhatsApp</span></button>
        <a class="btn btn--secondary" href="referrals.html">About Eutility Rewards</a>
      </div>
    </div>`;
  document.getElementById('draw-help').addEventListener('click', () => openWhatsApp(`Hi Eutility, my lucky draw link says it ${expired ? 'has expired' : 'isn’t valid'}. Could you check it for me?`));
}

// Without a link: explain the draw, no wheel.
function showAbout() {
  app.innerHTML = `
    <div class="stack" style="--stack:16px;max-width:720px">
      <p class="eyebrow eyebrow--orange">${esc(R.programmeName)} · Lucky draw</p>
      <h1 class="display">A prize for every friend who switches.</h1>
      <p class="lead">When a friend you referred starts their new electricity plan, you both get a lucky draw. Every draw wins a grocery voucher from ${range}. We send your draw link on WhatsApp.</p>
      <div class="btn-row"><a class="btn" href="referrals.html">Get my referral link</a><a class="btn btn--secondary" href="#rules">Read the draw rules</a></div>
    </div>`;
}

// ── The rules, shown before anyone spins (TODO: legal review) ──
function rules(prizes) {
  const odds = prizes.map((p) => `<tr><td>${esc(p.label)} grocery voucher</td><td>${esc(p.odds)}</td></tr>`).join('');
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
