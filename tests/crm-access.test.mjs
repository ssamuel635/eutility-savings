// Who may change what through /api/crm (server/crm/routes.js). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { createExcelCrm } = require('../server/crm/excel.js');
const { createCrmRoutes } = require('../server/crm/routes.js');
const { createTokens } = require('../server/auth/tokens.js');
const { validate } = require('../server/crm/schema.js');

const env = { AUTH_SECRET: 'test-secret' };

async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eu-crm-access-'));
  const file = path.join(dir, 'crm.xlsx');
  const crm = createExcelCrm({ file });
  const tokens = createTokens(env);
  const crmIds = {};                       // customerId → CRM contact id (what server/auth keeps)
  const auth = { tokens, customers: { crmIdOf: async (id) => crmIds[id] || null } };
  const routes = createCrmRoutes(crm, env, auth);
  const server = http.createServer((req, res) => routes(req, res, new URL(req.url, 'http://x')));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body, token) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  /** The Customers sheet as objects keyed by header. */
  const customers = async () => {
    await crm.flush();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('Customers');
    const head = ws.getRow(1).values;
    const out = [];
    ws.eachRow((row, n) => { if (n > 1) out.push(Object.fromEntries(head.map((h, i) => [h, row.getCell(i).value ?? '']).filter(([h]) => h))); });
    return out;
  };
  return { crm, tokens, crmIds, call, customers, close: () => { server.close(); crm.close(); } };
}

test('without a session, a known number only fills empty fields', async () => {
  const s = await start();
  await s.crm.upsertContact(validate.contact({ fullName: 'Alex Tan', phone: '91234567', email: 'alex@example.com', address: '1 Real Road' }));
  const r = await s.call('POST', '/api/crm/contacts', { contact: { phone: '9123 4567', email: 'attacker@evil.example', address: '9 Fake Street', postal: '560123' } });
  assert.equal(r.status, 200);
  const [alex, ...others] = await s.customers();
  assert.equal(others.length, 0, 'no duplicate contact');
  assert.equal(alex.Address, '1 Real Road', 'address not changed');
  assert.equal(alex.Email, 'alex@example.com', 'email not changed');
  assert.equal(String(alex['Postal code']), '560123', 'an empty field may be filled');
  s.close();
});

test('a new contact can still be created without a session (website sign-ups)', async () => {
  const s = await start();
  const r = await s.call('POST', '/api/crm/contacts', { contact: { fullName: 'Priya Sharma', phone: '98765432', address: '2 New Lane' } });
  assert.equal(r.status, 200);
  const [priya] = await s.customers();
  assert.equal(priya.Address, '2 New Lane');
  s.close();
});

test('with a session, the contact is always the signed-in number and may be updated', async () => {
  const s = await start();
  await s.crm.upsertContact(validate.contact({ fullName: 'Alex Tan', phone: '91234567', address: '1 Real Road' }));
  await s.crm.upsertContact(validate.contact({ fullName: 'Bea Lim', phone: '98887777', address: '5 Bea Road' }));
  const alexToken = s.tokens.session('CUST-ALEX01', '+6591234567');

  // Alex tries to write to Bea's number: it lands on Alex's own record.
  await s.call('POST', '/api/crm/contacts', { contact: { phone: '98887777', address: '3 Moved Avenue' } }, alexToken);
  const rows = await s.customers();
  assert.equal(rows.find((c) => c.Name === 'Bea Lim').Address, '5 Bea Road', 'other customers untouched');
  assert.equal(rows.find((c) => c.Name === 'Alex Tan').Address, '3 Moved Avenue', 'own details updated');

  // A bill needs no contact in the body when signed in.
  const bill = await s.call('POST', '/api/crm/bills', { bill: { mimeType: 'application/pdf', fileName: 'sp.pdf', dataBase64: Buffer.from('%PDF-1.4').toString('base64') } }, alexToken);
  assert.equal(bill.status, 200);
  s.close();
});

test('applications are read only with a session, and only your own', async () => {
  const s = await start();
  const { id: alexCrm } = await s.crm.upsertContact(validate.contact({ fullName: 'Alex Tan', phone: '91234567' }));
  const { id: beaCrm } = await s.crm.upsertContact(validate.contact({ fullName: 'Bea Lim', phone: '98887777' }));
  await s.crm.createApplication(alexCrm, {}, validate.application({ reference: 'EU-ALEX01', plan: 'Geneco · Get It Fixed 24' }));
  await s.crm.createApplication(beaCrm, {}, validate.application({ reference: 'EU-BEA001', plan: 'Senoko · LifePower24' }));
  s.crmIds['CUST-ALEX01'] = alexCrm;

  assert.equal((await s.call('GET', `/api/crm/applications?contactId=${beaCrm}`)).status, 401, 'no session, no read');
  const own = await s.call('GET', `/api/crm/applications?contactId=${beaCrm}`, null, s.tokens.session('CUST-ALEX01', '+6591234567'));
  assert.deepEqual(own.body.applications.map((a) => a.reference), ['EU-ALEX01'], 'the contactId in the URL is ignored');
  const none = await s.call('GET', '/api/crm/applications', null, s.tokens.session('CUST-NEW001', '+6590000001'));
  assert.deepEqual(none.body.applications, [], 'not in the CRM yet');
  s.close();
});
