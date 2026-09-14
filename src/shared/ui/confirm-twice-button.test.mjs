import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRMATION_WINDOW_MS, cancelPendingConfirmation, confirmOnSecondClick } from './confirm-twice-button.mjs';

/** @param {string} text */
function createFakeButton(text) {
  const classes = new Set();
  return /** @type {any} */ ({
    textContent: text,
    dataset: {},
    classList: {
      contains: name => classes.has(name),
      add: name => void classes.add(name),
      remove: name => void classes.delete(name),
    },
  });
}

test('primul click cere confirmarea, al doilea o confirmă', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const button = createFakeButton('Arhivează');

  assert.equal(confirmOnSecondClick(button, 'Sigur?'), false);
  assert.equal(button.textContent, 'Sigur?');
  assert.equal(button.classList.contains('confirm-pending'), true);

  assert.equal(confirmOnSecondClick(button, 'Sigur?'), true);
  assert.equal(button.classList.contains('confirm-pending'), false);
});

test('fără al doilea click în fereastră, butonul revine la textul inițial', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const button = createFakeButton('Arhivează');

  confirmOnSecondClick(button, 'Sigur?');
  t.mock.timers.tick(CONFIRMATION_WINDOW_MS);

  assert.equal(button.textContent, 'Arhivează');
  assert.equal(confirmOnSecondClick(button, 'Sigur?'), false);
});

test('anularea oprește confirmarea în așteptare', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const button = createFakeButton('Arhivează selectate (2)');

  confirmOnSecondClick(button, 'Sigur? Arhivează selectate (2)');
  cancelPendingConfirmation(button);
  t.mock.timers.tick(CONFIRMATION_WINDOW_MS);

  assert.equal(button.classList.contains('confirm-pending'), false);
  assert.equal(button.textContent, 'Sigur? Arhivează selectate (2)');
});
