import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from './record-schema.mjs';
import { assertRecordReferencesExist, assertUniqueName } from './record-integrity.mjs';

test('assertRecordReferencesExist: refuză o plată cu copil inexistent', () => {
  assert.throws(
    () => assertRecordReferencesExist('payments', { childId: 'ID-1' }, () => false),
    /Copilul asociat nu există\./,
  );
});

test('assertRecordReferencesExist: acceptă o plată neasociată (childId gol)', () => {
  assert.doesNotThrow(() => assertRecordReferencesExist('payments', { childId: '' }, () => false));
});

test('assertRecordReferencesExist: acceptă o plată cu copil existent', () => {
  assert.doesNotThrow(() => assertRecordReferencesExist('payments', { childId: 'ID-1' }, () => true));
});

test('assertRecordReferencesExist: refuză un copil cu grupă inexistentă', () => {
  assert.throws(
    () => assertRecordReferencesExist('children', { groupId: 'GRP-1' }, () => false),
    /Grupa asociată nu există\./,
  );
});

test('assertRecordReferencesExist: acceptă un copil fără grupă', () => {
  assert.doesNotThrow(() => assertRecordReferencesExist('children', { groupId: null }, () => false));
});

test('assertRecordReferencesExist: nu verifică nimic pt. alte tipuri', () => {
  assert.doesNotThrow(() =>
    assertRecordReferencesExist('expenses', { childId: 'ID-1', groupId: 'GRP-1' }, () => false),
  );
});

test('assertRecordReferencesExist: refuză o vizită cu copil inexistent', () => {
  assert.throws(
    () => assertRecordReferencesExist('visits', { childId: 'ID-1' }, () => false),
    /Copilul asociat nu există\./,
  );
});

test('assertRecordReferencesExist: acceptă o vizită neasociată (childId gol)', () => {
  assert.doesNotThrow(() => assertRecordReferencesExist('visits', { childId: '' }, () => false));
});

test('assertRecordReferencesExist: refuză o vizită cu grupa dorită inexistentă', () => {
  assert.throws(
    () => assertRecordReferencesExist('visits', { desiredGroupId: 'GRP-1' }, () => false),
    /Grupa dorită nu există\./,
  );
});

test('assertRecordReferencesExist: acceptă o vizită fără grupa dorită', () => {
  assert.doesNotThrow(() => assertRecordReferencesExist('visits', { desiredGroupId: null }, () => false));
});

test('assertRecordReferencesExist: acceptă o vizită cu copil și grupă existente', () => {
  assert.doesNotThrow(() =>
    assertRecordReferencesExist('visits', { childId: 'ID-1', desiredGroupId: 'GRP-1' }, () => true),
  );
});

test('assertUniqueName: refuză o grupă cu nume duplicat, indiferent de literă mare/mică', () => {
  const records = { ...emptyState(), groups: [{ id: 'GRP-1', name: 'Grupa Mare', capacity: null }] };
  assert.throws(
    () => assertUniqueName('groups', { id: 'GRP-2', name: 'grupa mare' }, records),
    /Există deja o grupă cu acest nume\./,
  );
});

test('assertUniqueName: permite salvarea aceleiași grupe cu același nume (id egal)', () => {
  const records = { ...emptyState(), groups: [{ id: 'GRP-1', name: 'Grupa Mare', capacity: null }] };
  assert.doesNotThrow(() => assertUniqueName('groups', { id: 'GRP-1', name: 'Grupa Mare' }, records));
});

test('assertUniqueName: refuză o categorie cu nume duplicat, indiferent de literă mare/mică', () => {
  const records = { ...emptyState(), categories: [{ id: 'CAT-1', name: 'Chirie' }] };
  assert.throws(
    () => assertUniqueName('categories', { id: 'CAT-2', name: 'CHIRIE' }, records),
    /Există deja o categorie cu acest nume\./,
  );
});

test('assertUniqueName: nu verifică nimic pt. alte tipuri', () => {
  const records = { ...emptyState(), children: [{ id: 'ID-1', name: 'Ana' }] };
  assert.doesNotThrow(() => assertUniqueName('children', { id: 'ID-2', name: 'Ana' }, records));
});
