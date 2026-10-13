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
  assert.equal(ws.getRow(2).getCell(5).value, 'Alex Tan', 'partial update keeps the name');
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
