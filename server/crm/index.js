// Picks the CRM. Everything else talks to the object this returns, never to
// Excel or Freshworks directly — swapping CRMs is CRM_PROVIDER, nothing more.
//
//   CRM_PROVIDER=excel        (default) data/crm/eutility-customers.xlsx
//                             CRM_EXCEL_PATH to put the workbook elsewhere,
//                             e.g. a synced OneDrive/SharePoint folder
//   CRM_PROVIDER=freshworks   FRESHWORKS_DOMAIN + FRESHWORKS_API_KEY

const { createExcelCrm } = require('./excel');
const { createFreshworksCrm } = require('./freshworks');

function createCrm(env = process.env) {
  const provider = (env.CRM_PROVIDER || 'excel').toLowerCase();
  if (provider === 'excel') return createExcelCrm({ file: env.CRM_EXCEL_PATH || undefined });
  if (provider === 'freshworks') return createFreshworksCrm({ domain: env.FRESHWORKS_DOMAIN, apiKey: env.FRESHWORKS_API_KEY });
  throw new Error(`Unknown CRM_PROVIDER "${provider}" — use excel or freshworks`);
}

module.exports = { createCrm };
