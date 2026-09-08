import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { csvRows, previewChildrenCSV } from '../children-csv.mjs';
import { normalizeRecord, cashSummary, obligation, emptyState, paymentTenders } from '../domain.mjs';
import { createApplication } from '../startica_server.mjs';
import { exportWorkbook, readWorkbook } from '../excel.mjs';
const csv =
  'ID (Nr. contract),Nume copil,Parinte,Telefon,Data nasterii,Data frecventarii,Parinte 2,Telefon 2\n1,Copil test,Parinte unu,060123456,01.01.2022,01.09.2026,Parinte doi,+37360123457';
const real = readFileSync(new URL('../../Fisiere_Excel/Lista_copiilor_inmatriculati.csv', import.meta.url), 'utf8');
test('CSV: 105 copii, date sursă păstrate, avertizări și reimport fără dubluri', () => {
  const p = previewChildrenCSV(real);
  assert.deepEqual(p.errors, []);
  assert.equal(p.total, 105);
  assert.equal(p.additions.length, 105);
  assert.equal(p.additions.filter(c => !c.attendanceDate).length, 2);
  assert.equal(p.rows.filter(r => r.warnings.some(w => w.includes('Date neconcordante'))).length, 1);
  assert.ok(p.additions.every(c => c.fee === null && c.group === '' && c.status === 'De verificat'));
  assert.ok(p.rows.some(r => r.warnings.some(w => w.includes('Părinte coincide'))));
  const repeated = previewChildrenCSV(real, p.additions);
  assert.equal(repeated.additions.length, 0);
  assert.equal(repeated.skipped, 105);
  const c = previewChildrenCSV(csv).additions[0];
  assert.equal(c.phone, '060123456');
  assert.equal(c.phone2, '+37360123457');
  assert.equal(c.parent2, 'Parinte doi');
  const snapshot = structuredClone(c),
    skip = previewChildrenCSV(csv, [{ ...c, phone: 'manual', archived: true }]);
  assert.equal(skip.skipped, 1);
  assert.equal(skip.additions.length, 0);
  assert.deepEqual(c, snapshot);
  assert.equal(previewChildrenCSV(csv, [{ ...c, name: 'Alt copil' }]).conflicts, 1);
  assert.equal(
    previewChildrenCSV(csv, [{ ...c, id: 'ID-alt', contractNumber: '2', birthDate: '2023-01-01' }]).conflicts,
    1,
  );
});
test('CSV: ghilimele, delimitatori, UTF-8 și validare strictă', () => {
  assert.deepEqual(csvRows('\uFEFFa;b\n"unu;doi";"trei\npatru"')[1].cells, ['unu;doi', 'trei\npatru']);
  assert.deepEqual(csvRows('a,b\n"a""b",c')[1].cells, ['a"b', 'c']);
  for (const invalid of ['a,b\n"neinchis', 'a,b\n"ok"oops,z', 'a,b\n\uFFFD,z']) assert.throws(() => csvRows(invalid));
  for (const invalid of [
    csv + '\n' + csv.split('\n')[1],
    csv.replace('01.01.2022', '31.02.2022'),
    csv.replace('ID (Nr. contract)', 'necunoscut'),
    csv + '\n2,Lipsesc coloane',
  ])
    assert.ok(previewChildrenCSV(invalid).errors.length);
});
test('Doi părinți opționali și achitare mixtă: total, repartizare, rapoarte și Excel', () => {
  const c = normalizeRecord('children', {
    id: 'C1',
    name: 'Copil',
    parent: 'P1',
    phone: '00123',
    parent2: 'P2',
    phone2: '+373456',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 1500 }],
  });
  assert.doesNotThrow(() => normalizeRecord('children', { id: 'C0', name: 'Fără contacte' }));
  assert.throws(() => normalizeRecord('children', { ...c, phone2: 123 }));
  const p = normalizeRecord('payments', {
    id: 'P1',
    childId: c.id,
    date: '2026-09-08',
    tenders: [
      { method: 'Cash', amount: 1000.1 },
      { method: 'Card', amount: 500.2 },
    ],
    allocations: [{ month: '2026-09', amount: 1500 }],
  });
  assert.equal(p.amount, 1500.3);
  assert.equal(p.method, 'Cash + Card');
  const s = { children: [c], payments: [p], expenses: [] },
    summary = cashSummary(s, '2026-09');
  assert.equal(summary.income, 1500.3);
  assert.deepEqual(summary.byMethod, { Cash: 1000.1, Card: 500.2, Transfer: 0, Altele: 0 });
  assert.equal(obligation(c, '2026-09', [p], '2026-09-08').paid, 1500);
  for (const tenders of [
    [],
    [{ method: 'Cash', amount: -1 }],
    [{ method: 'Cash', amount: 1.001 }],
    [
      { method: 'Card', amount: 1 },
      { method: 'card', amount: 2 },
    ],
  ])
    assert.throws(() => normalizeRecord('payments', { ...p, tenders }));
  assert.throws(() => normalizeRecord('payments', { ...p, amount: 999 }));
  assert.throws(() => normalizeRecord('payments', { ...p, allocations: [{ month: '2026-09', amount: 1600 }] }));
  const legacy = { id: 'P2', date: '2026-09-08', amount: 200, method: 'Transfer' };
  assert.deepEqual(paymentTenders(legacy), [{ method: 'Transfer', amount: 200 }]);
  assert.equal(normalizeRecord('payments', legacy).amount, 200);
  assert.equal(cashSummary({ ...s, payments: [{ ...p, archived: true }] }, '2026-09').income, 0);
  const require = createRequire(import.meta.url),
    XLSX = require('../xlsx.full.min.js');
  const wb = XLSX.read(XLSX.write(exportWorkbook(s, XLSX), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' }),
    back = readWorkbook(wb, XLSX);
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.state, s);
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Copii)[0].Telefon_2, '+373456');
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Achitari)[0].Card, 500.2);
});
test('API CSV: import atomic, backup, jurnal, protecție la conflicte și reîncercare', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-csv-test-')),
    app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups') });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const token = (await (await fetch(url + '/api/session')).json()).token;
    const post = async (path, body) => {
      const res = await fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };
    const expense = normalizeRecord('expenses', { id: 'E1', date: '2026-09-08', amount: 123 });
    await post('/api/record', {
      type: 'expenses',
      mode: 'create',
      record: expense,
      requestId: randomUUID(),
      revision: 0,
    });
    const payment = normalizeRecord('payments', { id: 'P1', date: '2026-09-08', amount: 456, method: 'Card' });
    await post('/api/record', {
      type: 'payments',
      mode: 'create',
      record: payment,
      requestId: randomUUID(),
      revision: 1,
    });
    const preview = await post('/api/children-csv-preview', { csv });
    assert.equal(preview.body.revision, 2);
    assert.equal(preview.body.additions.length, 1);
    assert.equal(app.envelope().revision, 2);
    const body = { csv, confirm: 'IMPORT COPII', revision: 2, requestId: randomUUID() };
    assert.equal((await post('/api/children-csv', { ...body, confirm: '' })).status, 400);
    assert.equal((await post('/api/children-csv', { ...body, revision: 1 })).status, 409);
    renameSync(join(dir, 'backups'), join(dir, 'offline'));
    assert.equal((await post('/api/children-csv', body)).status, 400);
    assert.equal(app.envelope().state.children.length, 0);
    renameSync(join(dir, 'offline'), join(dir, 'backups'));
    const r = await post('/api/children-csv', body);
    assert.equal(r.status, 200);
    assert.equal(r.body.state.children.length, 1);
    assert.deepEqual(r.body.state.payments, [payment]);
    assert.deepEqual(r.body.state.expenses, [expense]);
    assert.equal((await post('/api/children-csv', body)).body.replayed, true);
    assert.equal((await post('/api/children-csv-preview', { csv })).body.skipped, 1);
    assert.equal((await post('/api/children-csv', { ...body, revision: 3, requestId: randomUUID() })).status, 400);
    assert.equal(app.envelope().revision, 3);
    const backup = readdirSync(join(dir, 'backups')).find(n => n.includes('inainte-import-copii'));
    assert.ok(backup);
    const db = new DatabaseSync(join(dir, 'backups', backup), { readOnly: true });
    assert.equal(db.prepare("SELECT count(*) AS n FROM records WHERE kind='children'").get().n, 0);
    db.close();
    const audit = app.db.prepare("SELECT * FROM audit_changes WHERE action='import copii CSV'").all();
    assert.equal(audit.length, 1);
    const invalid = await post('/api/children-csv', {
      csv: csv.replace('01.01.2022', 'bad date'),
      confirm: 'IMPORT COPII',
      revision: 3,
      requestId: randomUUID(),
    });
    assert.equal(invalid.status, 400);
    assert.equal(app.envelope().revision, 3);
  } finally {
    await app.close();
    if (dir.startsWith(join(tmpdir(), 'startica-csv-test-'))) rmSync(dir, { recursive: true, force: true });
  }
});
