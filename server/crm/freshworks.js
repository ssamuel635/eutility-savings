// ─────────────────────────────────────────────────────────────
// Freshworks CRM adapter — same interface as excel.js.
// Switch to it with CRM_PROVIDER=freshworks and:
//   FRESHWORKS_DOMAIN   e.g. eutility.myfreshworks.com   (Profile → API Settings → bundle alias)
//   FRESHWORKS_API_KEY  (Profile → API Settings)
//
// Confirmed against developers.freshworks.com/crm/api: contact upsert,
// deal create, deal stages, `Authorization: Token token=…`, 1,000 req/hour.
// VERIFY in a sandbox before going live (marked below): the note and file
// request bodies, and the custom field names — create these on the Contact
// and Deal forms first, or rename them here to match yours.
// ─────────────────────────────────────────────────────────────

const { STAGES, NEEDS_ATTENTION } = require('./schema');

function createFreshworksCrm({ domain = process.env.FRESHWORKS_DOMAIN, apiKey = process.env.FRESHWORKS_API_KEY } = {}) {
  if (!domain || !apiKey) throw new Error('CRM_PROVIDER=freshworks needs FRESHWORKS_DOMAIN and FRESHWORKS_API_KEY');
  const base = `https://${domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/crm/sales/api`;

  async function call(method, pathname, body, { form } = {}) {
    const res = await fetch(base + pathname, {
      method,
      headers: { Authorization: `Token token=${apiKey}`, ...(form ? {} : { 'Content-Type': 'application/json' }) },
      body: form || (body ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) throw Object.assign(new Error('Freshworks rate limit reached (1,000 requests/hour)'), { status: 503 });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(`Freshworks ${method} ${pathname} → ${res.status}: ${JSON.stringify(data.errors || data).slice(0, 300)}`), { status: 502 });
    return data;
  }

  // Deal stage names ↔ ids, fetched once.
  let stages;
  async function stageMap() {
    if (!stages) {
      const d = await call('GET', '/selector/deal_stages');
      stages = (d.deal_stages || []).map((s) => ({ id: s.id, name: s.name }));
    }
    return stages;
  }

  const splitName = (full) => {
    const parts = String(full || '').trim().split(/\s+/);
    return { first_name: parts.slice(0, -1).join(' ') || parts[0] || '', last_name: parts.length > 1 ? parts.at(-1) : '' };
  };

  return {
    provider: 'freshworks',
    where: domain,

    async upsertContact(c) {
      // The mobile number is the customer ID everywhere (agreed with FXMedia,
      // stored as +6591234567); email only for website contacts without one.
      const unique = c.phone ? { mobile_number: c.phone } : { emails: c.email };
      const d = await call('POST', '/contacts/upsert', {
        unique_identifier: unique,
        contact: {
          ...splitName(c.fullName),
          emails: c.email ? [{ value: c.email, is_primary: true }] : undefined,
          mobile_number: c.phone || undefined,
          address: [c.address, c.unit].filter(Boolean).join(', ') || undefined,
          zipcode: c.postal || undefined,
          country: 'Singapore',
          // VERIFY: custom fields must exist on your Contact form.
          custom_field: {
            cf_source: c.source, cf_lead_type: c.leadType, cf_source_page: c.sourcePage, cf_last_action: c.lastAction,
            cf_home_type: c.dwelling, cf_monthly_kwh: c.monthlyKwh, cf_current_plan: c.currentPlan, cf_sp_account: c.spAccount,
            cf_referral_code: c.referralCode, cf_referred_by: c.referredBy,
            cf_terms_accepted_at: c.termsAcceptedAt, cf_contact_consent: c.contactConsent,
          },
        },
      });
      return { id: String(d.contact?.id), created: false };
    },

    async createApplication(contactId, contact, a) {
      const first = (await stageMap()).find((s) => s.name === STAGES[0]);
      const d = await call('POST', '/deals', {
        deal: {
          name: `${a.reference || 'Switch'} · ${a.plan}`,
          amount: Math.max(0, a.estimatedSavingYearly),
          contacts_added_list: [Number(contactId)],
          deal_stage_id: first?.id,
          custom_field: { cf_reference: a.reference, cf_channel: a.channel, cf_plan: a.plan }, // VERIFY
        },
      });
      return { reference: a.reference || String(d.deal?.id) };
    },

    async listApplications(contactId) {
      const [d, map] = await Promise.all([call('GET', `/contacts/${encodeURIComponent(contactId)}?include=deals`), stageMap()]);
      return (d.deals || []).map((deal) => {
        const name = map.find((s) => s.id === deal.deal_stage_id)?.name || '';
        return {
          reference: deal.custom_field?.cf_reference || String(deal.id),
          createdAt: deal.created_at,
          contactId,
          plan: deal.custom_field?.cf_plan || deal.name,
          estimatedSavingYearly: Number(deal.amount) || 0,
          channel: deal.custom_field?.cf_channel || '',
          stage: [...STAGES, NEEDS_ATTENTION].includes(name) ? name : STAGES[0],
          stageUpdatedAt: deal.stage_updated_time || deal.updated_at,
          staffNote: deal.custom_field?.cf_note_to_customer || '',
        };
      });
    },

    async logSavingsCheck(contactId, c) {
      // Someone who tapped Switch without an account has no contact yet: the
      // reference in their WhatsApp message links it once they write in.
      if (!contactId) return { id: c.reference || '' };
      // VERIFY: note body shape.
      await call('POST', '/notes', {
        note: {
          description: [
            `${c.action} (${c.channel}${c.sourcePage ? `, ${c.sourcePage}` : ''})${c.reference ? ` · ref ${c.reference}` : ''}`,
            `${c.kwh} kWh/month on ${c.currentPlan} → ${c.bestPlan}`,
            `Saving about S$${c.savingMonthly}/month, S$${c.savingYearly}/year`,
            `Filters: ${c.contractFilter || 'default'}${c.greenOnly === 'Yes' ? ', green only' : ''} · rates as at ${c.ratesDate}, SP tariff ${c.tariffPeriod}`,
          ].join('\n'),
          targetable_type: 'Contact',
          targetable_id: Number(contactId),
        },
      });
      return { id: c.reference || '' };
    },

    async logBusinessEnquiry(contactId, contact, e) {
      const d = await call('POST', '/deals', {
        deal: {
          name: `${e.companyName || 'Business enquiry'} · ${e.siteCount} site${e.siteCount === 1 ? '' : 's'}`,
          amount: Math.max(0, e.savingYearly || 0),
          contacts_added_list: contactId ? [Number(contactId)] : undefined,
          custom_field: { cf_reference: e.reference, cf_lead_type: 'Business', cf_sites: e.sites, cf_total_kwh: e.totalKwh, cf_tier: e.tier, cf_channel: e.channel }, // VERIFY
        },
      });
      return { id: e.reference || String(d.deal?.id) };
    },

    async saveBill(contactId, b) {
      // VERIFY: multipart field names for /documents.
      const form = new FormData();
      form.append('file', new Blob([b.data], { type: b.mimeType }), b.fileName);
      form.append('targetable_type', 'Contact');
      form.append('targetable_id', String(contactId));
      const d = await call('POST', '/documents', null, { form });
      return { id: String(d.document?.id ?? d.id) };
    },

    flush: async () => 0,
    pendingCount: () => 0,
    close: () => {},
  };
}

module.exports = { createFreshworksCrm };
