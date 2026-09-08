import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApplication } from '../startica_server.mjs';
import { normalizeRecord, CHILD_STATUSES, STATUS_HISTORY_VALUES } from '../domain.mjs';
import { childStatus } from '../excel.mjs';

const temporary = prefix => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    remove() {
      if (resolve(dir).startsWith(resolve(tmpdir()))) rmSync(dir, { recursive: true, force: true });
    },
  };
};

test('Backupul curăță fișierele .tmp rămase de la o întrerupere', async t => {
  const { dir, remove } = temporary('startica-tmp-');
  const backupDir = join(dir, 'backups');
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir });
  t.after(async () => {
    await app.close();
    remove();
  });

  const stale = join(backupDir, 'startica_2020-01-01_pornire_aaaaaaaa.db.tmp');
  const running = join(backupDir, 'startica_2026-01-01_pornire_bbbbbbbb.db.tmp');
  for (const file of [stale, running]) writeFileSync(file, 'continut partial');
  const old = new Date(Date.now() - 7200000);
  utimesSync(stale, old, old);

  app.backup('manual');
  const left = readdirSync(backupDir).filter(n => n.endsWith('.tmp'));
  assert.deepEqual(left, ['startica_2026-01-01_pornire_bbbbbbbb.db.tmp'], 'Doar .tmp-ul recent rămâne.');
});

test('Statutul copilului este restrâns la valorile pe care aplicația le înțelege', () => {
  const base = { id: 'ID-1', name: 'Copil', dueDay: 10 };
  for (const status of CHILD_STATUSES) assert.equal(normalizeRecord('children', { ...base, status }).status, status);
  assert.throws(() => normalizeRecord('children', { ...base, status: 'ORICE TEXT' }), /Statut/);
  assert.equal(normalizeRecord('children', base).status, 'Activ');
  // „De verificat” nu este o stare din care se calculează obligații.
  assert.ok(!STATUS_HISTORY_VALUES.includes('De verificat'));
  assert.throws(
    () => normalizeRecord('children', { ...base, statusHistory: [{ from: '2026-01', status: 'De verificat' }] }),
    /Statut istoric/,
  );
});

test('Importul V5 mapează un statut necunoscut, păstrând textul original', () => {
  assert.deepEqual(childStatus(''), { status: 'Activ', note: '' });
  assert.deepEqual(childStatus('  activ '), { status: 'Activ', note: '' });
  assert.deepEqual(childStatus('Retras'), { status: 'Retras', note: '' });
  const unknown = childStatus('Inactiv temporar');
  assert.equal(unknown.status, 'De verificat');
  assert.match(unknown.note, /Inactiv temporar/);
  // Rândul trebuie să treacă validarea, nu să fie respins.
  const r = normalizeRecord('children', { id: 'ID-1', name: 'Copil', dueDay: 10, status: unknown.status });
  assert.equal(r.status, 'De verificat');
});
