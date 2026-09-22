import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
