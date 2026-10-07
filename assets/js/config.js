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
    scale: 'more than 2,000 businesses across 19,000+ locations',
  },

  // ── Links to Eutility's main site (eutility.com.sg) and business tools ──
  links: {
    website: 'https://eutility.com.sg/',
    smartview: 'https://smartview.eutility.com.au/',          // SmartView client login
    offices: 'https://eutility.com.sg/contact-us/#international',
    contact: 'https://eutility.com.sg/contact-us/',
    procurement: 'https://eutility.com.sg/procurement-and-management/',
    netZero: 'https://eutility.com.sg/net-zero/',
    trading: 'https://eutility.com.sg/trading/',
    analysis: 'https://eutility.com.sg/analysis/',
    support: 'https://eutility.com.sg/support/',
    faqs: 'https://eutility.com.sg/faqs/',
    glossary: 'https://eutility.com.sg/glossary-of-terms/',
    msaOfficial: 'https://eutility.com.sg/wp-content/uploads/2023/05/2023_Eutility_MSA_Type_Terms_Singapore.pdf',
  },
  // Local copy of the Master Services Agreement terms (same file as msaOfficial).
  msaPdf: 'assets/docs/eutility-msa-terms-2023.pdf',
  // Legal/enquiries address used in the Website Terms and Conditions.
  enquiriesEmail: 'enquiries@eutility.com.sg',

  // TODO: Eutility's WhatsApp Business number in international format, digits only (no +, spaces).
  whatsappNumber: '6597908347',

  // Pre-filled message for the WhatsApp handoff (from the creative brief §6).
  whatsappDefaultMessage: 'Hi, I want to check my electricity savings',

  // TODO: confirm public contact details.
  email: 'customerservice@eutility.com.sg',
  phone: '+65 97908347',

  // Base URL used for referral links shown to users.
  referralBase: 'eutility.sg/r/',

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
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * The same handoff as WhatsApp, by email — for anyone who doesn't use WhatsApp
 * or is on a work machine. Subject is short; the message becomes the body.
 */
export function mailLink(message = CONFIG.whatsappDefaultMessage, subject = 'Electricity savings enquiry') {
  const body = `${message}\n\n— sent from the Eutility savings site`;
  return `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
