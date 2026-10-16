// ─────────────────────────────────────────────────────────────
// Site configuration — edit these before going live.
// Anything marked TODO is a placeholder that must be confirmed by Eutility.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  brand: 'Eutility',

  // ── Company facts (from eutility.com.au / eutility.com.sg and ACRA) ──
  // Used in the copy so the site says the same things the business does.
  company: {
    foundedAu: 1979,
    sgEntity: 'Eutility Singapore Pte Ltd',
    sgUen: '201624008N',
    sgIncorporated: 2016,
    sgAddress: '140 Paya Lebar Road, #05-08, AZ @ Paya Lebar, Singapore 409015',
    tagline: 'Get control',
    parentLine: 'Independent energy experts since 1979',
    // Eutility is a broker/agent and consultant, not an electricity retailer.
    role: 'independent energy and utility management company',
  },

  // Eutility's main site. Only used to tell search engines the two sites are
  // the same company (tools/seo.mjs); this site doesn't link to it for content.
  links: {
    website: 'https://eutility.com.sg/',
  },
  // Master Services Agreement terms for business clients (Legal page).
  msaPdf: 'assets/docs/eutility-msa-terms-2023.pdf',
  // Legal/enquiries address used in the Website Terms and Conditions.
  enquiriesEmail: 'enquiries@eutility.com.sg',

  // TODO: Eutility's WhatsApp Business number in international format, digits only (no +, spaces).
  whatsappNumber: '6597908347',

  // Pre-filled message for the WhatsApp handoff (from the creative brief §6).
  whatsappDefaultMessage: "Hi Eutility, I'd like to check my electricity savings.",

  // Chatbot hand-off. WhatsApp only lets the customer send the first message,
  // so the pre-filled text from the website/app IS the conversation opener.
  // If FXMedia's bot only starts on a particular word or phrase (e.g. "Hi" or
  // "SWITCH"), put it here: it's added as the first line of every hand-off
  // message, from the website and the app. Leave empty if any message works.
  // TODO: confirm with FXMedia.
  chatbotTrigger: '',

  // TODO: confirm public contact details.
  email: 'customerservice@eutility.com.sg',
  phone: '+65 9790 8347',

  // Base for referral links shown to users. Empty = this site's own address
  // (eutility-savings.vercel.app/r/CODE, redirected by vercel.json). Set a host
  // such as 'eutility.sg' only once that domain is owned and pointed at the site.
  referralHost: '',

  // Calculator defaults
  defaultKwh: 450,
  minKwh: 50,
  maxKwh: 2000,
  daysPerMonth: 30.4,

  // "Not sure of your usage?" presets — rounded, approximate monthly averages by home type
  // (starting points only; the user can fine-tune with the slider).
  // TODO: confirm against EMA's latest Singapore Energy Statistics (Chapter 3) before launch.
  homePresets: [
    { label: 'HDB 3-room', kwh: 280 },
    { label: 'HDB 4-room', kwh: 370 },
    { label: 'HDB 5-room', kwh: 440 },
    { label: 'Executive', kwh: 500 },
    { label: 'Condo', kwh: 500 },
    { label: 'Landed', kwh: 1100 },
  ],

  // Default share of usage that falls in off-peak hours, used for time-of-use plans.
  defaultOffPeakShare: 0.3,

  // ── Rewards / referral programme (TODO: confirm mechanics with Eutility) ──
  rewards: {
    programmeName: 'Eutility Rewards',   // customer-facing name for the referral programme
    nextRewardAt: 7,                     // PLACEHOLDER: switches needed for the next reward tier
    // PLACEHOLDER points (TODO: confirm with Eutility): what each friend's
    // completed switch earns, and what each item costs. The catalogue is shown
    // on the website's Rewards page and the app's Rewards tab; `img` is the file
    // name in assets/img/rewards/ (website) and mobile/assets/rewards/ (app).
    pointsPerSwitch: 1000,
    // This month's headline reward, promoted on the app's Home and the Rewards
    // page. Change it each month (an `id` from the catalogue below).
    featured: 'ps5',
    catalogue: [
      { id: 'voucher', name: 'S$10 shopping voucher', points: 1000, img: 'gift-voucher' },
      { id: 'fan', name: 'Desk fan', points: 2500, img: 'desk-fan' },
      { id: 'rice-cooker', name: 'Rice cooker', points: 3500, img: 'rice-cooker' },
      { id: 'air-fryer', name: 'Air fryer', points: 4500, img: 'air-fryer' },
      { id: 'robot-vacuum', name: 'Robot vacuum', points: 9000, img: 'robot-vacuum' },
      { id: 'switch', name: 'Nintendo Switch', points: 14000, img: 'nintendo-switch' },
      { id: 'ps5', name: 'PlayStation 5', points: 20000, img: 'ps5' },
      { id: 'tv', name: '50-inch smart TV', points: 24000, img: 'smart-tv' },
    ],
  },

  // Confetti fires when yearly savings exceed this (brief §3.5 / §6).
  confettiThreshold: 100,

  // ── SME aggregation (TODO: placeholder commercial terms — confirm with Eutility) ──
  // Indicative aggregated rate = best ≤24-month fixed residential rate in the sheet
  // minus the tier discount below, applied to the COMBINED monthly usage of all sites.
  smeTiers: [
    { minKwh: 0, discountPct: 0, label: 'Starter' },
    { minKwh: 2000, discountPct: 2, label: 'Bronze' },
    { minKwh: 10000, discountPct: 4, label: 'Silver' },
    { minKwh: 50000, discountPct: 6, label: 'Gold' },
  ],
  smeMaxSites: 20,
};

/** External link that opens in a new tab and says so to screen readers. */
export function extLink(href, label, cls = '') {
  return `<a href="${href}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ''}>${label}<span aria-hidden="true"> ↗</span><span class="visually-hidden"> (opens in a new tab)</span></a>`;
}

export function waLink(message = CONFIG.whatsappDefaultMessage) {
  const t = CONFIG.chatbotTrigger;
  const text = t && !message.startsWith(t) ? `${t}
${message}` : message;
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

/**
 * The same handoff as WhatsApp, by email — for anyone who doesn't use WhatsApp
 * or is on a work machine. Subject is short; the message becomes the body.
 */
export function mailLink(message = CONFIG.whatsappDefaultMessage, subject = 'Electricity savings enquiry') {
  const body = `${message}\n\n— sent from the Eutility savings site`;
  return `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
