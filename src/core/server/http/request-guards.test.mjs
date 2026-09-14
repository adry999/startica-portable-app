import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJsonBody } from './request-guards.mjs';

/** @param {Buffer[]} chunks */
const fakeRequest = chunks =>
  /** @type {import('node:http').IncomingMessage} */ (/** @type {unknown} */ (Readable.from(chunks)));

test('un corp JSON valid este parsat corect', async () => {
  const request = fakeRequest([Buffer.from(JSON.stringify({ a: 1 }))]);
  assert.deepEqual(await readJsonBody(request), { a: 1 });
});

test('un corp care nu este JSON valid întoarce 400 cu mesaj în română', async () => {
  const request = fakeRequest([Buffer.from('nu e json')]);
  await assert.rejects(
    () => readJsonBody(request),
    /** @param {Error & { status?: number }} error */
    error => error.message === 'Cererea nu este JSON valid.' && error.status === 400,
  );
});
