import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

test('POST /api/kindergarten nu poate reutiliza numere de confirmare deja emise (M6)', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-kindergarten-reuse-' });

  // Operatorul deschide fila „Grădinița” — încarcă nextReceiptNumber: 1 (implicit).
  const opened = await post('/api/kindergarten', {});
  assert.equal(opened.body.nextReceiptNumber, 1);

  // Într-un alt tab se tipăresc 3 confirmări, care avansează contorul la 4.
  for (const receiptNumber of [1, 2, 3]) {
    const state = await get('/api/state');
    const created = await post('/api/record', {
      mode: 'create',
      type: 'payments',
      record: {
        id: `PAY-${receiptNumber}`,
        date: '2026-09-10',
        amount: 1000,
        method: 'Cash',
        receiptNumber,
        allocations: [{ month: '2026-09', amount: 1000 }],
      },
      revision: state.revision,
      requestId: randomUUID(),
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
  }
  await post('/api/kindergarten', { nextReceiptNumber: 4 });

  // Fila deschisă mai devreme (nextReceiptNumber: 1) e salvată abia acum, cu denumirea completată.
  const saved = await post('/api/kindergarten', { name: 'Grădinița Curcubeu', nextReceiptNumber: 1 });

  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.nextReceiptNumber, 4, 'nu trebuie să dea înapoi la 1 — ar reemite numerele 1-3');
  assert.equal(saved.body.name, 'Grădinița Curcubeu');
});
