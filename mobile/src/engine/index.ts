// The one place the app reaches into the website's code. Everything else goes
// through src/api, so when FXMedia's savings endpoint arrives only the mock
// layer stops using this file.

export {
  TARIFF,
  TARIFF_PERIOD,
  RATES_DATE,
  AVAILABLE_PLANS,
  MARKET_PLANS,
  DEFAULT_CURRENT_ID,
  CONTRACT_FILTERS,
  getPlan,
  activePromo,
  monthlyCost,
  compare,
  rateLabel,
  contractLabel,
  fmtMoney,
} from 'eutility-web/calc.js';
export type { SheetPlan, CompareRow } from 'eutility-web/calc.js';

export { CONFIG, waLink, mailLink } from 'eutility-web/config.js';
