import test from 'node:test';
import assert from 'node:assert/strict';
import { visitEditorFields } from './visit-editor-fields.mjs';

const context = { records: { groups: [] }, today: () => '2026-09-15', mode: 'create' };

test('la creare, formularul nu randează câmpul „Statut” — vizita nouă pornește mereu „Programată”', () => {
  const html = visitEditorFields.markup({ id: 'VIZ-1' }, { ...context, mode: 'create' });
  assert.doesNotMatch(html, /name="status"/);
});

test('la creare, formularul nu randează notița despre reprogramare — nu există încă o vizită de reprogramat', () => {
  const html = visitEditorFields.markup({ id: 'VIZ-1' }, { ...context, mode: 'create' });
  assert.doesNotMatch(html, /Schimbarea datei sau orei reprogramează vizita\./);
});

test('la editare, câmpul „Statut” și notița de reprogramare rămân randate', () => {
  const html = visitEditorFields.markup(
    { id: 'VIZ-1', status: 'Programată', history: [] },
    { ...context, mode: 'update' },
  );
  assert.match(html, /name="status"/);
  assert.match(html, /Schimbarea datei sau orei reprogramează vizita\./);
});

test('citirea unei creări fără câmp „status” în formular produce tot statutul „Programată”', () => {
  const formData = /** @type {any} */ ({
    notes: '',
    name: 'Ana',
    birthDate: '2022-01-01',
    parent: 'Maria',
    phone: '',
    parent2: '',
    phone2: '',
    date: '2026-09-20',
    time: '10:00',
    desiredStartDate: '',
    desiredGroupId: '',
    source: '',
    healthNotes: '',
    postVisitNotes: '',
  });
  const record = visitEditorFields.read(formData, /** @type {any} */ ({}), {
    previousRecord: { id: 'VIZ-1' },
  });
  assert.equal(record.status, 'Programată');
});
