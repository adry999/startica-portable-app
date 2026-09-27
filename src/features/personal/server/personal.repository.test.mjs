import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createPersonalRepository } from './personal.repository.mjs';

function createRepository(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const settings = createSettingsRepository(database);
  const common = {
    kinds: createKindRepository(database),
    readSetting: /** @type {(key: string) => string} */ (settings.setting),
    writeSetting: settings.setSetting,
  };
  return createPersonalRepository(common);
}

test('semințele se scriu o singură dată, cât timp departments și roles sunt amândouă goale', t => {
  const repository = createRepository(t);
  assert.ok(repository.departments().length > 0);
  assert.ok(repository.roles().length > 0);

  repository.kinds.remove('departments', repository.departments()[0].id);
  const database = new DatabaseSync(':memory:'); // control: o a doua bază, goală de la zero, primește semințele
  applySchema(database);
  t.after(() => database.close());
  const settings = createSettingsRepository(database);
  const fresh = createPersonalRepository({
    kinds: createKindRepository(database),
    readSetting: /** @type {(key: string) => string} */ (settings.setting),
    writeSetting: settings.setSetting,
  });
  assert.equal(fresh.departments().length, repository.departments().length + 1);
});

test('o funcție cu angajați nu se poate șterge, doar redenumi', t => {
  const repository = createRepository(t);
  const [role] = repository.roles();
  repository.saveStaff({ id: 'STF-1', name: 'Ana', roleId: role.id, branchIds: ['bu'], since: '2026-01-01' }, 'create');

  assert.throws(
    () =>
      repository.replaceDepartmentsAndRoles(
        repository.departments(),
        repository.roles().filter(r => r.id !== role.id),
      ),
    /nu poate fi ștearsă/,
  );

  const renamed = repository.roles().map(r => (r.id === role.id ? { ...r, name: 'Educator principal' } : r));
  const result = repository.replaceDepartmentsAndRoles(repository.departments(), renamed);
  assert.equal(result.roles.find(r => r.id === role.id).name, 'Educator principal');
});

test('saveStaff respinge id duplicat la creare și un angajat inexistent la actualizare', t => {
  const repository = createRepository(t);
  const [role] = repository.roles();
  const input = { id: 'STF-1', name: 'Ana', roleId: role.id, branchIds: ['bu'], since: '2026-01-01' };
  repository.saveStaff(input, 'create');
  assert.throws(() => repository.saveStaff(input, 'create'), /409|deja folosit/i);
  assert.throws(() => repository.saveStaff({ ...input, id: 'STF-inexistent' }, 'update'), /nu mai există/);
});

test('applyTimesheetChanges scrie și șterge rânduri într-o singură tranzacție', t => {
  const repository = createRepository(t);
  const { saved } = repository.applyTimesheetChanges([
    { staffId: 'STF-1', date: '2026-09-08', code: 'CO' },
    { staffId: 'STF-1', date: '2026-09-09', code: 'CM' },
  ]);
  assert.equal(saved.length, 2);
  assert.equal(repository.timesheetForMonth('2026-09').length, 2);

  repository.applyTimesheetChanges([{ staffId: 'STF-1', date: '2026-09-08', code: null }]);
  assert.equal(repository.timesheetForMonth('2026-09').length, 1);
});

test('readSettings/writeSettings folosesc implicit 28 zile și deductOnlyUnexcused', t => {
  const repository = createRepository(t);
  assert.deepEqual(repository.readSettings(), { annualLeaveDays: 28, deductOnlyUnexcused: true });

  const updated = repository.writeSettings({ annualLeaveDays: 24, deductOnlyUnexcused: false });
  assert.deepEqual(updated, { annualLeaveDays: 24, deductOnlyUnexcused: false });
  assert.deepEqual(repository.readSettings(), updated);
});
