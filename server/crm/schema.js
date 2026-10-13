// ─────────────────────────────────────────────────────────────
// What a CRM record looks like, whichever CRM holds it.
//
// The fields match what we told FXMedia the website collects (email of
// 13 Oct 2026): every enquiry carries source, page, action, lead type,
// time, referral code and consent; residential customers, comparison
// results and business enquiries have their own sheets.
//
// Each sheet in the Excel workbook maps onto a Freshworks CRM object:
//   contacts           → Contact
//   applications       → Deal            (stage = deal stage)
//   savingsChecks      → Note on the contact (comparison results)
//   businessEnquiries  → Deal            (lead type Business)
//   bills              → File on the contact
//
// Validation lives here too, so every adapter receives clean data.
// ─────────────────────────────────────────────────────────────

const SOURCES = ['website', 'mobile_app', 'whatsapp', 'referral'];
const LEAD_TYPES = ['Residential', 'Business'];

/** What the person did. Stored as the readable label. */
const ACTIONS = {
  account_created: 'Account created',
  profile_updated: 'Profile updated',
  savings_check: 'Savings check',
  switch_whatsapp: 'Switch request (WhatsApp)',
  switch_email: 'Switch request (email)',
  switch_app: 'Switch request (app)',
  bill_uploaded: 'Bill uploaded',
  business_quote: 'Business quote',
};

/**
 * Where an application is NOW — staff pick one in the Excel "Stage" column.
 * New applications start at the first. (The customer's own first step, "Invoice
 * submitted", is always done by the time an application exists.)
 */
const STAGES = ['Application received', 'Retailer processing', 'Contract activated'];
const NEEDS_ATTENTION = 'Needs attention';
const STAGE_CHOICES = [...STAGES, NEEDS_ATTENTION];

const DWELLINGS = ['HDB 1- or 2-room', 'HDB 3-room', 'HDB 4-room', 'HDB 5-room', 'HDB Executive', 'Condominium / Apartment', 'Landed property', 'Business premises'];

/** Columns per sheet: key (record field), header (what staff see), width. */
const SHEETS = {
  contacts: {
    name: 'Customers',
    columns: [
      ['id', 'Customer ID', 14], ['createdAt', 'Created', 20], ['updatedAt', 'Updated', 20],
      ['source', 'Source', 12], ['leadType', 'Lead type', 12], ['sourcePage', 'Page', 16], ['lastAction', 'Last action', 22],
      ['fullName', 'Name', 24], ['email', 'Email', 28], ['phone', 'Mobile', 14],
      ['address', 'Address', 34], ['unit', 'Unit', 10], ['postal', 'Postal code', 11], ['dwelling', 'Home type', 20],
      ['currentPlan', 'Current retailer and plan', 32], ['monthlyKwh', 'Usage (kWh/month)', 16], ['spAccount', 'SP account no.', 16],
      ['referralCode', 'Their referral code', 16], ['referredBy', 'Referred by', 14],
      ['termsAcceptedAt', 'Terms accepted', 20], ['contactConsent', 'Consent to contact', 20],
    ],
  },
  applications: {
    name: 'Applications',
    columns: [
      ['reference', 'Reference', 12], ['createdAt', 'Created', 20], ['contactId', 'Customer ID', 14], ['contactName', 'Name', 22],
      ['contactEmail', 'Email', 26], ['contactPhone', 'Mobile', 14], ['channel', 'Channel', 12], ['plan', 'Plan', 32],
      ['estimatedSavingYearly', 'Est. saving (S$/yr)', 16], ['stage', 'Stage', 22], ['stageUpdatedAt', 'Stage updated', 20],
      ['staffNote', 'Note to customer', 36],
    ],
  },
  savingsChecks: {
    name: 'Savings checks',
    columns: [
      ['id', 'Reference', 12], ['at', 'When', 20], ['contactId', 'Customer ID', 14], ['channel', 'Channel', 12],
      ['sourcePage', 'Page', 16], ['action', 'Action', 24],
      ['kwh', 'Usage (kWh/month)', 16], ['currentPlan', 'Current plan', 30], ['bestPlan', 'Recommended plan', 30],
      ['savingMonthly', 'Saving (S$/month)', 15], ['savingYearly', 'Saving (S$/yr)', 14],
      ['contractFilter', 'Contract filter', 16], ['greenOnly', 'Green only', 10],
      ['ratesDate', 'Rates as at', 16], ['tariffPeriod', 'SP tariff period', 16],
    ],
  },
  businessEnquiries: {
    name: 'Business enquiries',
    columns: [
      ['id', 'Reference', 12], ['at', 'When', 20], ['contactId', 'Customer ID', 14], ['channel', 'Channel', 12], ['sourcePage', 'Page', 16],
      ['companyName', 'Company', 26], ['contactName', 'Name', 22], ['email', 'Email', 26], ['phone', 'Mobile', 14],
      ['siteCount', 'Sites', 8], ['sites', 'Sites and usage', 44], ['totalKwh', 'Total kWh/month', 15],
      ['savingYearly', 'Illustrative saving (S$/yr)', 22], ['tier', 'Volume tier', 12], ['status', 'Status', 12],
    ],
  },
  bills: {
    name: 'Bills',
    columns: [
      ['id', 'Bill ID', 14], ['at', 'Received', 20], ['contactId', 'Customer ID', 14], ['channel', 'Channel', 12],
      ['billingMonth', 'Bill month', 11], ['fileName', 'File name', 30], ['mimeType', 'Type', 16], ['sizeKb', 'Size (KB)', 10],
      ['storedAs', 'Saved as', 40], ['status', 'Status', 14],
    ],
  },
};

// ── Validation ───────────────────────────────────────────────
class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

const str = (v, max = 200) => (v === undefined || v === null ? '' : String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max));
const num = (v, min, max) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError(`Number out of range: ${v}`);
  return Math.round(n * 100) / 100;
};
const normEmail = (e) => str(e, 254).toLowerCase();
/** "9123 4567" / "+65 9123-4567" → "+6591234567"; anything else kept as typed digits. */
function normPhone(p) {
  const digits = str(p, 30).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 8) return `+65${digits}`;
  if (digits.length === 10 && digits.startsWith('65')) return `+${digits}`;
  return `+${digits}`;
}
/** An ISO time → Singapore time as staff read it ("2026-10-13 09:43:59"); '' if not a time. */
function sgTime(v) {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? new Date(d.getTime() + 8 * 3600_000).toISOString().replace('T', ' ').slice(0, 19) : '';
}
const page = (v) => { const p = str(v, 80); return /^[\w/.\-#?=&]*$/.test(p) ? p : ''; };
const action = (v) => ACTIONS[v] || '';
/** Customer-made reference codes ("EC-7K3Q9P"), so a WhatsApp message can carry one before the CRM replies. */
const reference = (v, prefix) => { const r = str(v, 16).toUpperCase(); return new RegExp(`^${prefix}-[A-Z0-9]{6}$`).test(r) ? r : ''; };

/** True if the body names a person we can file it under (email or mobile). */
const hasContact = (c) => !!(c && (str(c.email) || str(c.phone)));

function contact(input) {
  // Consent to be contacted: the time they ticked it, "No" if they declined.
  // (The app sends a plain yes/no from its settings.)
  const consent = input?.contactConsentAt ? sgTime(input.contactConsentAt)
    : input?.contactConsentAt === false || input?.contactConsent === false ? 'No'
      : input?.contactConsent === true ? 'Yes' : '';
  const c = {
    source: SOURCES.includes(input?.source) ? input.source : 'website',
    leadType: LEAD_TYPES.includes(input?.leadType) ? input.leadType : 'Residential',
    sourcePage: page(input?.sourcePage),
    lastAction: action(input?.lastAction),
    fullName: str(input?.fullName, 120),
    email: normEmail(input?.email),
    phone: normPhone(input?.phone),
    address: str(input?.address, 200),
    unit: str(input?.unit, 20),
    postal: str(input?.postal, 6).replace(/\D/g, ''),
    dwelling: DWELLINGS.includes(input?.dwelling) ? input.dwelling : str(input?.dwelling, 40),
    currentPlan: str(input?.currentPlan, 120),
    monthlyKwh: num(input?.monthlyKwh, 0, 10_000_000),
    spAccount: str(input?.spAccount, 20).replace(/[^\d-]/g, ''),
    referralCode: str(input?.referralCode, 16).toUpperCase(),
    referredBy: str(input?.referredBy, 16).toUpperCase(),
    termsAcceptedAt: sgTime(input?.termsAcceptedAt),
    contactConsent: consent,
  };
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) throw new ValidationError('Invalid email');
  if (!c.email && !c.phone) throw new ValidationError('A contact needs an email or a mobile number');
  return c;
}

function application(input) {
  return {
    reference: str(input?.reference, 20).toUpperCase(),
    channel: SOURCES.includes(input?.channel) ? input.channel : 'website',
    plan: str(input?.plan, 120) || 'Eutility to recommend',
    estimatedSavingYearly: num(input?.estimatedSavingYearly, -100_000, 10_000_000) ?? 0,
  };
}

/** A comparison result: what was compared, what we recommended, and what they did next. */
function savingsCheck(input) {
  const green = input?.greenOnly;
  return {
    reference: reference(input?.reference, 'EC'),
    channel: SOURCES.includes(input?.channel) ? input.channel : 'website',
    sourcePage: page(input?.sourcePage),
    action: action(input?.action) || ACTIONS.savings_check,
    kwh: num(input?.kwh, 0, 10_000_000),
    currentPlan: str(input?.currentPlan, 120),
    bestPlan: str(input?.bestPlan, 120),
    savingMonthly: num(input?.savingMonthly, -10_000, 1_000_000),
    savingYearly: num(input?.savingYearly, -100_000, 10_000_000),
    contractFilter: str(input?.contractFilter, 40),
    greenOnly: green === true ? 'Yes' : green === false ? 'No' : '',
    ratesDate: str(input?.ratesDate, 30),
    tariffPeriod: str(input?.tariffPeriod, 30),
  };
}

/** A business (SME) quote request: the company, each site and its usage. */
function businessEnquiry(input) {
  const sites = (Array.isArray(input?.sites) ? input.sites : []).slice(0, 50)
    .map((s, i) => ({ name: str(s?.name, 60) || `Site ${i + 1}`, kwh: num(s?.kwh, 0, 10_000_000) ?? 0 }))
    .filter((s) => s.kwh > 0);
  if (!sites.length) throw new ValidationError('A business enquiry needs at least one site with its monthly usage');
  return {
    reference: reference(input?.reference, 'EB'),
    channel: SOURCES.includes(input?.channel) ? input.channel : 'website',
    sourcePage: page(input?.sourcePage),
    companyName: str(input?.companyName, 120),
    siteCount: sites.length,
    sites: sites.map((s) => `${s.name}: ${s.kwh.toLocaleString('en-SG')} kWh`).join('; '),
    totalKwh: sites.reduce((n, s) => n + s.kwh, 0),
    savingYearly: num(input?.savingYearly, -100_000, 100_000_000),
    tier: str(input?.tier, 30),
  };
}

const BILL_TYPES = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/webp': '.webp' };
const MAX_BILL_BYTES = 8 * 1024 * 1024;

function bill(input) {
  const mimeType = str(input?.mimeType, 60).toLowerCase();
  if (!BILL_TYPES[mimeType]) throw new ValidationError('Bills must be a PDF or a photo (JPG, PNG, HEIC, WebP)');
  const data = Buffer.from(str(input?.dataBase64, 12_000_000).replace(/^data:[^,]*,/, ''), 'base64');
  if (!data.length) throw new ValidationError('The bill file is empty');
  if (data.length > MAX_BILL_BYTES) throw new ValidationError('Bills must be under 8 MB');
  const billingMonth = str(input?.billingMonth, 7);
  return {
    channel: SOURCES.includes(input?.channel) ? input.channel : 'website',
    billingMonth: /^\d{4}-\d{2}$/.test(billingMonth) ? billingMonth : '',
    // Keep a readable name but never trust it as a path.
    fileName: str(input?.fileName, 80).replace(/[^\w.\- ]+/g, '_') || `bill${BILL_TYPES[mimeType]}`,
    mimeType,
    data,
  };
}

module.exports = {
  SOURCES, LEAD_TYPES, ACTIONS, STAGES, NEEDS_ATTENTION, STAGE_CHOICES, SHEETS, BILL_TYPES, MAX_BILL_BYTES,
  ValidationError, validate: { contact, application, savingsCheck, businessEnquiry, bill }, hasContact, normEmail, normPhone, sgTime,
};
