// ─────────────────────────────────────────────────────────────
// Excel CRM adapter — the interim "CRM" is one workbook on disk.
//
// Staff open data/crm/eutility-customers.xlsx in Excel to see sign-ups,
// switch applications, savings checks and bills, and can move an
// application along by changing its Stage (the app shows the new stage).
//
// Two rules keep that safe:
//  1. Every write re-reads the file first, so edits staff saved are kept.
//  2. While Excel has the file open, Windows locks it. Writes then go to
//     pending.jsonl beside it and are applied on the next successful save.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { SHEETS, STAGE_CHOICES, STAGES, findMatch } = require('./schema');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const uid = (prefix, n = 8) => prefix + Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join('');
// Singapore time, as staff read it: "2026-10-13 09:43:59".
const now = () => new Date(Date.now() + 8 * 3600_000).toISOString().replace('T', ' ').slice(0, 19);

function createExcelCrm({ file, billsDir } = {}) {
  const FILE = path.resolve(file || path.join(__dirname, '..', '..', 'data', 'crm', 'eutility-customers.xlsx'));
  const DIR = path.dirname(FILE);
  const BILLS = path.resolve(billsDir || path.join(DIR, 'bills'));
  const JOURNAL = path.join(DIR, 'pending.jsonl');
  let chain = Promise.resolve();

  /** One operation at a time, in order — two requests never write over each other. */
  const serial = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  // ── Workbook I/O ──────────────────────────────────────────
  async function load() {
    const wb = new ExcelJS.Workbook();
    if (fs.existsSync(FILE)) await wb.xlsx.readFile(FILE);
    for (const [, def] of Object.entries(SHEETS)) ensureSheet(wb, def);
    return wb;
  }

  function ensureSheet(wb, def) {
    let ws = wb.getWorksheet(def.name);
    if (!ws) {
      ws = wb.addWorksheet(def.name, { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = def.columns.map(([key, header, width]) => ({ key, header, width }));
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF294671' } };
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: def.columns.length } };
    } else {
      // Columns are matched by header text, so staff can reorder or add columns.
      const headers = headerMap(ws);
      def.columns.forEach(([key, header]) => {
        if (!headers[header]) { const c = ws.columnCount + 1; ws.getRow(1).getCell(c).value = header; headers[header] = c; }
      });
    }
    return ws;
  }

  function headerMap(ws) {
    const map = {};
    ws.getRow(1).eachCell((cell, col) => { if (cell.value) map[String(cell.value).trim()] = col; });
    return map;
  }

  const sheet = (wb, type) => wb.getWorksheet(SHEETS[type].name);
  const cols = (wb, type) => {
    const h = headerMap(sheet(wb, type));
    return Object.fromEntries(SHEETS[type].columns.map(([key, header]) => [key, h[header]]));
  };

  function readRows(wb, type) {
    const ws = sheet(wb, type);
    const c = cols(wb, type);
    const rows = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const rec = { _row: n };
      for (const [key, col] of Object.entries(c)) rec[key] = cellText(row.getCell(col).value);
      rows.push(rec);
    });
    return rows;
  }

  function cellText(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return new Date(v.getTime() + 8 * 3600_000).toISOString().replace('T', ' ').slice(0, 19);
    if (typeof v === 'object') return String(v.text ?? v.result ?? v.richText?.map((r) => r.text).join('') ?? '');
    return String(v);
  }

  function writeRow(wb, type, record, rowNumber) {
    const ws = sheet(wb, type);
    const c = cols(wb, type);
    const row = rowNumber ? ws.getRow(rowNumber) : ws.getRow(ws.actualRowCount + 1);
    for (const [key, col] of Object.entries(c)) {
      if (record[key] === undefined) continue;
      // Plain values only: strings stay text in the workbook, never formulas.
      row.getCell(col).value = record[key] === '' ? null : record[key];
    }
    row.commit();
  }

  function addStageDropdown(wb) {
    const ws = sheet(wb, 'applications');
    const col = cols(wb, 'applications').stage;
    const letter = ws.getColumn(col).letter;
    ws.dataValidations.add(`${letter}2:${letter}5000`, {
      type: 'list', allowBlank: true, showErrorMessage: true,
      formulae: [`"${STAGE_CHOICES.join(',')}"`],
      errorTitle: 'Pick a stage', error: `Choose one of: ${STAGE_CHOICES.join(', ')}`,
    });
  }

  async function save(wb) {
    fs.mkdirSync(DIR, { recursive: true });
    addStageDropdown(wb);
    const tmp = `${FILE}.${process.pid}.tmp`;
    await wb.xlsx.writeFile(tmp);
    try {
      fs.renameSync(tmp, FILE); // atomic: the file is never half-written
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      throw e;
    }
  }

  const locked = (e) => ['EBUSY', 'EPERM', 'EACCES'].includes(e?.code);

  // ── Operations (each is a pure change to a loaded workbook) ─
  const OPS = {
    upsertContact(wb, { id, contact }) {
      const rows = readRows(wb, 'contacts');
      const hit = findMatch(rows, contact);
      if (hit) {
        // Don't blank out what we already know with empty fields from a partial update.
        const patch = Object.fromEntries(Object.entries(contact).filter(([, v]) => v !== '' && v !== null));
        writeRow(wb, 'contacts', { ...patch, updatedAt: now() }, hit._row);
        return { id: hit.id, created: false };
      }
      writeRow(wb, 'contacts', { id, createdAt: now(), updatedAt: now(), ...contact });
      return { id, created: true };
    },
    createApplication(wb, { contactId, contact, application, reference }) {
      const exists = readRows(wb, 'applications').find((r) => r.reference === reference);
      if (exists) return { reference };
      writeRow(wb, 'applications', {
        ...application, reference, createdAt: now(), contactId,
        contactName: contact.fullName, contactEmail: contact.email, contactPhone: contact.phone,
        stage: STAGES[0], stageUpdatedAt: now(),
      });
      return { reference };
    },
    logSavingsCheck(wb, { id, contactId, check }) {
      if (readRows(wb, 'savingsChecks').some((r) => r.id === id)) return { id };
      const { reference: _r, ...rest } = check;
      writeRow(wb, 'savingsChecks', { id, at: now(), contactId: contactId || '', ...rest });
      return { id };
    },
    logBusinessEnquiry(wb, { id, contactId, contact, enquiry }) {
      if (readRows(wb, 'businessEnquiries').some((r) => r.id === id)) return { id };
      const { reference: _r, ...rest } = enquiry;
      writeRow(wb, 'businessEnquiries', {
        id, at: now(), contactId: contactId || '', ...rest,
        contactName: contact?.fullName || '', email: contact?.email || '', phone: contact?.phone || '', status: 'New',
      });
      return { id };
    },
    saveBill(wb, { id, contactId, meta }) {
      if (readRows(wb, 'bills').some((r) => r.id === id)) return { id };
      writeRow(wb, 'bills', { id, at: now(), contactId, ...meta, status: 'Received' });
      return { id };
    },
  };

  function readJournal() {
    try {
      return fs.readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch { return []; }
  }

  /** Load → apply anything pending → apply this op → save. If Excel holds the file, journal it. */
  function run(op, args) {
    return serial(async () => {
      const pending = readJournal();
      let wb;
      try { wb = await load(); } catch (e) {
        if (!locked(e)) throw e;
        fs.appendFileSync(JOURNAL, JSON.stringify({ op, args }) + '\n');
        return { ...previewResult(op, args), queued: true };
      }
      for (const p of pending) OPS[p.op](wb, p.args);
      const result = OPS[op](wb, args);
      try {
        await save(wb);
        if (pending.length) fs.rmSync(JOURNAL, { force: true });
        return result;
      } catch (e) {
        if (!locked(e)) throw e;
        fs.appendFileSync(JOURNAL, JSON.stringify({ op, args }) + '\n');
        return { ...result, queued: true };
      }
    });
  }

  /** What an op will return once applied (used when it has to wait in the journal). */
  const previewResult = (op, args) => ({ upsertContact: { id: args.id }, createApplication: { reference: args.reference }, logSavingsCheck: { id: args.id }, logBusinessEnquiry: { id: args.id }, saveBill: { id: args.id } }[op]);

  // Retry the journal now and then, so queued writes land soon after Excel closes the file.
  const timer = setInterval(() => { if (readJournal().length) flush().catch(() => {}); }, 30_000);
  timer.unref?.();

  function flush() {
    return serial(async () => {
      const pending = readJournal();
      if (!pending.length) return 0;
      const wb = await load();
      for (const p of pending) OPS[p.op](wb, p.args);
      await save(wb);
      fs.rmSync(JOURNAL, { force: true });
      return pending.length;
    });
  }

  // ── The adapter interface (same shape as freshworks.js) ───
  return {
    provider: 'excel',
    where: FILE,

    async upsertContact(contact) {
      const known = await findContact(contact);
      return run('upsertContact', { id: known?.id || uid('CUST-'), contact });
    },

    async createApplication(contactId, contact, application) {
      return run('createApplication', { contactId, contact, application, reference: application.reference || uid('EU-', 6) });
    },

    async listApplications(contactId) {
      const wb = await serial(load);
      return readRows(wb, 'applications')
        .filter((r) => r.contactId === contactId)
        .map(({ _row, ...r }) => ({ ...r, estimatedSavingYearly: Number(r.estimatedSavingYearly) || 0 }));
    },

    /** A comparison result. contactId may be empty (someone who tapped Switch without an account). */
    async logSavingsCheck(contactId, check) {
      return run('logSavingsCheck', { id: check.reference || uid('EC-', 6), contactId, check });
    },

    async logBusinessEnquiry(contactId, contact, enquiry) {
      return run('logBusinessEnquiry', { id: enquiry.reference || uid('EB-', 6), contactId, contact, enquiry });
    },

    async saveBill(contactId, bill) {
      const id = uid('BILL-', 6);
      fs.mkdirSync(BILLS, { recursive: true });
      const ext = path.extname(bill.fileName) || '';
      const storedAs = path.join(BILLS, `${id}${ext}`);
      fs.writeFileSync(storedAs, bill.data);
      const meta = {
        channel: bill.channel, billingMonth: bill.billingMonth, fileName: bill.fileName, mimeType: bill.mimeType,
        sizeKb: Math.round(bill.data.length / 1024), storedAs: path.relative(DIR, storedAs),
      };
      return run('saveBill', { id, contactId, meta });
    },

    flush,
    pendingCount: () => readJournal().length,
    close: () => clearInterval(timer),
  };

  async function findContact(contact) {
    const wb = await serial(load);
    const fromJournal = readJournal().filter((p) => p.op === 'upsertContact').map((p) => ({ id: p.args.id, ...p.args.contact }));
    return findMatch([...readRows(wb, 'contacts'), ...fromJournal], contact);
  }
}

module.exports = { createExcelCrm };
