// Types for the website's plain-JS pricing engine and config, which the app
// imports directly (see metro.config.js). Only what the app uses is declared.

declare module 'eutility-web/calc.js' {
  export interface SheetPromo {
    title: string;
    code: string | null;
    conditions: string | null;
    value: string | null;
    expires: string | null;
  }
  export interface SheetPlan {
    id: string;
    retailer: string;
    name: string;
    category: string;
    pricingType: 'fixed' | 'regulated' | 'dot' | 'tou' | 'tiered' | 'unknown';
    contractMonths: number | null;
    rate: number | null;
    dailyCharge: number;
    deposit: string | null;
    etf: string | null;
    available: boolean;
    referralOnly?: boolean;
    promo: SheetPromo | null;
    tou: { weekendOffPeak?: boolean } | null;
  }
  export interface CostRow {
    plan: SheetPlan;
    energy: number;
    daily: number;
    total: number;
    effectiveRate: number;
  }
  export interface CompareRow extends CostRow {
    savingMonthly: number;
    savingYearly: number;
  }
  export interface CompareResult {
    current: CostRow;
    results: CompareRow[];
    best: CompareRow | null;
    alreadyBest: boolean;
    noMatches: boolean;
    tiedWith: number;
  }

  export const TARIFF: number;
  export const TARIFF_PERIOD: string;
  export const RATES_DATE: string;
  export const AVAILABLE_PLANS: SheetPlan[];
  export const MARKET_PLANS: SheetPlan[];
  export const DEFAULT_CURRENT_ID: string;
  export const CONTRACT_FILTERS: Record<'none' | '12' | '24' | 'any', { label: string }>;
  export function getPlan(id: string): SheetPlan | null;
  export function activePromo(plan: SheetPlan, now?: Date): SheetPromo | null;
  export function monthlyCost(plan: SheetPlan, kwh: number, opts?: { offPeakShare?: number }): Omit<CostRow, 'plan'>;
  export function compare(input: {
    kwh: number;
    currentId?: string;
    contract?: 'none' | '12' | '24' | 'any';
    greenOnly?: boolean;
    includeReferralOnly?: boolean;
    offPeakShare?: number;
  }): CompareResult;
  export function rateLabel(plan: SheetPlan): string;
  export function contractLabel(months: number | null): string;
  export function fmtMoney(n: number, dp?: number): string;
}

declare module 'eutility-web/config.js' {
  export const CONFIG: {
    brand: string;
    whatsappNumber: string;
    chatbotTrigger: string;
    email: string;
    phone: string;
    defaultKwh: number;
    minKwh: number;
    maxKwh: number;
    defaultOffPeakShare: number;
    confettiThreshold: number;
    homePresets: { label: string; kwh: number }[];
    rewards: { programmeName: string; nextRewardAt: number; pointsPerSwitch: number; featured: string; catalogue: { id: string; name: string; points: number; img: string }[] };
    links: Record<string, string>;
    company: Record<string, string | number>;
  };
  export function waLink(message?: string): string;
  export function mailLink(message?: string, subject?: string): string;
}
