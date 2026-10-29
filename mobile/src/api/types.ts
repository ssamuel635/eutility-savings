// ─────────────────────────────────────────────────────────────
// The app's data contract.
//
// Every screen talks to the `Api` interface below and nothing else. Today it's
// served by ./mock (data on the device, prices from the website's engine).
// When FXMedia confirms their API, write an implementation of the same
// interface over fetch() and switch it in ./index.ts — no screen changes.
//
// The `// →` line on each method is the endpoint we'd expect it to map to.
// These are proposals to check against FXMedia's answer, not their spec.
// ─────────────────────────────────────────────────────────────

/** Where a customer or request came from, so the CRM can tell channels apart. */
export type Channel = 'mobile_app' | 'website' | 'whatsapp' | 'referral';

export type Dwelling =
  | 'HDB 1- or 2-room' | 'HDB 3-room' | 'HDB 4-room' | 'HDB 5-room' | 'HDB Executive'
  | 'Condominium / Apartment' | 'Landed property';

// ── Auth ─────────────────────────────────────────────────────
export interface Session {
  token: string;
  customerId: string;
}

export type OtpResult =
  | { status: 'existing'; session: Session }
  /** Phone verified but no account yet — finish with auth.register(). */
  | { status: 'new'; registrationToken: string };

export interface Registration {
  fullName: string;
  email: string;
  address: string;
  postal: string;
  dwelling: Dwelling;
  /** Optional — lets them sign in by email if SMS isn't available. */
  password?: string;
  referredBy?: string;
}

// ── Customer ─────────────────────────────────────────────────
export interface Customer {
  id: string;
  fullName: string;
  phone: string;           // +65XXXXXXXX
  email: string;
  address: string;
  postal: string;
  dwelling: Dwelling | null;  // null: not given yet (e.g. a contact the WhatsApp chatbot made)
  monthlyKwh: number | null;
  currentPlanId: string | null;
  referralCode: string;
  source: Channel;
  createdAt: string;
  preferences: { pushNotifications: boolean; whatsappUpdates: boolean };
}

export type CustomerPatch = Partial<Pick<Customer,
  'fullName' | 'email' | 'address' | 'postal' | 'dwelling' | 'monthlyKwh' | 'currentPlanId' | 'preferences'>>;

// ── Plans & pricing ──────────────────────────────────────────
export interface Promo {
  title: string;
  value: string | null;
  conditions: string | null;
  code: string | null;
  expires: string | null;
}

export interface Plan {
  id: string;
  retailer: string;
  name: string;
  green: boolean;
  regulated: boolean;
  contractMonths: number | null;
  contractLabel: string;   // "24-month contract" / "No lock-in"
  priceLabel: string;      // "29.80¢/kWh", "5% off tariff", …
  deposit: string | null;
  earlyTermination: string | null;
  promo: Promo | null;
  tags: string[];
}

export interface PlanCatalogue {
  plans: Plan[];
  ratesAsAt: string;       // "22 September 2026"
  tariffPeriod: string;    // "Oct–Dec 2026"
  regulatedTariff: number; // ¢/kWh
}

// ── Savings ──────────────────────────────────────────────────
export type ContractFilter = 'none' | '12' | '24' | 'any';

export interface QuoteInput {
  kwh: number;
  currentPlanId: string;
  contract: ContractFilter;
  greenOnly: boolean;
}

export interface PricedPlan {
  plan: Plan;
  monthly: number;         // S$ estimate at this usage
  savingMonthly: number;
  savingYearly: number;
}

export interface SavingsQuote {
  id: string;              // reference passed to WhatsApp / an application
  at: string;
  input: QuoteInput;
  current: { plan: Plan; monthly: number };
  recommended: PricedPlan | null;
  alternatives: PricedPlan[];
  alreadyBest: boolean;
  ratesAsAt: string;
}

// ── Invoices ─────────────────────────────────────────────────
export type InvoiceStatus = 'received' | 'reviewing' | 'accepted' | 'needs_attention';

export interface InvoiceUpload {
  uri: string;
  fileName: string;
  mimeType: string;
  size: number | null;
}

export interface Invoice {
  id: string;
  fileName: string;
  previewUri: string | null;
  billingMonth: string;    // "2026-09"
  status: InvoiceStatus;
  note: string | null;     // e.g. "Photo is blurry — please retake"
  submittedAt: string;
}

// ── Applications (the switch) ────────────────────────────────
export type StageKey = 'submitted' | 'received' | 'retailer' | 'activated';
export type StageState = 'done' | 'current' | 'upcoming';

export interface Stage {
  key: StageKey;
  label: string;
  detail: string;
  state: StageState;
  at: string | null;
}

export interface Application {
  id: string;
  reference: string;       // human-friendly, e.g. "EU-7K3Q9P"
  /** null = customer sent a bill and asked Eutility to recommend a plan. */
  plan: Plan | null;
  estimatedSavingYearly: number;
  invoiceId: string | null;
  quoteId: string | null;
  channel: Channel;
  stages: Stage[];
  status: 'in_progress' | 'active' | 'needs_attention';
  /** A message from Eutility staff, e.g. "Please send page 2 of your bill". */
  staffNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewApplication {
  planId: string | null;
  invoiceId: string;
  quoteId: string | null;
  estimatedSavingYearly: number;
}

// ── Referrals ────────────────────────────────────────────────
export type ReferralStatus = 'invited' | 'signed_up' | 'switched';

export interface Referral {
  id: string;
  name: string;            // first name / initial only
  status: ReferralStatus;
  at: string;
}

export interface ReferralSummary {
  code: string;
  link: string;
  referred: number;
  successful: number;
  /** null until Eutility confirms reward amounts. */
  rewardsEarned: number | null;
  nextRewardAt: number;
  referrals: Referral[];
  sample: boolean;
}

// ── Notifications ────────────────────────────────────────────
export interface Notice {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  link?: '/application' | '/rewards' | '/invoice';
}

// ── The interface every implementation provides ──────────────
export interface Api {
  auth: {
    /** → POST /auth/otp       { phone } */
    requestOtp(phone: string): Promise<{ expiresInSec: number; demoCode?: string }>;
    /** → POST /auth/otp/verify { phone, code } */
    verifyOtp(phone: string, code: string): Promise<OtpResult>;
    /** → POST /auth/register  { registrationToken, ...profile } */
    register(registrationToken: string, details: Registration): Promise<Session>;
    /** → POST /auth/login     { email, password } */
    signInWithEmail(email: string, password: string): Promise<Session>;
    /** → POST /auth/logout */
    signOut(): Promise<void>;
    /** Restore a saved session on launch (real build: secure storage + token refresh). */
    restore(): Promise<Session | null>;
  };
  customer: {
    /** → GET   /customers/me */
    me(): Promise<Customer>;
    /** → PATCH /customers/me */
    update(patch: CustomerPatch): Promise<Customer>;
  };
  plans: {
    /** → GET /plans?status=active   (FXMedia request #1: plan & pricing data) */
    catalogue(): Promise<PlanCatalogue>;
  };
  savings: {
    /** → POST /savings/quote         (FXMedia request #2: one calculation for every channel) */
    quote(input: QuoteInput): Promise<SavingsQuote>;
    /** → GET  /customers/me/quotes?limit=1 */
    latest(): Promise<SavingsQuote | null>;
  };
  invoices: {
    /** → POST /customers/me/invoices  (multipart) */
    submit(file: InvoiceUpload, billingMonth: string): Promise<Invoice>;
    /** → GET  /customers/me/invoices */
    list(): Promise<Invoice[]>;
  };
  applications: {
    /** → POST /customers/me/applications */
    create(input: NewApplication): Promise<Application>;
    /** → GET  /customers/me/applications */
    list(): Promise<Application[]>;
    /** → GET  /applications/:id */
    get(id: string): Promise<Application | null>;
    /**
     * → PATCH /applications/:id  { planId }
     * A different plan picked for a switch that's still with Eutility (the retailer
     * hasn't got it yet). Refused once the retailer is processing it.
     */
    changePlan(id: string, planId: string, estimatedSavingYearly: number): Promise<Application>;
  };
  referrals: {
    /** → GET /customers/me/referrals */
    summary(): Promise<ReferralSummary>;
  };
  notifications: {
    /** → GET  /customers/me/notifications */
    list(): Promise<Notice[]>;
    /** → POST /customers/me/notifications/read */
    markAllRead(): Promise<void>;
  };
  /** Prototype controls for demos. The real API won't have this. */
  demo?: {
    advanceApplication(id: string): Promise<Application | null>;
    reset(): Promise<void>;
    hints: { phone: string; otp: string; email: string; password: string };
  };
}

export type ApiErrorCode = 'invalid_code' | 'invalid_login' | 'expired' | 'not_signed_in' | 'network' | 'validation';

/** Errors the UI knows how to explain. */
export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
