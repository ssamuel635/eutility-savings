// Customer sign-in: SMS provider + signed tokens + customer directory → routes.
// Settings (all optional locally): SMS_PROVIDER, AUTH_SECRET, CUSTOMER_SOURCE —
// see sms.js, tokens.js and customers.js.

const { createSms } = require('./sms');
const { createTokens } = require('./tokens');
const { createCustomers } = require('./customers');
const { createAuthRoutes } = require('./routes');

function createAuth({ env = process.env, crm = null } = {}) {
  const sms = createSms(env);
  const tokens = createTokens(env);
  const customers = createCustomers({ env, crm });
  return {
    routes: createAuthRoutes({ sms, tokens, customers, env }),
    tokens,    // the CRM routes read sessions with these
    customers,
    describe: `SMS via ${sms.provider}; customers in ${customers.source} → ${customers.where}`,
  };
}

module.exports = { createAuth };
