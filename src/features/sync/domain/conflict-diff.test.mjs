import test from 'node:test';
import assert from 'node:assert/strict';
import { diffFields } from './conflict-diff.mjs';

test('diferențele pe câmpuri marchează doar câmpurile care diferă și ascund notele medicale', () => {
  const local = { id: 'C-1', name: 'Ana', phone: '060', healthNotes: 'Astm' };
  const remote = { id: 'C-1', name: 'Ana', phone: '070', healthNotes: 'Alergii' };

  const fields = diffFields('children', local, remote);
  const byField = Object.fromEntries(fields.map(entry => [entry.field, entry]));

  assert.equal(byField.id, undefined, 'câmpul id nu apare în listă');
  assert.equal(byField.name.differs, false);
  assert.equal(byField.phone.differs, true);
  assert.equal(byField.phone.local, '060');
  assert.equal(byField.phone.remote, '070');
  assert.equal(byField.healthNotes.local, '[date medicale]');
  assert.equal(byField.healthNotes.remote, '[date medicale]');
  assert.equal(byField.healthNotes.differs, false, 'notele medicale redactate nu se mai pot compara ca text în clar');
});

test('o parte ștearsă (payload null) arată câmpurile celeilalte părți ca diferite', () => {
  const local = { id: 'G-1', name: 'Grupa mare' };
  const fields = diffFields('groups', local, null);
  const byField = Object.fromEntries(fields.map(entry => [entry.field, entry]));

  assert.equal(byField.name.local, 'Grupa mare');
  assert.equal(byField.name.remote, undefined);
  assert.equal(byField.name.differs, true);
});
