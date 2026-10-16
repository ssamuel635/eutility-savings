// Shared shell: header, mobile drawer, footer, sticky WhatsApp bar,
// WhatsApp handoff (+ desktop QR fallback), referral capture, scroll reveals, toast.
import { CONFIG, waLink, mailLink } from './config.js';
import { RATES_DATE, TARIFF, TARIFF_PERIOD } from './calc.js';
import * as I from './icons.js';
import * as customer from './services/customer.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function initials(name = customer.get()?.fullName) {
  const n = String(name || '').trim();
  if (!n) return 'E';
  const parts = n.split(/\s+/);
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const NAV = [
  { href: 'calculator.html', label: 'Savings calculator', key: 'calculator' },
  { href: 'news.html', label: 'Market news', key: 'news' },
  { href: 'referrals.html', label: 'Rewards', key: 'referrals' },
  { href: 'how-it-works.html', label: 'How it works', key: 'how' },
  { href: 'faq.html', label: 'FAQ', key: 'faq' },
];

// The phone menu: every page as a big tile with a coloured icon and a hint.
const DRAWER = [
  { href: 'index.html', label: 'Home', hint: 'Start here', key: 'home', icon: 'home', tone: 'blue' },
  { href: 'calculator.html', label: 'Savings calculator', hint: 'In 30 seconds', key: 'calculator', icon: 'calc', tone: 'blue' },
  { href: 'referrals.html', label: 'Rewards', hint: 'Points for referrals', key: 'referrals', icon: 'gift', tone: 'red' },
  { href: 'how-it-works.html', label: 'How it works', hint: 'Three steps', key: 'how', icon: 'bolt', tone: 'teal' },
  { href: 'testimonials.html', label: 'Testimonials', hint: 'What clients say', key: 'testimonials', icon: 'quote', tone: 'orange' },
  { href: 'faq.html', label: 'FAQ', hint: 'Quick answers', key: 'faq', icon: 'help', tone: 'green' },
  { href: 'news.html', label: 'Market news', hint: 'Tariffs and retailers', key: 'news', icon: 'news', tone: 'navy' },
  { href: 'about.html', label: 'About & contact', hint: 'Since 1979', key: 'about', icon: 'info', tone: 'navy' },
];

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// Official logo exported from Figma → assets/img/eutility-logo.png (PNG @2x or SVG).
// Until the file is added, a text wordmark is shown instead.
const LOGO_SRC = 'assets/img/eutility-logo.png';
const wordmark = '<span class="logo-word" aria-hidden="true"><span>e<b>u</b>tility</span><small>get control</small></span>';
function logo() {
  return `<img src="${LOGO_SRC}" alt="Eutility — get control" width="314" height="112" decoding="async" data-logo-img>`;
}
function wireLogoFallback() {
  document.querySelectorAll('img[data-logo-img]').forEach((img) => {
    const swap = () => { img.outerHTML = wordmark; };
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener('error', swap, { once: true });
  });
}

function header(page) {
  const links = NAV.map((n) => `<a href="${n.href}"${n.key === page ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  return `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="top">
    <div class="site-header__inner">
      <a class="logo" href="index.html" aria-label="Eutility home">${logo()}</a>
      <nav class="site-nav" aria-label="Main">${links}</nav>
      <div class="header-actions">
        ${customer.isSignedIn()
          ? `<a class="account-chip" href="account.html" aria-label="Your account"><span class="account-chip__avatar">${esc(initials())}</span><span class="account-chip__name">${esc(customer.firstName() || 'Account')}</span></a>`
          : `<a class="btn btn--ghost btn--sm header-account" href="login.html">Log in</a>`}
        <a class="btn btn--sm header-cta" href="calculator.html">Check my savings</a>
        <button class="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${I.menu}</button>
      </div>
    </div>
  </header>
  <div class="drawer" id="drawer" aria-hidden="true">
    <div class="drawer__scrim" data-close></div>
    <div class="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="drawer__top">
        <a class="logo" href="index.html" aria-label="Eutility home">${logo()}</a>
        <button class="menu-btn" type="button" aria-label="Close menu" data-close>${I.close}</button>
      </div>
      <a class="drawer-promo" href="calculator.html">
        <img src="assets/img/people/hdb-blocks.jpg" srcset="assets/img/people/hdb-blocks-720.webp 720w, assets/img/people/hdb-blocks-960.webp 960w, assets/img/people/hdb-blocks-1200.webp 1200w" sizes="100vw" alt="" width="1200" height="800" loading="lazy" decoding="async" data-photo>
        <span><strong>What could you save?</strong>Compare every plan in 30 seconds ${I.chevron}</span>
      </a>
      <nav class="drawer-grid" aria-label="Mobile">
        ${DRAWER.map((d) => `<a href="${d.href}"${d.key === page ? ' aria-current="page"' : ''}><span class="ico-tile ico-tile--${d.tone}">${I[d.icon]}</span><span><strong>${d.label}</strong><small>${d.hint}</small></span></a>`).join('')}
      </nav>
      <div class="drawer-account">
        ${customer.isSignedIn()
          ? `<a href="account.html"${page === 'account' ? ' aria-current="page"' : ''}><span class="account-chip__avatar">${esc(initials())}</span><span><strong>My account</strong><small>Checks, bills and points</small></span>${I.chevron}</a>`
          : `<a href="login.html"${page === 'login' ? ' aria-current="page"' : ''}><span class="ico-tile ico-tile--blue">${I.login}</span><span><strong>Log in</strong></span></a><a href="signup.html"${page === 'signup' ? ' aria-current="page"' : ''}><span class="ico-tile ico-tile--green">${I.userPlus}</span><span><strong>Sign up</strong></span></a>`}
      </div>
      <div class="drawer__actions">
        <a class="btn btn--neutral btn--block" href="${waLink()}" data-wa>${I.chat}<span>Chat on WhatsApp</span></a>
      </div>
    </div>
  </div>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="site-footer__grid">
        <div class="stack" style="--stack:16px">
          <p>Independent energy and utility management since 1979. We don&rsquo;t supply energy. We help you pay less for it.</p>
        </div>
        <div>
          <h3>Product</h3>
          <ul>
            <li><a href="calculator.html">Savings calculator</a></li>
            <li><a href="calculator.html#sme">For businesses (SME)</a></li>
            <li><a href="how-it-works.html">How it works</a></li>
            <li><a href="referrals.html">${CONFIG.rewards.programmeName}</a></li>
            <li><a href="testimonials.html">Testimonials</a></li>
          </ul>
        </div>
        <div>
          <h3>Support</h3>
          <ul>
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="news.html">Market news</a></li>
            <li><a href="about.html#contact">Contact us</a></li>
            <li><a href="about.html">About Eutility</a></li>
            <li><a href="login.html">Log in</a></li>
            <li><a href="signup.html">Create an account</a></li>
          </ul>
        </div>
        <div class="stack" style="--stack:14px">
          <h3>Talk to us</h3>
          <p>Got a question? Message us and someone from our Singapore office replies.</p>
          <a class="btn btn--white" href="${waLink()}" data-wa>${I.chat}<span>Chat on WhatsApp</span></a>
          <a class="btn btn--ghost-light" href="${mailLink()}" data-mail>${I.mail}<span>Email us instead</span></a>
          <p><a href="mailto:${CONFIG.email}">${CONFIG.email}</a><br><a href="tel:${CONFIG.phone.replace(/\s/g, '')}">${CONFIG.phone}</a></p>
        </div>
      </div>
      <div class="site-footer__legal">
        <ul class="site-footer__legal-links" aria-label="Legal">
          <li><a href="legal.html#terms">Website Terms and Conditions</a></li>
          <li><a href="legal.html#privacy">Privacy Statement</a></li>
        </ul>
        <div class="site-footer__legal-text">
          <span>© ${year} ${CONFIG.company.sgEntity} · UEN ${CONFIG.company.sgUen} · ${CONFIG.company.sgAddress.replace('#05-08', '<span class="nowrap">#05-08</span>')}. Part of Eutility, ${CONFIG.company.parentLine.toLowerCase()}.</span>
          <span>Eutility is an independent energy management company and broker, not an electricity retailer. Savings are estimates based on retailers’ published rates as at ${RATES_DATE} and SP Group’s regulated tariff for ${TARIFF_PERIOD} (${TARIFF}¢/kWh incl. GST). Promotions are not included. Your actual bill depends on your usage and the retailer’s contract.</span>
        </div>
      </div>
    </div>
  </footer>
  <div class="wa-bar" id="wa-bar">
    <a class="wa-bar__main" href="${waLink()}" data-wa>${I.chat.replace('class="icon"', '')}<span class="wa-bar__text"><span class="wa-bar__label">Chat on WhatsApp</span><span class="wa-bar__sub" hidden></span></span></a>
    <a class="wa-bar__alt" href="${mailLink()}" data-mail aria-label="Email us instead">${I.mail}</a>
  </div>
  <div class="modal" id="wa-modal" aria-hidden="true">
    <div class="modal__scrim" data-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="wa-modal-title">
      <button class="modal__close" type="button" aria-label="Close" data-close>×</button>
      <h2 class="h3" id="wa-modal-title">Send this to Eutility</h2>
      <p class="small">Scan with your phone camera to open the chat with your message ready to send, or email the same details instead.</p>
      <div class="qr" id="wa-qr" role="img" aria-label="QR code linking to Eutility on WhatsApp"></div>
      <a class="btn btn--block" id="wa-open" href="#" target="_blank" rel="noopener">${I.chat}<span>Open WhatsApp on this computer</span></a>
      <a class="btn btn--neutral btn--block" id="wa-mail" href="#">${I.mail}<span>Email us instead</span></a>
      <p class="small">We reply from ${CONFIG.email} during Singapore business hours.</p>
    </div>
  </div>
  <div class="toast" role="status" aria-live="polite" id="toast"></div>`;
}

/** After signing up on this page, swap "Log in" for the account chip without a reload. */
export function refreshAccountChip() {
  const btn = document.querySelector('.header-account');
  if (!btn || !customer.isSignedIn()) return;
  btn.outerHTML = `<a class="account-chip" href="account.html" aria-label="Your account"><span class="account-chip__avatar">${esc(initials())}</span><span class="account-chip__name">${esc(customer.firstName() || 'Account')}</span></a>`;
}

// ── Toast ──
let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-shown'), 2400);
}

// ── Referral capture: ?ref=CODE (also /r/CODE via server rewrite) ──
export function referredBy() { return store.get('eu_referred_by'); }
function captureReferral() {
  const code = new URLSearchParams(location.search).get('ref');
  if (code && /^[A-Z0-9]{4,12}$/i.test(code)) {
    store.set('eu_referred_by', code.toUpperCase());
    const n = document.createElement('div');
    n.className = 'ref-notice';
    n.setAttribute('role', 'status');
    n.textContent = `A friend referred you — code ${code.toUpperCase()} will be added when you chat with us.`;
    document.querySelector('.site-header')?.after(n);
  }
}

// ── WhatsApp handoff (brief §6) ──
export function buildWaMessage(msg = CONFIG.whatsappDefaultMessage) {
  const ref = referredBy();
  return ref ? `${msg}\n(Referral code: ${ref})` : msg;
}
const isDesktop = () => window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches;

/** The same handoff by email — for anyone without WhatsApp or on a work machine. */
export function openEmail(message, subject) {
  location.href = mailLink(buildWaMessage(message), subject);
}

export function openWhatsApp(message) {
  const text = buildWaMessage(message);
  const url = waLink(text);
  if (!isDesktop()) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const modal = document.getElementById('wa-modal');
  const qrBox = document.getElementById('wa-qr');
  document.getElementById('wa-open').href = url;
  document.getElementById('wa-mail').href = mailLink(text);
  qrBox.innerHTML = '';
  openLayer(modal);
  loadQr().then((make) => {
    if (!make) { qrBox.textContent = 'QR unavailable'; return; }
    const qr = make(0, 'M');
    qr.addData(url);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  });
}

// The QR library (57 KB) is only needed when the desktop WhatsApp modal opens,
// so it's fetched then — not on every page load. Cached after the first use.
let qrPromise;
function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  qrPromise ||= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = new URL('../vendor/qrcode.js', import.meta.url).href;
    s.onload = () => resolve(window.qrcode || null);
    s.onerror = () => { qrPromise = null; resolve(null); };
    document.head.appendChild(s);
  });
  return qrPromise;
}

// While a drawer, modal or sheet is open the page behind it can't scroll and
// can't be reached with Tab: everything else in <body> is made inert.
// Layers stack: a modal opened over a sheet (e.g. "Ask about this plan" on the
// plans page) becomes the live layer and the sheet goes inert under it; when
// the modal closes, the sheet is live again. Only the top layer is ever usable.
const layers = [];
function applyLock() {
  const top = layers[layers.length - 1];
  document.documentElement.classList.toggle('is-locked', !!top);
  [...document.body.children].forEach((c) => {
    if (c.id === 'toast' || c.tagName === 'SCRIPT') return;
    const shouldLock = !!top && c !== top && !c.contains(top);
    if (shouldLock && !c.inert) { c.inert = true; c.dataset.lockInert = '1'; }
    // Only undo what we set: something made inert elsewhere stays inert.
    if (!shouldLock && c.dataset.lockInert) { c.inert = false; delete c.dataset.lockInert; }
  });
}
export function lockBackground(layer) {
  const i = layers.indexOf(layer);
  if (i !== -1) layers.splice(i, 1);
  layers.push(layer);
  applyLock();
}
export function unlockBackground(layer) {
  const i = layer ? layers.indexOf(layer) : layers.length - 1;
  if (i !== -1) layers.splice(i, 1);
  applyLock();
}
/** The layer on top, if any (Escape closes only this one). */
export const topLayer = () => layers[layers.length - 1] || null;

function openLayer(el, trigger) {
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
  el._trigger = trigger || document.activeElement;
  lockBackground(el);
  const focusable = el.querySelector('a, button');
  setTimeout(() => focusable?.focus(), 50);
}
function closeLayer(el) {
  if (!el || !el.classList.contains('is-open')) return;
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
  unlockBackground(el);
  el._trigger?.focus?.();
}

// ── Scroll reveals ──
export function observeReveals(root = document) {
  // [data-stagger] parents give each .reveal child an increasing delay
  root.querySelectorAll('[data-stagger], .steps, .grid-3, .stats, .team').forEach((p) => {
    // cap the stagger — a ten-item list shouldn't take 0.8s to finish arriving
    [...p.children].forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--d', `${Math.min(i, 5) * 0.06}s`); });
  });
  const els = [...root.querySelectorAll('.reveal, [data-inview]')];
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add('is-visible');
        en.target.dispatchEvent(new CustomEvent('inview'));
        io.unobserve(en.target);
      }
    }
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

  // Anything already on screen is not a scroll reveal — it's just the page.
  // Waiting for the observer and then running a 0.9s fade is what made a fresh
  // page sit there before "doing the animation". These hand over to the boot
  // sequence instead, so one screen is never animated by two systems at once.
  els.forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) {
      e.classList.add('reveal--instant', 'is-visible');
      e.dispatchEvent(new CustomEvent('inview'));
    } else {
      io.observe(e);
    }
  });
}

// ── First-visit loader (once per browser session, brief §3.6) ──
function showLoader() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Brand moment on arrival, homepage only. On any other page it is just a
  // white sheet sitting over content that is already there.
  if (document.body.dataset.page !== 'home') return;
  try {
    if (sessionStorage.getItem('eu_loader')) return;
    sessionStorage.setItem('eu_loader', '1');
  } catch { return; }
  const l = document.createElement('div');
  l.className = 'loader';
  l.setAttribute('aria-hidden', 'true');
  l.innerHTML = `<div><img src="${LOGO_SRC}" alt=""><div class="loader__bar"></div></div>`;
  document.body.appendChild(l);
  let finished = false;
  const done = () => { if (finished) return; finished = true; l.classList.add('is-done'); setTimeout(() => l.remove(), 400); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(done);
  setTimeout(done, 700); // never block for long
}

// ── Header hides on scroll down, returns on scroll up ──
function smartHeader() {
  const hdr = document.querySelector('.site-header');
  let last = scrollY, ticking = false;
  // Reloading part-way down a page fires one big scroll event as the browser
  // restores your position. That isn't you scrolling, so don't hide the header.
  let settling = true;
  setTimeout(() => { settling = false; last = scrollY; }, 500);
  const update = () => {
    const y = scrollY;
    hdr.classList.toggle('is-scrolled', y > 4);
    const openLayer = document.querySelector('.drawer.is-open, .modal.is-open');
    if (!openLayer && !settling) hdr.classList.toggle('is-hidden', y > last && y > 240);
    last = y;
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
  update();
}

// ── Back-to-top + hide sticky WhatsApp bar near the footer ──
function extras() {
  const btn = document.createElement('button');
  btn.className = 'to-top';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(btn);
  addEventListener('scroll', () => btn.classList.toggle('is-shown', scrollY > 900), { passive: true });

  const bar = document.querySelector('.wa-bar');
  const foot = document.querySelector('.site-footer');
  if ('IntersectionObserver' in window && bar && foot) {
    new IntersectionObserver(([en]) => bar.classList.toggle('is-away', en.isIntersecting)).observe(foot);
  }
  mobileBar(bar);
}

// ── Mobile bottom bar ──────────────────────────────────────────
// Three behaviours that make the fixed bar feel native rather than in the way:
//  1. it slides away while the on-screen keyboard is up (it would sit on top of
//     the field you're typing in),
//  2. it steps aside while a results screen's own "Switch" button is on screen,
//     so there are never two of the same button stacked,
//  3. once there's a result, it becomes that result's switch button.
let barAction = null;
function mobileBar(bar) {
  if (!bar) return;
  const typing = (el) => el && el.matches('input:not([type=range]):not([type=radio]):not([type=checkbox]):not([type=file]), select, textarea');
  document.addEventListener('focusin', (e) => { if (typing(e.target)) bar.classList.add('is-typing'); });
  document.addEventListener('focusout', () => setTimeout(() => {
    if (!typing(document.activeElement)) bar.classList.remove('is-typing');
  }, 60));

  const main = bar.querySelector('.wa-bar__main');
  const alt = bar.querySelector('.wa-bar__alt');
  main.addEventListener('click', (e) => {
    if (!barAction) return;                      // default: generic chat (data-wa handler)
    e.preventDefault(); e.stopImmediatePropagation();
    barAction.onSend?.('whatsapp');
    openWhatsApp(barAction.message);
  }, true);
  alt.addEventListener('click', (e) => {
    if (!barAction) return;
    e.preventDefault(); e.stopImmediatePropagation();
    barAction.onSend?.('email');
    openEmail(barAction.message, barAction.subject);
  }, true);
}

let inlineSwitchObserver;
/**
 * Turn the bottom bar into a specific action — e.g. "Switch · save S$273/yr"
 * after a calculation. Pass null to go back to "Chat on WhatsApp".
 * `watch` is the on-page button doing the same job; the bar hides while it's visible.
 */
let savedBar = null;
/** Park the bar's current action (e.g. while the SME tab is showing) and bring it back later. */
export function pauseBarAction() { if (barAction) { savedBar = savedBar || { action: barAction, watch: barWatch }; setBarAction(null); } }
export function resumeBarAction() { if (savedBar) { const { action, watch } = savedBar; savedBar = null; setBarAction(action, watch); } }

let barWatch = null;
export function setBarAction(action, watch) {
  const bar = document.getElementById('wa-bar');
  if (!bar) return;
  barAction = action;
  barWatch = watch || null;
  if (action) savedBar = null;
  const label = bar.querySelector('.wa-bar__label');
  const sub = bar.querySelector('.wa-bar__sub');
  label.textContent = action ? action.label : 'Chat on WhatsApp';
  sub.textContent = action?.sub || '';
  sub.hidden = !action?.sub;
  bar.classList.toggle('is-action', !!action);
  bar.classList.remove('is-pop'); void bar.offsetWidth; if (action) bar.classList.add('is-pop');

  inlineSwitchObserver?.disconnect();
  bar.classList.remove('is-covered');
  if (watch && 'IntersectionObserver' in window) {
    inlineSwitchObserver = new IntersectionObserver(([en]) => bar.classList.toggle('is-covered', en.isIntersecting), { threshold: 0.6 });
    inlineSwitchObserver.observe(watch);
  }
}

// ── Faster page loads: prefetch internal pages on hover / when idle ──
function prefetchLinks() {
  const done = new Set([location.pathname]);
  const prefetch = (href) => {
    const u = new URL(href, location.href);
    if (u.origin !== location.origin || done.has(u.pathname) || !u.pathname.endsWith('.html')) return;
    done.add(u.pathname);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = u.pathname;
    document.head.appendChild(l);
  };
  document.addEventListener('pointerover', (e) => { const a = e.target.closest('a[href]'); if (a) prefetch(a.href); }, { passive: true });
  document.addEventListener('touchstart', (e) => { const a = e.target.closest('a[href]'); if (a) prefetch(a.href); }, { passive: true });
}

// A reload should feel like a refresh, not a slide. Cross-page transitions are
// for moving between pages; on a reload they hold the old frame on screen while
// the new one loads, which reads as the page hanging.
addEventListener('pagereveal', (e) => {
  const nav = performance.getEntriesByType('navigation')[0];
  if (!e.viewTransition || !nav || nav.type !== 'reload') return;
  e.viewTransition.ready.catch(() => {}); // skipping rejects this promise; that's expected
  e.viewTransition.skipTransition();
});

// ── Page-load choreography ──────────────────────────────────
// The first screen assembles itself: header, then the opening copy, then the card.
function bootSequence() {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    // Everything visible when the page opens arrives on one ladder, in DOM
    // order — whether it came from the hero or from a list further down.
    const pick = [...document.querySelectorAll(
      'main .eyebrow, main h1, main .display, main .h1, main .lead, main .btn-row, main .trust, '
      + 'main .segmented, main .card, main .board-hero, main .plan-toolbar, main .note-list, main .reveal')]
      // headlines built from .rise lines animate themselves — don't fade them twice
      .filter((el) => !el.querySelector('.rise'))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })
      // outermost only, so a card and its contents don't both animate
      .filter((el, i, arr) => !arr.some((other) => other !== el && other.contains(el)))
      .slice(0, 9);
    pick.forEach((el, i) => {
      el.classList.add('boot-in');
      el.style.setProperty('--d', `${0.04 + Math.min(i, 5) * 0.06}s`);
    });
  }
  // Start as soon as the text can be drawn in its real typeface. Waiting for
  // window "load" meant waiting for every image, which on a reload left the
  // first screen sitting blank.
  let done = false;
  const ready = () => { if (done) return; done = true; requestAnimationFrame(() => root.classList.add('is-ready')); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready);
  else ready();
  setTimeout(ready, 250);   // never hold the copy back for slow fonts
}

// ── Navigation progress bar ─────────────────────────────────
function routeBar() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bar = document.createElement('div');
  bar.className = 'route-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const start = () => { bar.classList.remove('is-done'); requestAnimationFrame(() => bar.classList.add('is-going')); };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('data-wa')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname === location.pathname) return;
    start();
  });
  addEventListener('pageshow', () => { bar.classList.remove('is-going'); bar.classList.add('is-done'); });
}

// ── Photos fade in once they have actually decoded ──────────
function fadeInPhotos() {
  document.querySelectorAll('.hero__art img').forEach((img) => {
    const show = () => img.classList.add('is-loaded');
    if (img.complete) show();
    else img.addEventListener('load', show, { once: true });
  });
}

// ── Lite mode ───────────────────────────────────────────────
// Budget phones (≤4 GB memory or ≤4 cores) and data-saver get the same
// animations without the costly parts: blur filters, frosted glass, the slow
// photo zoom and heavy confetti. styles.css keys off html.lite.
export const isLite = (() => {
  try {
    const n = navigator;
    return (n.deviceMemory && n.deviceMemory <= 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || n.connection?.saveData === true;
  } catch { return false; }
})();

// ── Photos that aren't there yet become a tinted panel, never a broken image ──
function photoFallbacks(root = document) {
  root.querySelectorAll('img[data-photo]').forEach((img) => {
    const miss = () => img.closest('.photo-frame')?.classList.add('is-missing');
    if (img.complete && !img.naturalWidth) miss();
    else img.addEventListener('error', miss, { once: true });
  });
}
export { photoFallbacks };

export function initLayout() {
  document.documentElement.classList.remove('no-js');
  if (isLite) document.documentElement.classList.add('lite');
  const page = document.body.dataset.page;
  document.body.insertAdjacentHTML('afterbegin', header(page));
  document.body.insertAdjacentHTML('beforeend', footer());
  // Header now occupies its row for real — release the CSS placeholder in the
  // same tick, so no frame is ever drawn with both or neither.
  document.documentElement.classList.add('shell-ready');
  // The page module keeps running synchronously after initLayout() returns and
  // renders its content. A frame callback runs after all of that and before the
  // next paint — so <main> is first painted already complete. (styles.css)
  requestAnimationFrame(() => document.documentElement.classList.add('page-ready'));

  wireLogoFallback();
  showLoader();
  smartHeader();
  extras();
  prefetchLinks();

  const drawer = document.getElementById('drawer');
  const menuBtn = document.querySelector('.header-actions .menu-btn');
  menuBtn.addEventListener('click', () => { openLayer(drawer, menuBtn); menuBtn.setAttribute('aria-expanded', 'true'); });
  document.querySelectorAll('.drawer [data-close], .modal [data-close]').forEach((b) => b.addEventListener('click', () => {
    const layer = b.closest('.drawer, .modal');
    if (!layer) return;
    closeLayer(layer);
    if (layer === drawer) menuBtn.setAttribute('aria-expanded', 'false');
  }));
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Close only the top layer; a sheet underneath stays open.
    const top = topLayer();
    if (!top || !top.matches('.drawer, .modal')) return;
    closeLayer(top);
    if (top === drawer) menuBtn.setAttribute('aria-expanded', 'false');
    e.stopImmediatePropagation();
  });

  // Any element with data-wa opens WhatsApp; data-wa-message overrides the text.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-wa]');
    if (!a) return;
    e.preventDefault();
    openWhatsApp(a.dataset.waMessage || undefined);
  });

  // Same handoff, by email. Any element with data-mail; data-wa-message is reused.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-mail]');
    if (!a) return;
    e.preventDefault();
    openEmail(a.dataset.waMessage || a.dataset.mailMessage || undefined, a.dataset.mailSubject || undefined);
  });

  captureReferral();
  observeReveals();
  bootSequence();
  routeBar();
  fadeInPhotos();
  photoFallbacks();
}
