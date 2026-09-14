import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderMessage } from './reminder-message.mjs';

/** @param {object} [overrides] */
const child = (overrides = {}) => /** @type {any} */ ({ id: 'c1', name: 'Ion', parent: 'Maria', ...overrides });
const obligation = { expected: 500, rest: 200, due: '2026-09-10' };

test('include numele părintelui cu virgulă când e prezent', () => {
  const message = reminderMessage({ child: child(), obligation, month: '2026-09' });
  assert.equal(
    message,
    'Bună ziua, Maria! Vă reamintim că taxa pentru septembrie 2026 pentru Ion este de 500,00 lei, cu scadența la ' +
      '10.09.2026. Rest de plată: 200,00 lei. Vă mulțumim! Startica',
  );
});

test('omite partea „, Părinte” când numele părintelui lipsește', () => {
  const message = reminderMessage({ child: child({ parent: '' }), obligation, month: '2026-09' });
  assert.match(message, /^Bună ziua! Vă reamintim/);
});
