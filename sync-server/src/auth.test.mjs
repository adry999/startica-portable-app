import test from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, createRateLimiter, createToken, hashToken } from './auth.mjs';

test('hashToken produce același hash pentru același token, altul pentru un token diferit', () => {
  const token = createToken();
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), hashToken(createToken()));
});

test('createToken generează 32 de octeți codați base64url, diferiți de fiecare dată', () => {
  const first = createToken();
  const second = createToken();
  assert.notEqual(first, second);
  assert.equal(Buffer.from(first, 'base64url').length, 32);
});

test('bearerToken citește antetul Authorization, altfel e undefined', () => {
  assert.equal(bearerToken({ headers: { authorization: 'Bearer abc123' } }), 'abc123');
  assert.equal(bearerToken({ headers: {} }), undefined);
  assert.equal(bearerToken({ headers: { authorization: 'Basic abc123' } }), undefined);
});

test('limitatorul lasă 5 încercări pe fereastră', () => {
  const limiter = createRateLimiter({ limit: 5, windowMs: 600000 });
  const now = 1000;
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(limiter.consume('1.2.3.4', now), true);
  assert.equal(limiter.consume('1.2.3.4', now), false);
});

test('limitatorul redă acces după ce fereastra expiră', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(limiter.consume('1.2.3.4', 0), true);
  assert.equal(limiter.consume('1.2.3.4', 500), false);
  assert.equal(limiter.consume('1.2.3.4', 1500), true);
});

test('limitatorul ține evidența separat pe fiecare cheie', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(limiter.consume('1.2.3.4', 0), true);
  assert.equal(limiter.consume('5.6.7.8', 0), true);
});
