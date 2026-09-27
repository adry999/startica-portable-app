import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';

test('GET /api/notification-settings întoarce implicitele când nu s-a salvat nimic', async t => {
  const { get } = await startTestApplication(t, { prefix: 'startica-notification-settings-get-' });
  assert.deepEqual(await get('/api/notification-settings'), DEFAULT_NOTIFICATION_PREFERENCES);
});

test('POST /api/notification-settings salvează, curăță intrarea și o oglindește pentru lansator', async t => {
  const { get, post, dir } = await startTestApplication(t, { prefix: 'startica-notification-settings-post-' });

  const response = await post('/api/notification-settings', {
    birthdaysEnabled: false,
    birthdaysDaysBefore: 99, // plafonat la 14
    overdueCadence: 'daily',
    digestTime: '09:30',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.birthdaysEnabled, false);
  assert.equal(response.body.birthdaysDaysBefore, 14);
  assert.equal(response.body.overdueCadence, 'daily');
  assert.equal(response.body.digestTime, '09:30');
  // Restul rămâne pe implicit — nu s-a trimis un obiect complet.
  assert.equal(response.body.visitsEnabled, DEFAULT_NOTIFICATION_PREFERENCES.visitsEnabled);

  const { ok, ...savedPreferences } = response.body;
  assert.equal(ok, true);
  assert.deepEqual(await get('/api/notification-settings'), savedPreferences);

  const scheduleFile = join(dir, 'data', 'notify-schedule.json');
  const schedule = JSON.parse(readFileSync(scheduleFile, 'utf8'));
  assert.deepEqual(schedule, { digestTime: '09:30' });
});

test('ora rezumatului se oglindește în fișierul instalării, nu în folderul filialei active', async t => {
  const { post, dir } = await startTestApplication(t, { prefix: 'startica-notification-settings-branch-' });

  const created = await post('/api/branches', { name: 'Botanica' });
  assert.equal(created.status, 200, created.body.error);
  const branchB = created.body.branch;

  const selected = await post('/api/branches/select', { id: branchB.id });
  assert.equal(selected.status, 200, selected.body.error);

  const response = await post('/api/notification-settings', { digestTime: '11:15' });
  assert.equal(response.status, 200);

  // Fixă, la calea de instalare (folderul de date al filialei migrate), indiferent
  // pe ce filială e activă în momentul salvării (decizia 8 din planul Filiale).
  const scheduleFile = join(dir, 'data', 'notify-schedule.json');
  const schedule = JSON.parse(readFileSync(scheduleFile, 'utf8'));
  assert.deepEqual(schedule, { digestTime: '11:15' });

  const branchScheduleFile = join(dir, 'Filiale', branchB.folder, 'Startica_Date', 'notify-schedule.json');
  assert.equal(existsSync(branchScheduleFile), false, 'ora nu se scrie în folderul filialei active');
});
