import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateState } from '#shared/domain/record-schema.mjs';
import {
  GENERAL_CATEGORY_ID,
  GENERAL_CATEGORY_NAME,
  DEFAULT_EXPENSE_CATEGORY_SEEDS,
} from '#shared/domain/expense-categories.mjs';
import { createApplication, startTestApplication, removeDirWithRetry } from '#test-support/start-test-application.mjs';

// Fără import din #features/sync (o feature nu importă altă feature, nici în teste —
// vezi tests/architecture/import-boundaries.test.mjs): fișierul sync.json e scris
// direct, cu exact forma pe care o citește sync-device.repository.mjs.
/** @param {string} file */
function writeTestSyncDeviceFile(file) {
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      serverUrl: 'https://exemplu.invalid',
      deviceId: 'DEV-1',
      deviceName: 'Calculator test',
      token: 'tok',
      connectedAt: '2026-09-28T00:00:00.000Z',
    }),
  );
}

async function startApplication(t) {
  return startTestApplication(t, { prefix: 'startica-expense-categories-' });
}

const category = { id: 'CAT-1', name: 'Chirie' };
const request = (state, revision) => ({ state, confirm: 'IMPORT', revision, requestId: randomUUID() });

/** @param {Awaited<ReturnType<typeof startApplication>>} app @param {string} type @param {any} record */
async function createRecord(app, type, record) {
  const { revision } = await app.get('/api/state');
  const created = await app.post('/api/record', { type, mode: 'create', record, revision, requestId: randomUUID() });
  assert.equal(created.status, 200, created.body.error);
  return created.body;
}

test('Se poate șterge o categorie existentă; revizia crește și rămâne în istoric', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [], payments: [], expenses: [], groups: [], categories: [category], visits: [] }, 0),
  );
  assert.equal(imported.status, 200, imported.body.error);

  const deleted = await app.post('/api/category-delete', {
    id: category.id,
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 200, deleted.body.error);
  assert.equal(deleted.body.revision, imported.body.revision + 1);
  assert.deepEqual(deleted.body.state.categories, []);
  assert.deepEqual(validateState(deleted.body.state), deleted.body.state);

  const audit = await app.get('/api/audit');
  const entry = audit.entries.find(entry => entry.recordType === 'categories' && entry.recordId === category.id);
  assert.ok(entry, 'Ștergerea categoriei apare în istoric.');
  assert.equal(entry.action, 'ștergere');
});

test('Ștergerea unei categorii inexistente este refuzată cu 409', async t => {
  const app = await startApplication(t);
  const imported = await app.post(
    '/api/import',
    request({ children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] }, 0),
  );
  assert.equal(imported.status, 200, imported.body.error);

  const deleted = await app.post('/api/category-delete', {
    id: 'CAT-INEXISTENT',
    revision: imported.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleted.status, 409);
  assert.match(deleted.body.error, /nu mai există/i);
});

test('o filială nouă are categoriile implicite semănate, inclusiv „General”', async t => {
  const app = await startApplication(t);
  const { state } = await app.get('/api/state');
  assert.ok(state.categories.some(cat => cat.id === GENERAL_CATEGORY_ID && cat.name === GENERAL_CATEGORY_NAME));
  assert.ok(state.categories.some(cat => cat.name === 'Altele'));
});

test('categoria „General” nu poate fi ștearsă', async t => {
  const app = await startApplication(t);
  const { revision } = await app.get('/api/state');

  const deleted = await app.post('/api/category-delete', {
    id: GENERAL_CATEGORY_ID,
    revision,
    requestId: randomUUID(),
  });

  assert.equal(deleted.status, 400);
  assert.match(deleted.body.error, /nu poate fi ștearsă/i);
});

test('ștergerea unei categorii mută cheltuielile ei la General, în aceeași tranzacție, cu backup și audit pe fiecare cheltuială', async t => {
  const app = await startApplication(t);
  await createRecord(app, 'categories', { id: 'CAT-excursii', name: 'Excursii' });
  const expenseOne = (
    await createRecord(app, 'expenses', {
      id: 'EXP-1',
      date: '2026-09-01',
      category: 'Excursii',
      description: 'Tabără',
      amount: 100,
    })
  ).state.expenses.find(expense => expense.id === 'EXP-1');
  await createRecord(app, 'expenses', {
    id: 'EXP-2',
    date: '2026-09-02',
    category: 'Excursii',
    description: 'Muzeu',
    amount: 50,
  });
  const { revision } = await app.get('/api/state');

  const deleted = await app.post('/api/category-delete', { id: 'CAT-excursii', revision, requestId: randomUUID() });

  assert.equal(deleted.status, 200, deleted.body.error);
  assert.ok(!deleted.body.state.categories.some(cat => cat.id === 'CAT-excursii'));
  const movedExpenses = deleted.body.state.expenses.filter(expense => ['EXP-1', 'EXP-2'].includes(expense.id));
  assert.equal(movedExpenses.length, 2);
  assert.ok(movedExpenses.every(expense => expense.category === GENERAL_CATEGORY_NAME));
  assert.deepEqual(validateState(deleted.body.state), deleted.body.state);

  const audit = await app.get('/api/audit');
  const movedEntry = audit.entries.find(entry => entry.recordType === 'expenses' && entry.recordId === 'EXP-1');
  assert.ok(movedEntry, 'Mutarea cheltuielii apare în istoric.');
  assert.equal(movedEntry.before.category, 'Excursii');
  assert.equal(movedEntry.after.category, GENERAL_CATEGORY_NAME);
  assert.deepEqual(movedEntry.before, expenseOne);
  const categoryEntry = audit.entries.find(
    entry => entry.recordType === 'categories' && entry.recordId === 'CAT-excursii',
  );
  assert.ok(categoryEntry, 'Ștergerea categoriei apare separat în istoric.');
});

test('categoria „General” nu poate fi redenumită', async t => {
  const app = await startApplication(t);
  const { revision } = await app.get('/api/state');

  const renamed = await app.post('/api/category-rename', {
    id: GENERAL_CATEGORY_ID,
    name: 'Fond general',
    revision,
    requestId: randomUUID(),
  });

  assert.equal(renamed.status, 400);
  assert.match(renamed.body.error, /nu poate fi redenumită/i);
});

test('/api/category-rename redenumește categoria și propagă noul nume la cheltuielile ei, atomic', async t => {
  const app = await startApplication(t);
  await createRecord(app, 'categories', { id: 'CAT-excursii', name: 'Excursii' });
  await createRecord(app, 'expenses', {
    id: 'EXP-1',
    date: '2026-09-01',
    category: 'Excursii',
    description: 'Tabără',
    amount: 100,
  });
  const { revision } = await app.get('/api/state');

  const renamed = await app.post('/api/category-rename', {
    id: 'CAT-excursii',
    name: 'Excursii școlare',
    revision,
    requestId: randomUUID(),
  });

  assert.equal(renamed.status, 200, renamed.body.error);
  assert.equal(renamed.body.state.categories.find(cat => cat.id === 'CAT-excursii').name, 'Excursii școlare');
  assert.equal(renamed.body.state.expenses.find(expense => expense.id === 'EXP-1').category, 'Excursii școlare');
  assert.deepEqual(validateState(renamed.body.state), renamed.body.state);

  const audit = await app.get('/api/audit');
  const expenseEntry = audit.entries.find(entry => entry.recordType === 'expenses' && entry.recordId === 'EXP-1');
  assert.equal(expenseEntry.after.category, 'Excursii școlare');
});

test('/api/category-rename refuză un nume deja folosit de altă categorie', async t => {
  const app = await startApplication(t);
  await createRecord(app, 'categories', { id: 'CAT-excursii', name: 'Excursii' });
  const { revision } = await app.get('/api/state');

  const renamed = await app.post('/api/category-rename', {
    id: 'CAT-excursii',
    name: 'Altele',
    revision,
    requestId: randomUUID(),
  });

  assert.equal(renamed.status, 400);
  assert.match(renamed.body.error, /există deja/i);
});

test('/api/category-rename este refuzat cu 409 pentru o categorie inexistentă', async t => {
  const app = await startApplication(t);
  const { revision } = await app.get('/api/state');

  const renamed = await app.post('/api/category-rename', {
    id: 'CAT-INEXISTENT',
    name: 'Oricum',
    revision,
    requestId: randomUUID(),
  });

  assert.equal(renamed.status, 409);
  assert.match(renamed.body.error, /nu mai există/i);
});

test('semințele categoriilor implicite nu ajung în outbox pe un calculator sincronizat de la o filială nouă (B-1)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-expense-categories-sync-'));
  try {
    writeTestSyncDeviceFile(join(dir, 'sync.json'));
    const app = createApplication({
      dataDir: join(dir, 'data'),
      backupDir: join(dir, 'backups'),
      home: dir,
      autoBackupIntervalMs: 0,
    });
    // Semințele rulează sincron la construcția rutelor (înainte de listen) — exact
    // scenariul „snapshot-ul serverului nu s-a descărcat încă” din audit (B-1).
    const categories = app.envelope().state.categories;
    assert.equal(categories.length, DEFAULT_EXPENSE_CATEGORY_SEEDS.length);
    const pendingOutbox = app.db.prepare("SELECT COUNT(*) AS n FROM sync_outbox WHERE status='pending'").get().n;
    assert.equal(
      pendingOutbox,
      0,
      'cele 8 categorii implicite (id fix) nu au voie să pornească drept conflicte la prima sincronizare',
    );
    app.closeSync();
  } finally {
    await removeDirWithRetry(dir);
  }
});

test('ștergerea unei categorii mută la General și cheltuielile al căror nume diferă doar prin diacritice/majuscule (m6)', async t => {
  const app = await startApplication(t);
  await createRecord(app, 'categories', { id: 'CAT-bucatarie', name: 'Bucătărie' });
  await createRecord(app, 'expenses', {
    id: 'EXP-1',
    date: '2026-09-01',
    category: 'bucatarie',
    description: 'import vechi, fără diacritice',
    amount: 40,
  });
  const { revision } = await app.get('/api/state');

  const deleted = await app.post('/api/category-delete', { id: 'CAT-bucatarie', revision, requestId: randomUUID() });

  assert.equal(deleted.status, 200, deleted.body.error);
  assert.equal(
    deleted.body.state.expenses.find(expense => expense.id === 'EXP-1').category,
    GENERAL_CATEGORY_NAME,
    'cheltuiala cu nume fără diacritice trebuia mutată la General odată cu ștergerea categoriei',
  );
});

test('redenumirea unei categorii propagă noul nume și la cheltuielile al căror nume diferă doar prin diacritice/majuscule (m6)', async t => {
  const app = await startApplication(t);
  await createRecord(app, 'categories', { id: 'CAT-bucatarie', name: 'Bucătărie' });
  await createRecord(app, 'expenses', {
    id: 'EXP-1',
    date: '2026-09-01',
    category: 'BUCATARIE',
    description: 'import vechi, majuscule fără diacritice',
    amount: 40,
  });
  const { revision } = await app.get('/api/state');

  const renamed = await app.post('/api/category-rename', {
    id: 'CAT-bucatarie',
    name: 'Bucătărie și curățenie',
    revision,
    requestId: randomUUID(),
  });

  assert.equal(renamed.status, 200, renamed.body.error);
  assert.equal(
    renamed.body.state.expenses.find(expense => expense.id === 'EXP-1').category,
    'Bucătărie și curățenie',
    'cheltuiala cu nume fără diacritice/majuscule trebuia să primească noul nume la redenumire',
  );
});
