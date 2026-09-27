import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestApplication } from '#test-support/start-test-application.mjs';

// Constrângere obligatorie a Fazei 2: o instalare fără sync.json trebuie să se
// comporte exact ca astăzi — niciun rând în coada de sincronizare, indiferent
// cât de multe scrieri normale se fac prin rutele existente (fișe, prezență).
test('fără sync.json, scrierile normale (fișă, prezență, import) nu pun nimic în coada de sincronizare', async t => {
  const { app, post } = await startTestApplication(t);

  const saveChild = await post('/api/record', {
    type: 'children',
    mode: 'create',
    record: { id: 'ID-fara-sync', name: 'Copil fără sincronizare' },
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(saveChild.status, 200);

  const markAttendance = await post('/api/attendance', {
    changes: [{ childId: 'ID-fara-sync', date: '2026-09-27', status: 'present', reason: '' }],
  });
  assert.equal(markAttendance.status, 200);

  const deleteChild = await post('/api/record', {
    type: 'children',
    mode: 'update',
    record: {
      id: 'ID-fara-sync',
      name: 'Copil fără sincronizare',
      archived: true,
      archivedAt: '2026-09-27T00:00:00.000Z',
    },
    revision: saveChild.body.revision,
    requestId: randomUUID(),
  });
  assert.equal(deleteChild.status, 200);

  const outboxCount = /** @type {{ count: number }} */ (
    app.db.prepare("SELECT COUNT(*) AS count FROM sync_outbox WHERE status='pending'").get()
  );
  assert.equal(outboxCount.count, 0);
  const syncStateCount = /** @type {{ count: number }} */ (
    app.db.prepare('SELECT COUNT(*) AS count FROM sync_state').get()
  );
  assert.equal(syncStateCount.count, 0);
});
