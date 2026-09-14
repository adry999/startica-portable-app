import test from 'node:test';
import assert from 'node:assert/strict';
import { formSectionMarkup } from './form-fields.mjs';

test('formSectionMarkup escapează titlul și păstrează conținutul', () => {
  assert.equal(
    formSectionMarkup('Părinți & contacte', '<input name="parent">'),
    '<fieldset class="form-section"><legend>Părinți &amp; contacte</legend><div class="form-section-grid"><input name="parent"></div></fieldset>',
  );
});
