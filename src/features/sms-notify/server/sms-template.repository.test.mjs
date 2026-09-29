import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { DEFAULT_SMS_TEMPLATE_BODY, PAYMENT_CONFIRMATION_TEMPLATE_BODY } from '#shared/domain/sms-template.mjs';
import {
  createSmsTemplateRepository,
  DEFAULT_SMS_TEMPLATE_ID,
  PAYMENT_CONFIRMATION_TEMPLATE_ID,
} from './sms-template.repository.mjs';

const fixedNow = () => new Date('2026-09-27T10:00:00.000Z');

function openRepository(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  return { database, repository: createSmsTemplateRepository(database, { now: fixedNow }) };
}

test('seed-ul creează „Reamintire restanță” implicit și „Confirmare plată” ne-implicit, o singură dată', t => {
  const { database, repository } = openRepository(t);
  createSmsTemplateRepository(database, { now: fixedNow });
  const templates = repository.list();
  assert.equal(templates.length, 2);
  assert.deepEqual(templates[0], {
    id: DEFAULT_SMS_TEMPLATE_ID,
    name: 'Reamintire restanță',
    body: DEFAULT_SMS_TEMPLATE_BODY,
    stripDiacritics: true,
    isDefault: true,
    createdAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
  });
  assert.deepEqual(templates[1], {
    id: PAYMENT_CONFIRMATION_TEMPLATE_ID,
    name: 'Confirmare plată',
    body: PAYMENT_CONFIRMATION_TEMPLATE_BODY,
    stripDiacritics: true,
    isDefault: false,
    createdAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
  });
});

test('save fără id creează un șablon nou cu id TPL-<uuid>; cu id actualizează și updatedAt', t => {
  const { repository } = openRepository(t);
  const created = repository.save({ name: 'Nou', body: 'Salut {copil}', stripDiacritics: false, isDefault: false });
  assert.match(created.id, /^TPL-[0-9a-f-]{36}$/);
  const updated = repository.save({ ...created, name: 'Nou 2' });
  assert.equal(updated.id, created.id);
  assert.equal(repository.find(created.id)?.name, 'Nou 2');
});

test('setDefault mută flagul atomic: exact unul e implicit', t => {
  const { repository } = openRepository(t);
  const second = repository.save({ name: 'Al doilea', body: 'x', stripDiacritics: true, isDefault: false });
  repository.setDefault(second.id);
  assert.deepEqual(
    repository.list().map(template => [template.id, template.isDefault]),
    [
      [DEFAULT_SMS_TEMPLATE_ID, false],
      [PAYMENT_CONFIRMATION_TEMPLATE_ID, false],
      [second.id, true],
    ],
  );
  assert.equal(repository.findDefault().id, second.id);
});

test('save cu isDefault true face celelalte ne-implicite', t => {
  const { repository } = openRepository(t);
  repository.save({ name: 'Al doilea', body: 'x', stripDiacritics: true, isDefault: true });
  assert.equal(repository.list().filter(template => template.isDefault).length, 1);
});

test('remove întoarce true pentru un id existent și false pentru unul inexistent', t => {
  const { repository } = openRepository(t);
  const created = repository.save({ name: 'De șters', body: 'x', stripDiacritics: true, isDefault: false });
  assert.equal(repository.remove(created.id), true);
  assert.equal(repository.remove('TPL-nu-exista'), false);
});
