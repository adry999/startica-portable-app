import test from 'node:test';
import assert from 'node:assert/strict';
import { createVersionGate, clientVersionHeader, CLIENT_VERSION_HEADER } from './version-gate.mjs';

/** @param {string} [version] */
function requestWith(version) {
  return /** @type {import('node:http').IncomingMessage} */ (
    /** @type {unknown} */ ({ headers: version === undefined ? {} : { [CLIENT_VERSION_HEADER]: version } })
  );
}

test('fără SYNC_MIN_CLIENT_VERSION, orice cerere trece (comportamentul de azi, neschimbat)', () => {
  const check = createVersionGate({ minClientVersion: undefined });
  assert.doesNotThrow(() => check(requestWith('1.0.0')));
  assert.doesNotThrow(() => check(requestWith()));
});

test('fără antetul X-Startica-Version, cererea trece — nimic de comparat, nu blocăm orbește', () => {
  const check = createVersionGate({ minClientVersion: '2.2.0' });
  assert.doesNotThrow(() => check(requestWith()));
});

test('un client mai vechi decât minClientVersion primește 426 cu minVersion în corp', () => {
  const check = createVersionGate({ minClientVersion: '2.2.0' });
  try {
    check(requestWith('2.1.0'));
    assert.fail('ar fi trebuit să arunce');
  } catch (error) {
    const failure = /** @type {Error & { status?: number, minVersion?: string }} */ (error);
    assert.equal(failure.status, 426);
    assert.equal(failure.minVersion, '2.2.0');
    assert.match(failure.message, /2\.1\.0/);
  }
});

test('un client egal sau mai nou decât minClientVersion trece', () => {
  const check = createVersionGate({ minClientVersion: '2.2.0' });
  assert.doesNotThrow(() => check(requestWith('2.2.0')));
  assert.doesNotThrow(() => check(requestWith('2.3.0')));
});

test('clientVersionHeader citește antetul, inclusiv când vine ca listă', () => {
  assert.equal(clientVersionHeader(requestWith('2.2.0')), '2.2.0');
  assert.equal(
    clientVersionHeader(/** @type {any} */ ({ headers: { [CLIENT_VERSION_HEADER]: ['2.2.0', '2.3.0'] } })),
    '2.2.0',
  );
  assert.equal(clientVersionHeader(requestWith()), undefined);
});
