// Excel CRM adapter + validation. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { createExcelCrm } = require('../server/crm/excel.js');
const { validate, STAGES } = require('../server/crm/schema.js');

function tmpCrm() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eu-crm-'));
  const file = path.join(dir, 'crm.xlsx');
  return { crm: createExcelCrm({ file }), file, dir };
}

const alex = validate.contact({ source: 'mobile_app', fullName: 'Alex Tan', email: 'Alex@Example.com', phone: '9123 4567', postal: '520123' });

test('validation normalises contacts and rejects bad input', () => {
  assert.equal(alex.email, 'alex@example.com');
  assert.equal(alex.phone, '+6591234567');
  assert.throws(() => validate.contact({ fullName: 'No way to reach me' }), /email or a mobile/);
  assert.throws(() => validate.contact({ email: 'not-an-email' }), /Invalid email/);
  assert.throws(() => validate.bill({ mimeType: 'text/html', dataBase64: 'aGk=' }), /PDF or a photo/);
  assert.equal(validate.bill({ mimeType: 'application/pdf', fileName: '../../etc/passwd', dataBase64: 'aGk=' }).fileName, '.._.._etc_passwd');
});

test('a contact is upserted by email, not duplicated', async () => {
  const { crm, file } = tmpCrm();
  const first = await crm.upsertContact(alex);
  const again = await crm.upsertContact(validate.contact({ email: 'alex@example.com', monthlyKwh: 450 }));
  assert.equal(again.id, first.id);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Customers');
  assert.equal(ws.actualRowCount, 2, 'header + one customer');
  assert.equal(ws.getRow(2).getCell(ws.getRow(1).values.indexOf('Name')).value, 'Alex Tan', 'partial update keeps the name');
  crm.close();
});

test('applications start at the first stage, and staff edits in Excel are read back', async () => {
  const { crm, file } = tmpCrm();
  const { id } = await crm.upsertContact(alex);
  const { reference } = await crm.createApplication(id, alex, validate.application({ reference: 'EU-TEST01', plan: 'Geneco · Get It Fixed 24', estimatedSavingYearly: 163 }));
  assert.equal(reference, 'EU-TEST01');
  let [app] = await crm.listApplications(id);
  assert.equal(app.stage, STAGES[0]);

  // A member of staff moves it on in Excel and saves.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Applications');
  const stageCol = ws.getRow(1).values.indexOf('Stage');
  ws.getRow(2).getCell(stageCol).value = 'Retailer processing';
  await wb.xlsx.writeFile(file);

  // The next write must not undo their edit.
  await crm.logSavingsCheck(id, validate.savingsCheck({ kwh: 450, savingYearly: 163 }));
  [app] = await crm.listApplications(id);
  assert.equal(app.stage, 'Retailer processing');
  crm.close();
});

test('bills are saved to disk and listed in the Bills sheet', async () => {
  const { crm, dir } = tmpCrm();
  const { id } = await crm.upsertContact(alex);
  const r = await crm.saveBill(id, validate.bill({ mimeType: 'application/pdf', fileName: 'sp-bill.pdf', dataBase64: Buffer.from('%PDF-1.4 test').toString('base64'), billingMonth: '2026-09' }));
  const saved = fs.readdirSync(path.join(dir, 'bills'));
  assert.deepEqual(saved, [`${r.id}.pdf`]);
  crm.close();
});

test('while Excel has the file locked, writes queue and land later', async () => {
  const { crm, file } = tmpCrm();
  await crm.upsertContact(alex);
  const realRename = fs.renameSync;
  fs.renameSync = () => { throw Object.assign(new Error('locked'), { code: 'EBUSY' }); };
  try {
    const r = await crm.upsertContact(validate.contact({ fullName: 'Priya Sharma', email: 'priya@example.com' }));
    assert.equal(r.queued, true);
    assert.equal(crm.pendingCount(), 1);
  } finally {
    fs.renameSync = realRename;
  }
  assert.equal(await crm.flush(), 1);
  assert.equal(crm.pendingCount(), 0);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  assert.equal(wb.getWorksheet('Customers').actualRowCount, 3);
  crm.close();
});

test('contacts carry lead type, page, action, unit, SP account and consent times', () => {
  const c = validate.contact({
    email: 'a@b.co', leadType: 'Residential', sourcePage: '/signup.html', lastAction: 'account_created', unit: '#08-45',
    spAccount: '93-1234-5678', termsAcceptedAt: '2026-10-13T01:00:00Z', contactConsentAt: '2026-10-13T01:00:05Z',
  });
  assert.equal(c.lastAction, 'Account created');
  assert.equal(c.unit, '#08-45');
  assert.equal(c.spAccount, '93-1234-5678');
  assert.equal(c.termsAcceptedAt, '2026-10-13 09:00:00', 'stored in Singapore time');
  assert.equal(c.contactConsent, '2026-10-13 09:00:05');
  assert.equal(validate.contact({ email: 'a@b.co', contactConsentAt: false }).contactConsent, 'No');
  assert.equal(validate.contact({ email: 'a@b.co', sourcePage: '<script>' }).sourcePage, '', 'odd page values are dropped');
});

test('a comparison can be saved without an account, under its own reference', async () => {
  const { crm, file } = tmpCrm();
  const check = validate.savingsCheck({
    reference: 'EC-7K3Q9P', action: 'switch_whatsapp', kwh: 450, currentPlan: 'SP Group · Regulated Tariff', bestPlan: 'Geneco · Get It Fixed 24',
    savingMonthly: 9.72, savingYearly: 116.64, contractFilter: 'Up to 24 months', greenOnly: false, ratesDate: '12 October 2026', tariffPeriod: 'Oct–Dec 2026',
  });
  const r = await crm.logSavingsCheck('', check);
  assert.equal(r.id, 'EC-7K3Q9P');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Savings checks');
  const h = ws.getRow(1).values;
  const row = ws.getRow(2);
  assert.equal(row.getCell(h.indexOf('Reference')).value, 'EC-7K3Q9P');
  assert.equal(row.getCell(h.indexOf('Action')).value, 'Switch request (WhatsApp)');
  assert.equal(row.getCell(h.indexOf('Green only')).value, 'No');
  assert.equal(row.getCell(h.indexOf('Customer ID')).value, null);
  assert.equal(validate.savingsCheck({ reference: 'DROP TABLE' }).reference, '', 'only EC-XXXXXX references are kept');
  crm.close();
});

test('business enquiries list each site and the total', async () => {
  const { crm, file } = tmpCrm();
  const e = validate.businessEnquiry({ reference: 'EB-4M8W2Q', companyName: 'Kopi & Co', sites: [{ name: 'Tampines', kwh: 2000 }, { name: 'Bedok', kwh: 1500 }, { name: 'Empty', kwh: 0 }], savingYearly: 900, tier: 'Bronze' });
  assert.equal(e.siteCount, 2);
  assert.equal(e.totalKwh, 3500);
  await crm.logBusinessEnquiry('', null, e);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('Business enquiries');
  const h = ws.getRow(1).values;
  assert.equal(ws.getRow(2).getCell(h.indexOf('Sites and usage')).value, 'Tampines: 2,000 kWh; Bedok: 1,500 kWh');
  assert.equal(ws.getRow(2).getCell(h.indexOf('Status')).value, 'New');
  assert.throws(() => validate.businessEnquiry({ sites: [] }), /at least one site/);
  crm.close();
});
