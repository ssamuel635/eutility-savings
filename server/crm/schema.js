// ─────────────────────────────────────────────────────────────
// What a CRM record looks like, whichever CRM holds it.
//
// Each sheet in the Excel workbook is one of these record types, and each
// maps onto a Freshworks CRM object when we switch over:
//   contacts       → Contact
//   applications   → Deal            (stage = deal stage)
//   savingsChecks  → Note on the contact
//   bills          → File on the contact
//
// Validation lives here too, so every adapter receives clean data.
// ─────────────────────────────────────────────────────────────

const SOURCES = ['website', 'mobile_app', 'whatsapp', 'referral'];

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
      ['id', 'Customer ID', 14], ['createdAt', 'Created', 20], ['updatedAt', 'Updated', 20], ['source', 'Source', 12],
      ['fullName', 'Name', 24], ['email', 'Email', 28], ['phone', 'Mobile', 14], ['address', 'Address', 34],
      ['postal', 'Postal code', 11], ['dwelling', 'Home type', 20], ['monthlyKwh', 'Usage (kWh/month)', 16],
      ['currentPlan', 'Current plan', 30], ['referralCode', 'Their referral code', 16], ['referredBy', 'Referred by', 14],
      ['marketingConsent', 'Marketing consent', 16],
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
      ['id', 'Check ID', 14], ['at', 'When', 20], ['contactId', 'Customer ID', 14], ['channel', 'Channel', 12],
      ['kwh', 'Usage (kWh/month)', 16], ['currentPlan', 'Current plan', 30], ['bestPlan', 'Recommended plan', 30],
      ['savingYearly', 'Saving (S$/yr)', 14],
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

function contact(input) {
  const c = {
    source: SOURCES.includes(input?.source) ? input.source : 'website',
    fullName: str(input?.fullName, 120),
    email: normEmail(input?.email),
    phone: normPhone(input?.phone),
    address: str(input?.address, 200),
    postal: str(input?.postal, 6).replace(/\D/g, ''),
    dwelling: DWELLINGS.includes(input?.dwelling) ? input.dwelling : str(input?.dwelling, 40),
    monthlyKwh: num(input?.monthlyKwh, 0, 10_000_000),
    currentPlan: str(input?.currentPlan, 120),
    referralCode: str(input?.referralCode, 16).toUpperCase(),
    referredBy: str(input?.referredBy, 16).toUpperCase(),
    marketingConsent: input?.marketingConsent === true ? 'Yes' : input?.marketingConsent === false ? 'No' : '',
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

function savingsCheck(input) {
  return {
    channel: SOURCES.includes(input?.channel) ? input.channel : 'website',
    kwh: num(input?.kwh, 0, 10_000_000),
    currentPlan: str(input?.currentPlan, 120),
    bestPlan: str(input?.bestPlan, 120),
    savingYearly: num(input?.savingYearly, -100_000, 10_000_000),
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
  SOURCES, STAGES, NEEDS_ATTENTION, STAGE_CHOICES, SHEETS, BILL_TYPES, MAX_BILL_BYTES,
  ValidationError, validate: { contact, application, savingsCheck, bill }, normEmail, normPhone,
};
