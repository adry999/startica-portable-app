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
