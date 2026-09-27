import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createPersonalRepository } from './personal.repository.mjs';
import { createLeavesService } from './leaves.service.mjs';

function createServices(t, groups = []) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  const settings = createSettingsRepository(database);
  const repository = createPersonalRepository({
    kinds: createKindRepository(database),
    readSetting: /** @type {(key: string) => string} */ (settings.setting),
    writeSetting: settings.setSetting,
  });
  return createLeavesService({ repository, listGroups: () => groups });
}

test('un concediu CO scrie CO în pontaj pe zilele lucrătoare, iar ștergerea lui le scoate', t => {
  const service = createServices(t);
  const leave = service.saveLeave({
    id: 'LV-1',
    staffId: 'STF-1',
    from: '2026-09-07',
    to: '2026-09-11',
    type: 'CO',
    planned: false,
  });
  const { leaves } = service.leavesForYear('2026');
  assert.deepEqual(leaves, [leave]);

  service.removeLeave('LV-1');
  assert.deepEqual(service.leavesForYear('2026').leaves, []);
});

test('două concedii ale aceluiași angajat care se suprapun sunt respinse', t => {
  const service = createServices(t);
  service.saveLeave({ id: 'LV-1', staffId: 'STF-1', from: '2026-09-07', to: '2026-09-11', type: 'CO', planned: false });
  assert.throws(
    () =>
      service.saveLeave({
        id: 'LV-2',
        staffId: 'STF-1',
        from: '2026-09-10',
        to: '2026-09-15',
        type: 'CM',
        planned: false,
      }),
    /concediu înregistrat/,
  );
});

test('leavesForYear întoarce avertismentul suprapunerii din echipa grupei', t => {
  const groups = [{ id: 'GRP-1', team: [{ staffId: 'STF-1' }, { staffId: 'STF-2' }] }];
  const service = createServices(t, groups);
  service.saveLeave({ id: 'LV-1', staffId: 'STF-1', from: '2026-09-07', to: '2026-09-11', type: 'CO', planned: false });
  service.saveLeave({ id: 'LV-2', staffId: 'STF-2', from: '2026-09-09', to: '2026-09-15', type: 'CM', planned: false });
  const { warnings } = service.leavesForYear('2026');
  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0].staffIds, ['STF-1', 'STF-2']);
});
