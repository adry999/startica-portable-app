import test from 'node:test';
import assert from 'node:assert/strict';
import { createSmsService, classifySmsFailure } from './sms.service.mjs';
import { createFakeSmsApi, SMS_RESPONSES } from '../test-support/fake-sms-api.mjs';

const TOKEN = 'tok-1234abcd';

test('classifySmsFailure: TypeError „fetch failed” e tranzitoriu, cont', () => {
  const failure = classifySmsFailure(new TypeError('fetch failed'));
  assert.deepEqual(failure, {
    kind: 'transient',
    scope: 'account',
    code: 'NETWORK',
    message: 'Fără internet sau sms.md indisponibil.',
  });
});

test('classifySmsFailure: AbortError e tranzitoriu, cont', () => {
  const error = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  const failure = classifySmsFailure(error);
  assert.equal(failure.kind, 'transient');
  assert.equal(failure.scope, 'account');
  assert.equal(failure.code, 'TIMEOUT');
});

test('classifySmsFailure: 5xx / INTERNAL_ERROR e tranzitoriu, cont', () => {
  const error = Object.assign(new Error('Eroare internă.'), { status: 502, code: 'INTERNAL_ERROR' });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'transient',
    scope: 'account',
    code: 'INTERNAL_ERROR',
    message: 'Fără internet sau sms.md indisponibil.',
  });
});

test('classifySmsFailure: 429 RATE_LIMIT_EXCEEDED e tranzitoriu, cont', () => {
  const error = Object.assign(new Error('Prea multe cereri.'), { status: 429, code: 'RATE_LIMIT_EXCEEDED' });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'transient',
    scope: 'account',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Fără internet sau sms.md indisponibil.',
  });
});

test('classifySmsFailure: 401 INVALID_API_TOKEN e permanent, cont', () => {
  const error = Object.assign(new Error('Token invalid.'), { status: 401, code: 'INVALID_API_TOKEN' });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'permanent',
    scope: 'account',
    code: 'INVALID_API_TOKEN',
    message: 'Token sms.md invalid sau dezactivat. Reconectează din Notificări.',
  });
});

test('classifySmsFailure: 401 AUTHENTICATION_REQUIRED e permanent, cont', () => {
  const error = Object.assign(new Error('Autentificare necesară.'), { status: 401, code: 'AUTHENTICATION_REQUIRED' });
  const failure = classifySmsFailure(error);
  assert.equal(failure.kind, 'permanent');
  assert.equal(failure.scope, 'account');
});

test('classifySmsFailure: 403 SCOPE_FORBIDDEN e permanent, cont', () => {
  const error = Object.assign(new Error('Lipsește scope-ul.'), { status: 403, code: 'SCOPE_FORBIDDEN' });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'permanent',
    scope: 'account',
    code: 'SCOPE_FORBIDDEN',
    message:
      'Tokenul nu are permisiunea necesară. Creează un token cu messages:send, messages:read, account:read, senders:read.',
  });
});

test('classifySmsFailure: 402 INSUFFICIENT_BALANCE e permanent, cont', () => {
  const error = Object.assign(new Error('Sold insuficient.'), { status: 402, code: 'INSUFFICIENT_BALANCE' });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'permanent',
    scope: 'account',
    code: 'INSUFFICIENT_BALANCE',
    message: 'Sold insuficient la sms.md. Alimentează contul și reia eșuatele.',
  });
});

test('classifySmsFailure: 422 cu errors.from e permanent, cont (expeditor neaprobat)', () => {
  const error = Object.assign(new Error('Validare eșuată.'), {
    status: 422,
    code: 'VALIDATION_ERROR',
    errors: { from: ['Sender not approved'] },
  });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'permanent',
    scope: 'account',
    code: 'VALIDATION_ERROR',
    message: 'Expeditorul nu e aprobat la sms.md.',
  });
});

test('classifySmsFailure: 422 cu errors.to e permanent, destinatar', () => {
  const error = Object.assign(new Error('Validare eșuată.'), {
    status: 422,
    code: 'VALIDATION_ERROR',
    errors: { to: ['Invalid number'] },
  });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'permanent',
    scope: 'recipient',
    code: 'VALIDATION_ERROR',
    message: 'Număr invalid pentru sms.md.',
  });
});

test('classifySmsFailure: 422 cu errors._ e permanent, destinatar', () => {
  const error = Object.assign(new Error('Validare eșuată.'), {
    status: 422,
    code: 'VALIDATION_ERROR',
    errors: { _: ['International disabled'] },
  });
  const failure = classifySmsFailure(error);
  assert.equal(failure.scope, 'recipient');
  assert.equal(failure.message, 'Număr invalid pentru sms.md.');
});

test('classifySmsFailure: 422 cu errors.text e permanent, destinatar, cu primul mesaj', () => {
  const error = Object.assign(new Error('Validare eșuată.'), {
    status: 422,
    code: 'VALIDATION_ERROR',
    errors: { text: ['Text refused', 'al doilea motiv'] },
  });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'permanent',
    scope: 'recipient',
    code: 'VALIDATION_ERROR',
    message: 'sms.md a refuzat textul: Text refused.',
  });
});

test('classifySmsFailure: un cod necunoscut e permanent, destinatar', () => {
  const error = Object.assign(new Error('Ceva nou.'), { status: 418, code: 'SOMETHING_NEW' });
  const failure = classifySmsFailure(error);
  assert.deepEqual(failure, {
    kind: 'permanent',
    scope: 'recipient',
    code: 'SOMETHING_NEW',
    message: 'sms.md a refuzat mesajul (SOMETHING_NEW).',
  });
});

test('sendMessage trimite X-Api-Token, Content-Type și corpul {from,to,text}, întoarce data', async () => {
  const { fetch, calls } = createFakeSmsApi();
  const service = createSmsService({ fetch });
  const data = await service.sendMessage({ token: TOKEN, from: 'Startica', to: '+37369123456', text: 'Salut' });
  const call = calls.find(c => c.url.includes('/v3/messages') && c.method === 'POST');
  assert.ok(call);
  assert.equal(call.headers['X-Api-Token'], TOKEN);
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.deepEqual(call.body, { from: 'Startica', to: '+37369123456', text: 'Salut' });
  assert.equal(data.id, 'msg-1');
  assert.equal(data.segments, 1);
});

test('getMessage întoarce id și status', async () => {
  const { fetch } = createFakeSmsApi();
  const service = createSmsService({ fetch });
  const message = await service.getMessage({ token: TOKEN, id: 'msg-9' });
  assert.deepEqual(message, { id: 'msg-9', status: { id: 3, name: 'Delivered' } });
});

test('getBalance întoarce balance și currency', async () => {
  const { fetch } = createFakeSmsApi();
  const service = createSmsService({ fetch });
  assert.deepEqual(await service.getBalance({ token: TOKEN }), { balance: '100.00', currency: 'MDL' });
});

test('listActiveSenders cheamă GET /v3/sender-aliases?status=1 și întoarce numele active', async () => {
  const { fetch, calls } = createFakeSmsApi();
  const service = createSmsService({ fetch });
  const senders = await service.listActiveSenders({ token: TOKEN });
  assert.deepEqual(senders, ['Startica']);
  const call = calls.find(c => c.url.includes('/v3/sender-aliases'));
  assert.ok(call?.url.includes('status=1'));
});

test('listActiveSenders exclude expeditorii inactivi', async () => {
  const { fetch } = createFakeSmsApi({
    senders: {
      body: {
        status: 'success',
        httpCode: 200,
        data: [
          { name: 'Startica', status: { id: 1, name: 'Active' } },
          { name: 'Vechi', status: { id: 2, name: 'Inactive' } },
        ],
      },
    },
  });
  const service = createSmsService({ fetch });
  assert.deepEqual(await service.listActiveSenders({ token: TOKEN }), ['Startica']);
});

test('un envelope de eroare devine o eroare aruncată cu code din envelope', async () => {
  const { fetch } = createFakeSmsApi({ send: SMS_RESPONSES.insufficientBalance });
  const service = createSmsService({ fetch });
  await assert.rejects(
    () => service.sendMessage({ token: TOKEN, from: 'Startica', to: '+37369123456', text: 'Salut' }),
    error => {
      assert.equal(/** @type {any} */ (error).code, 'INSUFFICIENT_BALANCE');
      assert.equal(/** @type {any} */ (error).status, 402);
      return true;
    },
  );
});
