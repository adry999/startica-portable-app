import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SMS_TEMPLATE_BODY,
  SMS_TEMPLATE_VARIABLES,
  renderSmsTemplate,
  smsVariablesFor,
  findUnknownSmsVariables,
} from './sms-template.mjs';

const child = (overrides = {}) => /** @type {any} */ ({ id: 'c1', name: 'Ion', parent: 'Maria', ...overrides });
const obligation = { expected: 500, paid: 300, rest: 200, due: '2026-09-10' };

test('șablonul implicit randat e identic caracter cu caracter cu vechiul reminderMessage', () => {
  const text = renderSmsTemplate(
    DEFAULT_SMS_TEMPLATE_BODY,
    smsVariablesFor({ child: child(), parentName: 'Maria', obligation, month: '2026-09' }),
  );
  assert.equal(
    text,
    'Bună ziua, Maria! Vă reamintim că taxa pentru septembrie 2026 pentru Ion este de 500,00 lei, cu scadența la ' +
      '10.09.2026. Rest de plată: 200,00 lei. Vă mulțumim! Startica',
  );
});

test('{părinte} gol elimină și virgula din față', () => {
  const text = renderSmsTemplate(
    DEFAULT_SMS_TEMPLATE_BODY,
    smsVariablesFor({ child: child({ parent: '' }), parentName: '', obligation, month: '2026-09' }),
  );
  assert.match(text, /^Bună ziua! Vă reamintim/);
});

test('o variabilă necunoscută rămâne literal în text', () => {
  assert.equal(renderSmsTemplate('Salut {copil} {xyz}', { copil: 'Ion' }), 'Salut Ion {xyz}');
});

test('smsVariablesFor completează toate cele 7 variabile', () => {
  const variables = smsVariablesFor({ child: child(), parentName: 'Maria', obligation, month: '2026-09' });
  assert.deepEqual(Object.keys(variables).sort(), [...SMS_TEMPLATE_VARIABLES].sort());
  assert.equal(variables.achitat, '300,00 lei');
});

test('smsVariablesFor formatează taxa/rest/achitat în moneda obligației, nu implicit în lei', () => {
  const eurObligation = { expected: 100, paid: 40, rest: 60, due: '2026-09-10', currency: 'EUR' };
  const variables = smsVariablesFor({
    child: child(),
    parentName: 'Maria',
    obligation: eurObligation,
    month: '2026-09',
  });
  assert.equal(variables.taxa, '100,00 €');
  assert.equal(variables.rest, '60,00 €');
  assert.equal(variables.achitat, '40,00 €');
});

test('findUnknownSmsVariables întoarce doar numele care nu sunt în listă', () => {
  assert.deepEqual(findUnknownSmsVariables('{copil} {rest} {suma} {zi}'), ['suma']);
  assert.deepEqual(findUnknownSmsVariables('fără variabile'), []);
});
