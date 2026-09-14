import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOptionsMarkup } from './fee-setup.view.mjs';

test('opțiunile de grupă păstrează ordinea primită și marchează grupa aleasă', () => {
  const groups = /** @type {any} */ ([
    { id: 'GRP-B', name: 'Zmeie' },
    { id: 'GRP-A', name: 'Albine' },
  ]);

  assert.equal(
    groupOptionsMarkup(groups, 'GRP-A'),
    '<option value="">Fără grupă</option><option value="GRP-B" >Zmeie</option><option value="GRP-A" selected>Albine</option>',
  );
});
