import test from 'node:test';
import assert from 'node:assert/strict';
import { formSectionMarkup, groupOptionsMarkup } from './form-fields.mjs';

test('formSectionMarkup escapează titlul și păstrează conținutul', () => {
  assert.equal(
    formSectionMarkup('Părinți & contacte', '<input name="parent">'),
    '<fieldset class="form-section"><legend>Părinți &amp; contacte</legend><div class="form-section-grid"><input name="parent"></div></fieldset>',
  );
});

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
