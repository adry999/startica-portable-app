import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCommonContext } from './create-common-context.mjs';

function tempHome(t) {
  const home = mkdtempSync(join(tmpdir(), 'startica-common-context-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return home;
}

test('setul comun se deschide o singură dată per proces, în <home>\\Comun, și rămâne deschis la schimbarea filialei', t => {
  const home = tempHome(t);
  const common = createCommonContext({ home, autoBackupIntervalMs: 0 });

  assert.equal(common.dataDir, join(home, 'Comun', 'Startica_Date'));
  assert.equal(common.backupDir, join(home, 'Comun', 'Startica_Backup'));
  assert.ok(existsSync(common.dbFile));

  // scriere prin kinds, citită înapoi din aceeași bază — dovedește că e un depozit real, nu unul gol.
  common.kinds.save('departments', { id: 'DEP-1', name: 'Administrație' });
  assert.deepEqual(common.kinds.list('departments'), [{ id: 'DEP-1', name: 'Administrație' }]);
  common.close();

  // „schimbarea filialei” nu înseamnă nimic pentru contextul comun: un al doilea
  // apel simulat (după închiderea primului) tot vede datele scrise mai sus,
  // pentru că e vorba de exact același fișier de pe disc.
  const reopened = createCommonContext({ home, autoBackupIntervalMs: 0 });
  assert.deepEqual(reopened.kinds.list('departments'), [{ id: 'DEP-1', name: 'Administrație' }]);
  reopened.close();
});

test('un install care nu deschide niciodată Personal are doar un fișier gol în Comun\\', t => {
  const home = tempHome(t);
  const common = createCommonContext({ home, autoBackupIntervalMs: 0 });

  assert.deepEqual(common.kinds.list('staff'), []);
  assert.ok(existsSync(common.dbFile));
  common.close();
});

test('backup-ul setului comun scrie în Comun\\Startica_Backup, separat de orice filială', t => {
  const home = tempHome(t);
  const common = createCommonContext({ home, autoBackupIntervalMs: 0 });

  const result = common.backup('test');
  assert.ok(result.file.startsWith(join(home, 'Comun', 'Startica_Backup')));
  assert.ok(existsSync(result.file));
  common.close();
});
