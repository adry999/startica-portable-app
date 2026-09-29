import test from 'node:test';
import assert from 'node:assert/strict';
import { childNameOf, contractNumberOf, groupNameOf, serviceNameOf, serviceOf } from './record-labels.mjs';

test('contractNumberOf preferă numărul de contract, altfel id-ul', () => {
  assert.equal(contractNumberOf({ id: 'c1', contractNumber: 'CTR-9' }), 'CTR-9');
  assert.equal(contractNumberOf({ id: 'c1' }), 'c1');
});

test('childNameOf cade pe numele din sursă când achitarea nu are copil', () => {
  const children = [{ id: 'C1', name: 'Ana Pop' }];
  assert.equal(childNameOf(/** @type {any} */ ({ childId: 'C1' }), /** @type {any} */ (children)), 'Ana Pop');
  assert.equal(
    childNameOf(/** @type {any} */ ({ childId: '', sourceName: 'Pop' }), /** @type {any} */ (children)),
    'Pop',
  );
  assert.equal(childNameOf(/** @type {any} */ ({ childId: '' }), /** @type {any} */ (children)), 'Copil neasociat');
});

test('groupNameOf întoarce text gol pentru o grupă lipsă', () => {
  const groups = /** @type {any} */ ([{ id: 'G1', name: 'Curcubeu' }]);
  assert.equal(groupNameOf('G1', groups), 'Curcubeu');
  assert.equal(groupNameOf('G2', groups), '');
  assert.equal(groupNameOf(null, groups), '');
});

test('serviceNameOf întoarce numele serviciului din listă', () => {
  const services = /** @type {any} */ ([
    { id: 'gradinita', name: 'Grădiniță', tone: 'orange', priceMode: 'free', system: true },
    { id: 'bazin', name: 'Bazin', tone: 'blue', priceMode: 'free', system: true },
  ]);
  assert.equal(serviceNameOf(/** @type {any} */ ({ service: 'bazin' }), services), 'Bazin');
  assert.equal(serviceNameOf(/** @type {any} */ ({ service: 'gradinita' }), services), 'Grădiniță');
});

test('serviceOf cade pe Grădiniță (DEFAULT_SERVICE_SEEDS) dacă lipsește `service` sau lista de servicii e goală', () => {
  assert.equal(serviceOf(/** @type {any} */ ({}), []).name, 'Grădiniță');
  assert.equal(serviceOf(/** @type {any} */ ({ service: 'bazin' }), []).name, 'Bazin');
  assert.equal(serviceOf(/** @type {any} */ ({ service: 'bazin' }), []).tone, 'blue');
});
