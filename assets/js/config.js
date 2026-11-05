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

  // WhatsApp number every WhatsApp button and QR code opens, in international
  // format, digits only (no +, spaces). This is the chatbot's number
  // (+65 8227 7121, 23 Oct); the office phone below stays separate.
  whatsappNumber: '6582277121',

  // Shown beside the WhatsApp buttons. The chatbot finds a customer's details
  // in the CRM by the number they message from (FXMedia, 28 Oct 2026).
  whatsappSameNumber: 'Please message us from your own mobile number (the one you signed up with, if you have an account) so we can find your details.',

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

  // Retailers the home page's "Our picks" come from: set to the partner
  // retailers once agreed (28 Oct 2026: partnerships under discussion). The
  // calculator still compares every plan. Empty = pick from every retailer.
  featuredRetailers: [],

  // Calculator defaults
  defaultKwh: 450,
  minKwh: 50,
  maxKwh: 2000,
  daysPerMonth: 30.4,

  // "Not sure of your usage?" presets — average monthly use by home type, rounded to
  // 10 kWh (starting points only; the user can fine-tune with the slider).
  // Source: EMA, Singapore Energy Statistics 2026, table T3.5, 2025 annual averages
  // (checked 27 Oct 2026): 3-room 266.5, 4-room 369.7, 5-room and Executive 452.6
  // (EMA groups them; Executive flats are larger, so a little higher here),
  // private apartments and condominiums 505.3, landed 1,178.2. Re-check each September.
  homePresets: [
    { label: 'HDB 3-room', kwh: 270 },
    { label: 'HDB 4-room', kwh: 370 },
    { label: 'HDB 5-room', kwh: 450 },
    { label: 'Executive', kwh: 500 },
    { label: 'Condo', kwh: 510 },
    { label: 'Landed', kwh: 1180 },
  ],

  // Default share of usage that falls in off-peak hours, used for time-of-use plans.
  defaultOffPeakShare: 0.3,

  // ── Referral lucky draw (agreed with Kenneth, 4 Nov 2026; replaced points) ──
  // When a referred friend's supply starts, the referrer and the friend each get
  // one instant draw. Bonus draws for the referrer: +1 at the 3rd friend, +2 at
  // the 5th, then +2 for every further 5 (10, 15, ...). The draw itself runs on
  // the server (api/_draw-engine.mjs reads the prizes below); the website and
  // app only show progress and link to it.
  rewards: {
    programmeName: 'Eutility Rewards',   // customer-facing name for the referral programme
    bonusDraws: [{ at: 3, extra: 1 }, { at: 5, extra: 2 }],
    repeatEvery: 5,                      // after the last bonus above: +repeatExtra every this many friends
    repeatExtra: 2,
    drawDays: 30,                        // a draw link stays valid this long
    voucherShops: 'FairPrice or Sheng Siong',
    // PLACEHOLDER prizes and odds (TODO: Eutility to confirm, legal to review).
    // `weight` is out of 10,000; the top prize must stay at 0.1% (10) or less.
    // Every draw wins one of these. The result is picked on the server.
    prizes: [
      { id: 'v5', value: 5, weight: 9500 },
      { id: 'v10', value: 10, weight: 300 },
      { id: 'v20', value: 20, weight: 100 },
      { id: 'v50', value: 50, weight: 60 },
      { id: 'v100', value: 100, weight: 30 },
      { id: 'v500', value: 500, weight: 10 },
    ],
    // Shown on the draw page until legal has reviewed the rules.
    rulesDraft: true,
    // Steps a referred friend goes through. Friends are never named (Kenneth, 4 Nov).
    friendSteps: ['Invited', 'Signed up', 'Switch in progress', 'Supply started'],
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
