import test from 'node:test';
import assert from 'node:assert/strict';
import { childEditorFields } from './child-editor-fields.mjs';

const context = { records: { groups: [] }, today: () => '2026-09-13' };

/** @param {string} html @param {string} name */
function valueOf(html, name) {
  return html.match(new RegExp(`name="${name}" type="month" value="([^"]*)"`))?.[1];
}

test('la adăugare fără istoric, luna implicită e începerea frecventării, nu luna curentă', () => {
  const html = childEditorFields.markup({ id: 'ID-1', attendanceDate: '2024-03-05' }, context);
  assert.equal(valueOf(html, 'statusFrom'), '2024-03');
  assert.equal(valueOf(html, 'feeFrom'), '2024-03');
});

test('la adăugare fără istoric și fără nicio dată, luna implicită e ziua curentă', () => {
  const html = childEditorFields.markup({ id: 'ID-1' }, context);
  assert.equal(valueOf(html, 'statusFrom'), '2026-09');
  assert.equal(valueOf(html, 'feeFrom'), '2026-09');
});

test('secțiunea „Date medicale” apare după „Părinți”, cu notița despre datele sensibile', () => {
  const html = childEditorFields.markup({ id: 'ID-1', healthNotes: 'Alergie la polen' }, context);
  const parentsIndex = html.indexOf('Părinți');
  const healthIndex = html.indexOf('Date medicale');
  assert.ok(parentsIndex >= 0 && healthIndex > parentsIndex);
  assert.match(html, /Alergie la polen/);
  assert.match(html, /Date sensibile: nu apar în export și în istoric\./);
});

test('citirea formularului păstrează valoarea introdusă la „Date medicale”', () => {
  const formData = /** @type {any} */ ({
    notes: '',
    name: 'Ana',
    parent: 'Maria',
    phone: '',
    parent2: '',
    phone2: '',
    healthNotes: 'Alergie la nuci',
    groupId: '',
    birthDate: '2022-01-01',
    contractDate: '',
    attendanceDate: '',
    withdrawalDate: '',
    status: 'Activ',
    statusFrom: '2026-09',
    fee: '',
    feeFrom: '',
    dueDay: '10',
    feeHistory: '',
    statusHistory: '',
  });
  const record = childEditorFields.read(formData, /** @type {any} */ ({}), { previousRecord: { id: 'ID-1' } });
  assert.equal(record.healthNotes, 'Alergie la nuci');
});

test('cu istoric deja existent, luna implicită rămâne luna curentă', () => {
  const html = childEditorFields.markup(
    {
      id: 'ID-1',
      attendanceDate: '2024-03-05',
      feeHistory: [{ from: '2024-03', amount: 500 }],
      statusHistory: [{ from: '2024-03', status: 'Activ' }],
    },
    context,
  );
  assert.equal(valueOf(html, 'statusFrom'), '2026-09');
  assert.equal(valueOf(html, 'feeFrom'), '2026-09');
});
