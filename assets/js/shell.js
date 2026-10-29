// The site's header, phone menu and footer as plain markup, with no browser code,
// so the same markup serves two places: layout.js puts the live copy on every
// page, and tools/prerender.mjs writes a copy into the HTML for search engines
// and phones without JavaScript (initLayout() swaps that copy for the live one).
import { CONFIG, waLink, mailLink } from './config.js';
import { RATES_DATE, TARIFF, TARIFF_PERIOD } from './calc.js';
import * as I from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const NAV = [
  { href: 'calculator.html', label: 'Savings calculator', key: 'calculator' },
  { href: 'how-it-works.html', label: 'How it works', key: 'how' },
  { href: 'referrals.html', label: 'Rewards', key: 'referrals' },
  { href: 'news.html', label: 'Market news', key: 'news' },
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

// Official logo exported from Figma → assets/img/eutility-logo.png (PNG @2x or SVG).
export const LOGO_SRC = 'assets/img/eutility-logo.png';
function logo() {
  return `<img src="${LOGO_SRC}" alt="Eutility — get control" width="314" height="112" decoding="async" data-logo-img>`;
}

/** The header for `page` (body[data-page]). `account` is { initials, firstName } when signed in. */
export function header(page, account = null) {
  const links = NAV.map((n) => `<a href="${n.href}"${n.key === page ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  return `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="top">
    <div class="site-header__inner">
      <a class="logo" href="index.html" aria-label="Eutility home">${logo()}</a>
      <nav class="site-nav" aria-label="Main">${links}</nav>
      <div class="header-actions">
        ${account
          ? `<a class="account-chip" href="account.html" aria-label="Your account"><span class="account-chip__avatar">${esc(account.initials)}</span><span class="account-chip__name">${esc(account.firstName || 'Account')}</span></a>`
          : `<a class="btn btn--ghost btn--sm header-account" href="login.html">Log in</a>`}
        <a class="btn btn--sm header-cta" href="${page === 'home' ? '#calculator' : 'calculator.html'}">Check my savings</a>
        <button class="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${I.menu}</button>
      </div>
    </div>
  </header>`;
}

/** The phone menu (opened from the header). */
export function drawer(page, account = null) {
  return `
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
        ${account
          ? `<a href="account.html"${page === 'account' ? ' aria-current="page"' : ''}><span class="account-chip__avatar">${esc(account.initials)}</span><span><strong>My account</strong><small>Checks, bills and points</small></span>${I.chevron}</a>`
          : `<a href="login.html"${page === 'login' ? ' aria-current="page"' : ''}><span class="ico-tile ico-tile--blue">${I.login}</span><span><strong>Log in</strong></span></a><a href="signup.html"${page === 'signup' ? ' aria-current="page"' : ''}><span class="ico-tile ico-tile--green">${I.userPlus}</span><span><strong>Sign up</strong></span></a>`}
      </div>
      <div class="drawer__actions">
        <a class="btn btn--wa btn--block" href="${waLink()}" data-wa>${I.chat}<span>Chat on WhatsApp</span></a>
      </div>
    </div>
  </div>`;
}

export function footer() {
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
            <li><a href="electricity-tariff.html">SP Group tariff this quarter</a></li>
            <li><a href="electricity-plans-hdb-4-room.html">Plans by type of home</a></li>
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
          <a class="btn btn--wa" href="${waLink()}" data-wa>${I.chat}<span>Chat on WhatsApp</span></a>
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
  </footer>`;
}

/** The phone WhatsApp bar, the desktop QR modal and the toast. */
export function footerExtras() {
  return `
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
      <p class="small">${CONFIG.whatsappSameNumber}</p>
      <div class="qr" id="wa-qr" role="img" aria-label="QR code linking to Eutility on WhatsApp"></div>
      <a class="btn btn--wa btn--block" id="wa-open" href="#" target="_blank" rel="noopener">${I.chat}<span>Open WhatsApp on this computer</span></a>
      <a class="btn btn--neutral btn--block" id="wa-mail" href="#">${I.mail}<span>Email us instead</span></a>
      <p class="small">We reply from ${CONFIG.email} during Singapore business hours.</p>
    </div>
  </div>
  <div class="toast" role="status" aria-live="polite" id="toast"></div>`;
}
