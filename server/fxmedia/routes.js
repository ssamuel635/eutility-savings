// ─────────────────────────────────────────────────────────────
// The app's savings check and switch, through FXMedia (CUSTOMER_SOURCE=fxmedia),
// so the app, the WhatsApp chatbot and Eutility's reports use the same plans,
// prices and sign-ups. Signed-in customers only; the number is the session's.
//
//   POST /api/savings/quote  { kwh, currentRetailer, currentPlanId, contract, greenOnly }
//        → saves usage and current retailer on the contact, then FXMedia's
//          comparison: { calculatedOn, current: { provider, monthly }, plans: [{ plan, monthly, … }] }
//   POST /api/switch         { planId, promoCode? } → FXMedia sign-up: { reference, duplicate, signedAt, promoApplied }
//        (a code FXMedia refuses for that plan: signed up without it, promoApplied false)
//
// Plans come back in the app's Plan shape (mobile/src/api/types.ts). Their ids
// are FXMedia's plan ids, which /api/switch needs. FXMedia prices against the
// SP tariff; the app works out the saving against the customer's own plan.
// Without CUSTOMER_SOURCE=fxmedia these routes answer 404 { code: 'not_available' }
// and the app prices on the device as before.
// ─────────────────────────────────────────────────────────────

const { ValidationError } = require('../crm/schema');
const { makeOriginGuard, readJson, json } = require('../http');

const CONTRACT = {
  none: (m) => !m,
  12: (m) => (m ?? 0) <= 12,
  24: (m) => (m ?? 0) <= 24,
  any: () => true,
};
const MAX_PLANS = 6; // the recommended plan and five alternatives, as the app shows

const money = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);

/** One of FXMedia's top_plans → the app's Plan. */
function toPlan(p) {
  const months = Number(p.contract_term_months) || null;
  const types = p.pricing_types || [];
  const rate = Number(p.effective_rate_cents_kwh ?? p.rate);
  const promo = (p.promotions || [])[0];
  const tags = [];
  if (p.is_green) tags.push('Green');
  if (!months) tags.push('No lock-in');
  if (types.includes('tou')) tags.push('Cheaper off-peak');
  if (types.includes('dot')) tags.push('Follows SP tariff');
  if (types.includes('tiered')) tags.push('Tiered rates');
  if (Number(p.monthly_fixed_charges_sgd) > 0) tags.push('Daily charge');
  if (promo) tags.push('Promotion');
  return {
    id: String(p.plan_id),
    retailer: p.retailer,
    name: p.plan,
    green: !!p.is_green,
    regulated: false,
    contractMonths: months,
    contractLabel: months ? `${months}-month contract` : 'No lock-in',
    priceLabel: Number.isFinite(rate) ? `${rate.toFixed(2)}¢/kWh${p.rate_is_average ? ' (average)' : ''}` : '',
    deposit: null,
    earlyTermination: p.early_termination_fee || null,
    promo: promo ? {
      title: promo.name,
      value: promo.display_value || (promo.value ? `S$${promo.value}` : null),
      conditions: promo.eligibility || promo.description || null,
      code: promo.promo_code || null,
      expires: promo.end_date || null,
    } : null,
    tags,
  };
}

/** FXMedia's comparison → what the app needs, filtered like the app's own check. */
function toQuote(data, { contract = 'any', greenOnly = false } = {}) {
  const fits = CONTRACT[contract] || CONTRACT.any;
  const plans = (data.top_plans || [])
    .filter((p) => fits(Number(p.contract_term_months) || null))
    .filter((p) => !greenOnly || p.is_green)
    .slice(0, MAX_PLANS)
    .map((p) => ({ plan: toPlan(p), monthly: money(p.monthly_cost_sgd), savingMonthly: money(p.monthly_saving_sgd), savingYearly: money(p.annual_saving_sgd) }));
  return {
    calculatedOn: data.calculated_on || null,
    current: { provider: data.current?.provider || null, monthly: money(data.current?.monthly_cost_sgd) },
    plans,
  };
}

function createFxmediaRoutes({ client, tokens, env = process.env }) {
  const guard = makeOriginGuard(env);
  const fail = (status, error, code) => Object.assign(new Error(error), { status, code });

  function signedIn(req) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    const claims = m && tokens.read(m[1], 'session');
    if (!claims) throw fail(401, 'Please sign in again.', 'not_signed_in');
    return claims;
  }

  return async function handle(req, res, url) {
    if (guard(req, res)) return;
    const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
    try {
      if (!client) throw fail(404, 'Not available on this server', 'not_available');
      switch (route) {
        case 'POST /api/savings/quote': {
          const { phone } = signedIn(req);
          const b = await readJson(req, 4096);
          const kwh = Math.round(Number(b.kwh));
          if (!(kwh >= 1 && kwh <= 100_000)) throw new ValidationError('Usage must be between 1 and 100,000 kWh');
          // FXMedia compares from what the contact holds, so save the inputs there first
          await client.updateContact({
            phone,
            monthly_usage_kwh: kwh,
            ...(b.currentRetailer ? { current_retailer: String(b.currentRetailer).slice(0, 100) } : {}),
            ...(b.currentPlanId ? { current_plan: String(b.currentPlanId).slice(0, 100) } : {}),
          });
          const data = await client.comparison(phone, { preference: b.greenOnly ? 'green' : 'default', limit: 'all' });
          return json(res, 200, toQuote(data, { contract: b.contract, greenOnly: !!b.greenOnly }));
        }

        case 'POST /api/switch': {
          const { phone } = signedIn(req);
          const b = await readJson(req, 4096);
          const planId = String(b.planId || '').trim();
          if (!/^[A-Za-z0-9_-]{1,64}$/.test(planId)) throw new ValidationError('Choose a plan first');
          const promo = String(b.promoCode || '').trim().slice(0, 50);
          let r, promoApplied = !!promo;
          try {
            r = await client.signUp(phone, planId, promo);
          } catch (e) {
            // A code that doesn't apply (e.g. another customer group's) doesn't stop the switch: FXMedia's advice is to resend without it
            if (!promo || e.code !== 'PROMO_CODE_INVALID') throw e;
            r = await client.signUp(phone, planId, '');
            promoApplied = false;
          }
          return json(res, 200, { reference: r.customer_id, duplicate: !!r.duplicate, signedAt: r.signed_at || null, promoApplied });
        }

        default:
          return json(res, 404, { error: 'Not found' });
      }
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[fxmedia]', e.code || '', e.message);
      const code = e.code === 'not_signed_in' || e.code === 'not_available' ? e.code : status === 400 || status === 409 ? 'validation' : undefined;
      return json(res, status, { error: status >= 500 ? 'We couldn’t reach our plan service. Please try again.' : e.message, ...(code ? { code } : {}) });
    }
  };
}

module.exports = { createFxmediaRoutes, toPlan, toQuote };
