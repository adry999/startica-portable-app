import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { DEFAULT_KINDERGARTEN_SETTINGS } from '#shared/domain/kindergarten-settings.mjs';

test('GET /api/kindergarten întoarce implicitele când nu s-a salvat nimic', async t => {
  const { get } = await startTestApplication(t, { prefix: 'startica-kindergarten-get-' });
  assert.deepEqual(await get('/api/kindergarten'), DEFAULT_KINDERGARTEN_SETTINGS);
});

test('POST /api/kindergarten salvează și curăță datele grădiniței', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-kindergarten-post-' });

  const response = await post('/api/kindergarten', {
    name: 'Grădinița Curcubeu',
    idno: '1234567890123',
    address: 'Str. Florilor 5',
    phone: '069123456',
    email: 'contact@curcubeu.md',
    iban: 'MD24AG000000002250012345',
    nextReceiptNumber: 100,
    receiptFormat: 'a4-third',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.name, 'Grădinița Curcubeu');
  assert.equal(response.body.nextReceiptNumber, 100);
  assert.equal(response.body.receiptFormat, 'a4-third');
  // Restul rămâne pe implicit — nu s-a trimis un obiect complet.
  assert.equal(response.body.bank, DEFAULT_KINDERGARTEN_SETTINGS.bank);

  assert.deepEqual(await get('/api/kindergarten'), response.body);
});

test('POST /api/kindergarten cu receiptFormat necunoscut revine la a5', async t => {
  const { post } = await startTestApplication(t, { prefix: 'startica-kindergarten-format-' });
  const response = await post('/api/kindergarten', { receiptFormat: 'altceva' });
  assert.equal(response.body.receiptFormat, 'a5');
});
