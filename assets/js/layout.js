// Shared shell: header, mobile drawer, footer, sticky WhatsApp bar,
// WhatsApp handoff (+ desktop QR fallback), referral capture, scroll reveals, toast.
import { CONFIG, waLink, mailLink } from './config.js';
import { header, drawer as drawerMarkup, footer, footerExtras, LOGO_SRC } from './shell.js';
import * as customer from './services/customer.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function initials(name = customer.get()?.fullName) {
  const n = String(name || '').trim();
  if (!n) return 'E';
  const parts = n.split(/\s+/);
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// If the logo image can't load, a text wordmark is shown instead.
const wordmark = '<span class="logo-word" aria-hidden="true"><span>e<b>u</b>tility</span><small>get control</small></span>';
function wireLogoFallback() {
  document.querySelectorAll('img[data-logo-img]').forEach((img) => {
    const swap = () => { img.outerHTML = wordmark; };
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener('error', swap, { once: true });
  });
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
// ── Analytics: every event goes through track(). No analytics tool is picked
// yet (a launch decision), so events only show in the console on a local
// server. Connect the tool here and no page code changes. ──
export function track(name, props = {}) {
  const event = { name, page: document.body.dataset.page, ...props };
  if (location.hostname === 'localhost') console.debug('[track]', event);
}

export function openEmail(message, subject) {
  track('email_clicked');
  location.href = mailLink(buildWaMessage(message), subject);
}

export function openWhatsApp(message) {
  track('whatsapp_clicked');
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
  const account = customer.isSignedIn() ? { initials: initials(), firstName: customer.firstName() } : null;
  // The HTML carries a copy of the header and footer for search engines
  // (tools/prerender.mjs); swap it for the live one.
  document.querySelectorAll('body > .skip-link, body > .site-header, body > .site-footer').forEach((n) => n.remove());
  document.body.insertAdjacentHTML('afterbegin', header(page, account) + drawerMarkup(page, account));
  document.body.insertAdjacentHTML('beforeend', footer() + footerExtras());
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
